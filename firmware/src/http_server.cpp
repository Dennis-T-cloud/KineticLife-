#include "http_server.h"
#include <ESPAsyncWebServer.h>
#include <ESPmDNS.h>
#include <esp_camera.h>
#include <esp_heap_caps.h>
#include <esp_mac.h>
#include <Arduino.h>
#include <WiFi.h>
#include <Preferences.h>
#include "camera_init.h"
#include "debug_log.h"
#include "status_led.h"
#include "wifi_qr.h"

static AsyncWebServer server(80);
static AsyncWebSocket  ws("/ws");

static const char* s_fw_version  = "0.3.0";
static const char* s_board_model = "";
static const char* s_cam_model   = "";
static uint32_t    s_stream_count = 0;
static String      s_ws_token;
static uint32_t    s_ws_client_ids[DEFAULT_MAX_WS_CLIENTS] = {0};
static size_t      s_ws_client_count = 0;

// Push rate: 200 ms = 5 fps.
// 160×120 at q=25: ~2.2 KB/frame = 11 KB/s — stable zero-backpressure baseline at RSSI -40 dBm.
static const uint32_t FRAME_MS    = 200;
static const uint32_t PERF_LOG_MS = 5000;

// Timestamp of last successful ready-client check; used to evict stale half-open sockets.
static uint32_t s_last_ready_ms = 0;

// Rolling perf counters, reset each PERF_LOG_MS window
static uint32_t s_perf_sent       = 0;
static uint32_t s_perf_dropped    = 0;
static uint32_t s_perf_cap_sum_ms = 0;
static uint32_t s_perf_cap_max_ms = 0;
static uint32_t s_perf_jpeg_sum   = 0;
static uint32_t s_perf_jpeg_max   = 0;
static uint32_t s_perf_backpressure_skips = 0;
static uint32_t s_perf_window_ms  = 0;

// ── Token auth ────────────────────────────────────────────────────────────
static void init_ws_token() {
    Preferences p;
    p.begin("kl_auth", false);
    s_ws_token = p.getString("ws_token", "");
    if (s_ws_token.length() < 8) {
        char buf[9];
        snprintf(buf, sizeof(buf), "%08lx", (unsigned long)esp_random());
        s_ws_token = String(buf);
        p.putString("ws_token", s_ws_token);
    }
    p.end();
    kl_logf("[auth] ws_token=%s\n", s_ws_token.c_str());
}

// ── Helpers ───────────────────────────────────────────────────────────────
static int wifi_quality_percent(int rssi) {
    if (rssi <= -90) return 0;
    if (rssi >= -50) return 100;
    return 2 * (rssi + 100);
}

static const char* wifi_status_name(wl_status_t s) {
    switch (s) {
        case WL_IDLE_STATUS:      return "idle";
        case WL_NO_SSID_AVAIL:    return "no_ssid_available";
        case WL_SCAN_COMPLETED:   return "scan_completed";
        case WL_CONNECTED:        return "connected";
        case WL_CONNECT_FAILED:   return "connect_failed";
        case WL_CONNECTION_LOST:  return "connection_lost";
        case WL_DISCONNECTED:     return "disconnected";
        default:                  return "unknown";
    }
}

static String device_id() {
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    char buf[7];
    snprintf(buf, sizeof(buf), "%02x%02x%02x", mac[3], mac[4], mac[5]);
    return String(buf);
}

static String mac_string() {
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    char buf[18];
    snprintf(buf, sizeof(buf), "%02x:%02x:%02x:%02x:%02x:%02x",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    return String(buf);
}

static void ws_track_client(uint32_t client_id) {
    for (size_t i = 0; i < s_ws_client_count; i++) {
        if (s_ws_client_ids[i] == client_id) return;
    }
    if (s_ws_client_count >= DEFAULT_MAX_WS_CLIENTS) return;
    s_ws_client_ids[s_ws_client_count++] = client_id;
}

static void ws_untrack_client(uint32_t client_id) {
    for (size_t i = 0; i < s_ws_client_count; i++) {
        if (s_ws_client_ids[i] != client_id) continue;
        s_ws_client_ids[i] = s_ws_client_ids[s_ws_client_count - 1];
        s_ws_client_ids[s_ws_client_count - 1] = 0;
        s_ws_client_count--;
        return;
    }
}

static bool ws_client_ready(AsyncWebSocketClient* client) {
    // queueLen() < 2: allow one frame "in pipeline" while the previous is being sent.
    // The strict queueLen()==0 created unnecessary gaps between frames when the TCP
    // layer was momentarily busy; allowing 1 queued frame improves pipeline utilisation.
    return client &&
           client->status() == WS_CONNECTED &&
           client->queueLen() < 2 &&
           client->canSend();
}

static bool ws_has_ready_client() {
    bool has_ready = false;
    for (size_t i = 0; i < s_ws_client_count;) {
        AsyncWebSocketClient* client = ws.client(s_ws_client_ids[i]);
        if (!client || client->status() != WS_CONNECTED) {
            ws_untrack_client(s_ws_client_ids[i]);
            continue;
        }
        if (ws_client_ready(client)) has_ready = true;
        i++;
    }
    return has_ready;
}

static size_t ws_send_latest_frame(const uint8_t* buf, size_t len,
                                   uint32_t* skipped_clients) {
    size_t sent = 0;
    uint32_t skipped = 0;

    for (size_t i = 0; i < s_ws_client_count;) {
        AsyncWebSocketClient* client = ws.client(s_ws_client_ids[i]);
        if (!client || client->status() != WS_CONNECTED) {
            ws_untrack_client(s_ws_client_ids[i]);
            continue;
        }

        if (!ws_client_ready(client)) {
            skipped++;
            i++;
            continue;
        }

        if (client->binary(buf, len)) sent++;
        else skipped++;
        i++;
    }

    if (skipped_clients) *skipped_clients = skipped;
    return sent;
}

// ── WS token gate (HTTP-level, runs before AsyncWebSocket handler) ────────
class WsTokenGate : public AsyncWebHandler {
public:
    bool canHandle(AsyncWebServerRequest* req) {
        if (req->url() != "/ws") return false;
        // Valid token → let AsyncWebSocket handler take it
        if (req->hasParam("token") && req->getParam("token")->value() == s_ws_token)
            return false;
        return true; // no/wrong token → we reject it
    }
    void handleRequest(AsyncWebServerRequest* req) {
        kl_logf("[ws] REJECT unauthorized from %s\n",
                req->client()->remoteIP().toString().c_str());
        req->send(401, "text/plain", "Unauthorized");
    }
};
static WsTokenGate s_ws_gate;

// ── WebSocket event handler ───────────────────────────────────────────────
static void on_ws_event(AsyncWebSocket*, AsyncWebSocketClient* client,
                        AwsEventType type, void* arg, uint8_t*, size_t) {
    if (type == WS_EVT_CONNECT) {
        // Token already validated by WsTokenGate at HTTP upgrade phase.
        s_stream_count++;
        ws_track_client(client->id());
        status_led_set(DEVICE_STATE_STREAMING);
        kl_logf("[ws] connect id=%u ip=%s clients=%u count=%lu heap_kb=%lu psram_kb=%lu\n",
                client->id(),
                client->remoteIP().toString().c_str(),
                (unsigned)ws.count(),
                (unsigned long)s_stream_count,
                (unsigned long)(ESP.getFreeHeap() / 1024),
                (unsigned long)(ESP.getFreePsram() / 1024));
    } else if (type == WS_EVT_DISCONNECT) {
        ws_untrack_client(client->id());
        if (ws.count() == 0) status_led_set(DEVICE_STATE_READY);
        kl_logf("[ws] disconnect id=%u clients=%u heap_kb=%lu psram_kb=%lu\n",
                client->id(),
                (unsigned)ws.count(),
                (unsigned long)(ESP.getFreeHeap() / 1024),
                (unsigned long)(ESP.getFreePsram() / 1024));
    } else if (type == WS_EVT_ERROR) {
        kl_logf("[ws] error id=%u code=%u\n", client->id(), *((uint16_t*)arg));
    }
}

// ── REST handlers (async) ─────────────────────────────────────────────────
static void handle_hello(AsyncWebServerRequest* req) {
    char buf[384];
    snprintf(buf, sizeof(buf),
        "{\"v\":1,\"device_id\":\"%s\",\"fw_version\":\"%s\""
        ",\"mac\":\"%s\",\"board_model\":\"%s\",\"cam_model\":\"%s\""
        ",\"state\":\"%s\",\"ws_clients\":%u,\"uptime_s\":%lu"
        ",\"free_psram_kb\":%lu,\"ws_token\":\"%s\"}",
        device_id().c_str(), s_fw_version, mac_string().c_str(),
        s_board_model, s_cam_model, status_led_state_name(),
        (unsigned)ws.count(), (unsigned long)(millis() / 1000),
        (unsigned long)(ESP.getFreePsram() / 1024), s_ws_token.c_str());
    kl_logf("[http] GET /hello remote=%s\n",
            req->client()->remoteIP().toString().c_str());
    req->send(200, "application/json", buf);
}

static void handle_status(AsyncWebServerRequest* req) {
    char buf[768];
    snprintf(buf, sizeof(buf),
        "{\"state\":\"%s\",\"device_id\":\"%s\",\"fw_version\":\"%s\""
        ",\"cam_model\":\"%s\",\"camera_mode\":\"%s\",\"pixel_format\":\"%s\""
        ",\"frame_size\":\"%s\",\"jpeg_quality\":%d"
        ",\"ip\":\"%s\",\"rssi_dbm\":%d,\"wifi_quality\":%d"
        ",\"wifi_channel\":%d,\"wifi_bssid\":\"%s\""
        ",\"wifi_status\":%d,\"wifi_status_name\":\"%s\""
        ",\"stream_count\":%lu,\"ws_clients\":%u,\"uptime_s\":%lu"
        ",\"cpu_mhz\":%lu,\"free_heap_kb\":%lu,\"min_free_heap_kb\":%lu"
        ",\"largest_heap_block_kb\":%lu,\"free_psram_kb\":%lu"
        ",\"psram_size_kb\":%lu,\"largest_psram_block_kb\":%lu}",
        status_led_state_name(), device_id().c_str(), s_fw_version,
        s_cam_model, camera_mode_name(), camera_pixel_format_name(),
        camera_frame_size_name(), camera_jpeg_quality(),
        WiFi.localIP().toString().c_str(), WiFi.RSSI(),
        wifi_quality_percent(WiFi.RSSI()), WiFi.channel(),
        WiFi.BSSIDstr().c_str(), (int)WiFi.status(),
        wifi_status_name(WiFi.status()),
        (unsigned long)s_stream_count, (unsigned)ws.count(),
        (unsigned long)(millis() / 1000), (unsigned long)ESP.getCpuFreqMHz(),
        (unsigned long)(ESP.getFreeHeap() / 1024),
        (unsigned long)(ESP.getMinFreeHeap() / 1024),
        (unsigned long)(heap_caps_get_largest_free_block(MALLOC_CAP_8BIT) / 1024),
        (unsigned long)(ESP.getFreePsram() / 1024),
        (unsigned long)(ESP.getPsramSize() / 1024),
        (unsigned long)(heap_caps_get_largest_free_block(MALLOC_CAP_SPIRAM) / 1024));
    req->send(200, "application/json", buf);
}

// Deferred cam config — parsed in async callback, applied in http_server_handle()
// to avoid blocking the async_tcp task with slow SCCB I2C writes.
struct PendingCamConfig {
    bool active     = false;
    bool has_res    = false; String res;
    bool has_q      = false; int q          = 12;
    bool has_bright = false; int brightness = 0;
    bool has_cont   = false; int contrast   = 0;
    bool has_sat    = false; int saturation = 0;
    bool has_sharp  = false; int sharpness  = 0;
    bool has_ae     = false; int ae_level   = 0;
    bool has_vflip  = false; int vflip      = 0;
    bool has_hmir   = false; int hmirror    = 0;
};
static PendingCamConfig s_pending_cam;

static void handle_cam_config(AsyncWebServerRequest* req) {
    // Parse params — no sensor access here (would block async_tcp and trigger WDT)
    // Note: "q" (JPEG quality) is intentionally ignored — quality is fixed at
    // WIFI_JPEG_QUALITY in config.h and should not be changed at runtime.
    if (req->hasParam("res"))        { s_pending_cam.has_res   = true; s_pending_cam.res        = req->getParam("res")->value(); }
    // q is read-only — do not apply
    if (req->hasParam("brightness")) { s_pending_cam.has_bright = true; s_pending_cam.brightness = constrain(req->getParam("brightness")->value().toInt(), -2, 2); }
    if (req->hasParam("contrast"))   { s_pending_cam.has_cont  = true; s_pending_cam.contrast   = constrain(req->getParam("contrast")->value().toInt(),   -2, 2); }
    if (req->hasParam("saturation")) { s_pending_cam.has_sat   = true; s_pending_cam.saturation = constrain(req->getParam("saturation")->value().toInt(), -2, 2); }
    if (req->hasParam("sharpness"))  { s_pending_cam.has_sharp = true; s_pending_cam.sharpness  = constrain(req->getParam("sharpness")->value().toInt(),  -2, 2); }
    if (req->hasParam("ae_level"))   { s_pending_cam.has_ae    = true; s_pending_cam.ae_level   = constrain(req->getParam("ae_level")->value().toInt(),   -2, 2); }
    if (req->hasParam("vflip"))      { s_pending_cam.has_vflip = true; s_pending_cam.vflip      = req->getParam("vflip")->value().toInt() ? 1 : 0; }
    if (req->hasParam("hmirror"))    { s_pending_cam.has_hmir  = true; s_pending_cam.hmirror    = req->getParam("hmirror")->value().toInt() ? 1 : 0; }
    s_pending_cam.active = true;

    String j = "{\"ok\":true,\"scheduled\":true,\"frame_size\":\"";
    j += camera_frame_size_name();
    j += "\",\"jpeg_quality\":";
    j += camera_jpeg_quality();
    j += "}";
    req->send(200, "application/json", j);
}

static void handle_capture(AsyncWebServerRequest* req) {
    const uint32_t t0 = millis();
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb || fb->format != PIXFORMAT_JPEG || fb->len > 256 * 1024) {
        if (fb) esp_camera_fb_return(fb);
        req->send(503, "application/json", "{\"ok\":false,\"error\":\"capture_failed\"}");
        return;
    }
    // beginResponseStream buffers the payload; fb can be returned immediately after write()
    AsyncResponseStream* resp = req->beginResponseStream("image/jpeg");
    resp->addHeader("Cache-Control", "no-store");
    resp->write(fb->buf, fb->len);
    const uint32_t cap_ms = millis() - t0;
    esp_camera_fb_return(fb);
    req->send(resp);
    if (cap_ms >= 100) {
        kl_logf("[warn] capture_slow cap_ms=%lu\n", (unsigned long)cap_ms);
    }
}

static void handle_end_session(AsyncWebServerRequest* req) {
    req->send(200, "application/json",
              "{\"ok\":true,\"action\":\"clear_wifi_and_reboot\"}");
    kl_logln("[session] end requested; clearing credentials and rebooting");
    wifi_clear_credentials();
    delay(300);
    ESP.restart();
}

static void handle_mode_switch(AsyncWebServerRequest* req) {
    String m = req->hasParam("set") ? req->getParam("set")->value() : "";
    if (m != "wifi" && m != "ble") {
        req->send(400, "application/json", "{\"ok\":false,\"error\":\"use ?set=wifi or ?set=ble\"}");
        return;
    }
    Preferences p;
    p.begin("kl_mode", false);
    p.putString("mode", m);
    p.end();
    kl_logf("[mode] switching_to=%s action=reboot\n", m.c_str());
    req->send(200, "application/json",
              String("{\"ok\":true,\"switching_to\":\"") + m + "\"}");
    delay(300);
    ESP.restart();
}

// ── Public API ────────────────────────────────────────────────────────────
void http_server_start(const char* fw_version, const char* board_model,
                       const char* cam_model) {
    s_fw_version     = fw_version;
    s_board_model    = board_model;
    s_cam_model      = cam_model;
    s_perf_window_ms = millis();
    init_ws_token();

    // Add CORS to every response (preflight + actual)
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin",  "*");
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "*");
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Private-Network", "true");

    // WebSocket — gate must be added BEFORE ws so it intercepts unauthorized upgrades first
    ws.onEvent(on_ws_event);
    server.addHandler(&s_ws_gate);
    server.addHandler(&ws);

    // REST
    server.on("/hello",   HTTP_GET,              handle_hello);
    server.on("/status",  HTTP_GET,              handle_status);
    server.on("/capture", HTTP_GET,              handle_capture);
    server.on("/cam",     HTTP_GET | HTTP_POST,  handle_cam_config);
    server.on("/end",     HTTP_GET | HTTP_POST,  handle_end_session);
    server.on("/mode",    HTTP_GET | HTTP_POST,  handle_mode_switch);

    // OPTIONS preflight + 404
    server.onNotFound([](AsyncWebServerRequest* req) {
        if (req->method() == HTTP_OPTIONS) req->send(204);
        else req->send(404, "text/plain", "Not found");
    });

    server.begin();

    String mdns_name = "fitcam-" + device_id();
    if (MDNS.begin(mdns_name.c_str())) {
        MDNS.addService("http", "tcp", 80);
        MDNS.addServiceTxt("http", "tcp", "device_id", device_id());
        kl_logf("[network] mdns=http://%s.local/\n", mdns_name.c_str());
    }
    kl_logf("[http] ready ip=http://%s ws=ws://%s/ws "
            "endpoints=/hello,/status,/capture,/cam,/end,/ws\n",
            WiFi.localIP().toString().c_str(),
            WiFi.localIP().toString().c_str());
}

void http_server_handle() {
    // Reclaim memory from closed WS connections; must be called from main task.
    ws.cleanupClients();

    // Apply deferred cam config — SCCB writes run here in loopTask, not in async_tcp.
    if (s_pending_cam.active) {
        s_pending_cam.active = false;
        sensor_t* s = esp_camera_sensor_get();
        if (s) {
            if (s_pending_cam.has_res)   camera_set_framesize(s_pending_cam.res.c_str());
            // has_q intentionally skipped — quality is fixed at WIFI_JPEG_QUALITY
            if (s_pending_cam.has_bright) s->set_brightness(s, s_pending_cam.brightness);
            if (s_pending_cam.has_cont)   s->set_contrast(s,   s_pending_cam.contrast);
            if (s_pending_cam.has_sat)    s->set_saturation(s, s_pending_cam.saturation);
            if (s_pending_cam.has_sharp)  s->set_sharpness(s,  s_pending_cam.sharpness);
            if (s_pending_cam.has_ae)     s->set_ae_level(s,   s_pending_cam.ae_level);
            if (s_pending_cam.has_vflip)  s->set_vflip(s,      s_pending_cam.vflip);
            if (s_pending_cam.has_hmir)   s->set_hmirror(s,    s_pending_cam.hmirror);
            // Reset field flags for next request
            s_pending_cam = PendingCamConfig{};
            kl_logf("[http] cam_config applied res=%s q=%d\n",
                    camera_frame_size_name(), camera_jpeg_quality());
        }
    }
}

void http_server_push_frame() {
    // Rate-limit first, regardless of client count.
    // This keeps esp_camera_fb_get() called at FRAME_MS even when idle so the OV2640
    // DMA pipeline (fb_count=2) never stalls — a stalled pipeline causes slow/corrupt
    // first frames after reconnection following long idle periods.
    static uint32_t last_ms = 0;
    const uint32_t now = millis();
    if (now - last_ms < FRAME_MS) return;
    last_ms = now;

    if (ws.count() == 0) {
        // No clients — drain and discard one frame to keep camera DMA warm.
        camera_fb_t* fb = esp_camera_fb_get();
        if (fb) esp_camera_fb_return(fb);
        return;
    }

    if (!ws_has_ready_client()) {
        s_perf_dropped++;
        s_perf_backpressure_skips += ws.count();
        // Stale socket eviction: if clients exist but none has been ready for
        // 20 s, they are half-open (browser closed, TCP RST missed, 1006, etc.).
        // 20 s avoids false eviction during legitimate backpressure bursts (brief WiFi dips);
        // client auto-reconnects within 2 s after receiving the close frame.
        if (ws.count() > 0 && s_last_ready_ms > 0 &&
            now - s_last_ready_ms >= 20000) {
            kl_logf("[ws] stale_evict clients=%u not_ready_ms=%lu action=closeAll\n",
                    (unsigned)ws.count(), now - s_last_ready_ms);
            ws.closeAll();
            s_last_ready_ms = now; // reset so we don't evict again immediately
        }
        return;
    }
    s_last_ready_ms = now;

    const uint32_t cap_t0 = millis();
    camera_fb_t* fb = esp_camera_fb_get();
    const uint32_t cap_ms = millis() - cap_t0;

    if (!fb || fb->format != PIXFORMAT_JPEG || fb->len > 256 * 1024) {
        if (fb) esp_camera_fb_return(fb);
        s_perf_dropped++;
        if (cap_ms >= 100) {
            kl_logf("[warn] ws_capture_failed cap_ms=%lu heap_kb=%lu psram_kb=%lu\n",
                    (unsigned long)cap_ms,
                    (unsigned long)(ESP.getFreeHeap() / 1024),
                    (unsigned long)(ESP.getFreePsram() / 1024));
        }
        return;
    }

    // Keep the live stream realtime: send only to clients with an empty queue.
    // Slow clients skip this frame instead of accumulating stale JPEGs.
    uint32_t skipped_clients = 0;
    const size_t sent_clients = ws_send_latest_frame(fb->buf, fb->len,
                                                     &skipped_clients);
    const size_t jpeg_len = fb->len;
    esp_camera_fb_return(fb); // safe: binary() already copied/enqueued the data
    s_perf_backpressure_skips += skipped_clients;
    if (sent_clients == 0) {
        s_perf_dropped++;
        return;
    }

    // Accumulate perf stats
    s_perf_sent++;
    s_perf_cap_sum_ms += cap_ms;
    if (cap_ms > s_perf_cap_max_ms) s_perf_cap_max_ms = cap_ms;
    s_perf_jpeg_sum += jpeg_len;
    if (jpeg_len > s_perf_jpeg_max) s_perf_jpeg_max = jpeg_len;

    const uint32_t elapsed = now - s_perf_window_ms;
    if (elapsed >= PERF_LOG_MS) {
        const uint32_t avg_cap  = s_perf_sent ? s_perf_cap_sum_ms / s_perf_sent : 0;
        const uint32_t avg_jpeg = s_perf_sent ? s_perf_jpeg_sum   / s_perf_sent : 0;
        kl_logf("[ws] perf elapsed_ms=%lu sent=%lu dropped=%lu fps=%.1f "
                "cap_avg_ms=%lu cap_max_ms=%lu jpeg_avg=%lu jpeg_max=%lu "
                "clients=%u backpressure_skips=%lu rssi=%d quality=%d "
                "heap_kb=%lu psram_kb=%lu\n",
                (unsigned long)elapsed,
                (unsigned long)s_perf_sent,
                (unsigned long)s_perf_dropped,
                s_perf_sent * 1000.0f / (float)elapsed,
                (unsigned long)avg_cap,
                (unsigned long)s_perf_cap_max_ms,
                (unsigned long)avg_jpeg,
                (unsigned long)s_perf_jpeg_max,
                (unsigned)ws.count(),
                (unsigned long)s_perf_backpressure_skips,
                WiFi.RSSI(),
                wifi_quality_percent(WiFi.RSSI()),
                (unsigned long)(ESP.getFreeHeap() / 1024),
                (unsigned long)(ESP.getFreePsram() / 1024));
        s_perf_sent = s_perf_dropped = 0;
        s_perf_cap_sum_ms = s_perf_cap_max_ms = 0;
        s_perf_jpeg_sum = s_perf_jpeg_max = 0;
        s_perf_backpressure_skips = 0;
        s_perf_window_ms = now;
    }
}

uint32_t http_server_stream_count() { return s_stream_count; }
