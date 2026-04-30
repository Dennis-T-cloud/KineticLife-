#include "http_server.h"
#include <ESPAsyncWebServer.h>
#include <ESPmDNS.h>
#include <esp_camera.h>
#include <esp_heap_caps.h>
#include <esp_mac.h>
#include <Arduino.h>
#include <WiFi.h>
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

// Push rate: 67 ms ≈ 15 fps
static const uint32_t FRAME_MS    = 67;
static const uint32_t PERF_LOG_MS = 5000;

// Rolling perf counters, reset each PERF_LOG_MS window
static uint32_t s_perf_sent       = 0;
static uint32_t s_perf_dropped    = 0;
static uint32_t s_perf_cap_sum_ms = 0;
static uint32_t s_perf_cap_max_ms = 0;
static uint32_t s_perf_jpeg_sum   = 0;
static uint32_t s_perf_jpeg_max   = 0;
static uint32_t s_perf_window_ms  = 0;

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

// ── WebSocket event handler ───────────────────────────────────────────────
static void on_ws_event(AsyncWebSocket*, AsyncWebSocketClient* client,
                        AwsEventType type, void* arg, uint8_t*, size_t) {
    if (type == WS_EVT_CONNECT) {
        s_stream_count++;
        status_led_set(DEVICE_STATE_STREAMING);
        kl_logf("[ws] connect id=%u ip=%s clients=%u count=%lu heap_kb=%lu psram_kb=%lu\n",
                client->id(),
                client->remoteIP().toString().c_str(),
                (unsigned)ws.count(),
                (unsigned long)s_stream_count,
                (unsigned long)(ESP.getFreeHeap() / 1024),
                (unsigned long)(ESP.getFreePsram() / 1024));
    } else if (type == WS_EVT_DISCONNECT) {
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
    String j = "{\"v\":1";
    j += ",\"device_id\":\"" + device_id() + "\"";
    j += ",\"fw_version\":\"" + String(s_fw_version) + "\"";
    j += ",\"mac\":\"" + mac_string() + "\"";
    j += ",\"board_model\":\"" + String(s_board_model) + "\"";
    j += ",\"cam_model\":\"" + String(s_cam_model) + "\"";
    j += ",\"state\":\"" + String(status_led_state_name()) + "\"";
    j += ",\"ws_clients\":" + String(ws.count());
    j += ",\"uptime_s\":" + String(millis() / 1000);
    j += ",\"free_psram_kb\":" + String(ESP.getFreePsram() / 1024);
    j += "}";
    kl_logf("[http] GET /hello remote=%s\n",
            req->client()->remoteIP().toString().c_str());
    req->send(200, "application/json", j);
}

static void handle_status(AsyncWebServerRequest* req) {
    String j = "{\"state\":\"" + String(status_led_state_name()) + "\"";
    j += ",\"device_id\":\"" + device_id() + "\"";
    j += ",\"fw_version\":\"" + String(s_fw_version) + "\"";
    j += ",\"cam_model\":\"" + String(s_cam_model) + "\"";
    j += ",\"camera_mode\":\"" + String(camera_mode_name()) + "\"";
    j += ",\"pixel_format\":\"" + String(camera_pixel_format_name()) + "\"";
    j += ",\"frame_size\":\"" + String(camera_frame_size_name()) + "\"";
    j += ",\"jpeg_quality\":" + String(camera_jpeg_quality());
    j += ",\"ip\":\"" + WiFi.localIP().toString() + "\"";
    j += ",\"rssi_dbm\":" + String(WiFi.RSSI());
    j += ",\"wifi_quality\":" + String(wifi_quality_percent(WiFi.RSSI()));
    j += ",\"wifi_channel\":" + String(WiFi.channel());
    j += ",\"wifi_bssid\":\"" + WiFi.BSSIDstr() + "\"";
    j += ",\"wifi_status\":" + String((int)WiFi.status());
    j += ",\"wifi_status_name\":\"" + String(wifi_status_name(WiFi.status())) + "\"";
    j += ",\"stream_count\":" + String(s_stream_count);
    j += ",\"ws_clients\":" + String(ws.count());
    j += ",\"uptime_s\":" + String(millis() / 1000);
    j += ",\"cpu_mhz\":" + String(ESP.getCpuFreqMHz());
    j += ",\"free_heap_kb\":" + String(ESP.getFreeHeap() / 1024);
    j += ",\"min_free_heap_kb\":" + String(ESP.getMinFreeHeap() / 1024);
    j += ",\"largest_heap_block_kb\":" + String(heap_caps_get_largest_free_block(MALLOC_CAP_8BIT) / 1024);
    j += ",\"free_psram_kb\":" + String(ESP.getFreePsram() / 1024);
    j += ",\"psram_size_kb\":" + String(ESP.getPsramSize() / 1024);
    j += ",\"largest_psram_block_kb\":" + String(heap_caps_get_largest_free_block(MALLOC_CAP_SPIRAM) / 1024);
    j += "}";
    req->send(200, "application/json", j);
}

static void handle_cam_config(AsyncWebServerRequest* req) {
    sensor_t* s = esp_camera_sensor_get();
    if (!s) {
        req->send(503, "application/json", "{\"ok\":false,\"error\":\"no_sensor\"}");
        return;
    }
    if (req->hasParam("res")) camera_set_framesize(req->getParam("res")->value().c_str());
    if (req->hasParam("q"))   camera_set_quality(req->getParam("q")->value().toInt());
    if (req->hasParam("brightness"))
        s->set_brightness(s, constrain(req->getParam("brightness")->value().toInt(), -2, 2));
    if (req->hasParam("contrast"))
        s->set_contrast(s,   constrain(req->getParam("contrast")->value().toInt(), -2, 2));

    String j = "{\"ok\":true,\"frame_size\":\"";
    j += camera_frame_size_name();
    j += "\",\"jpeg_quality\":";
    j += camera_jpeg_quality();
    j += "}";
    kl_logf("[http] cam_config res=%s q=%d\n",
            camera_frame_size_name(), camera_jpeg_quality());
    req->send(200, "application/json", j);
}

static void handle_capture(AsyncWebServerRequest* req) {
    const uint32_t t0 = millis();
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb || fb->format != PIXFORMAT_JPEG || fb->len > 128 * 1024) {
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

// ── Public API ────────────────────────────────────────────────────────────
void http_server_start(const char* fw_version, const char* board_model,
                       const char* cam_model) {
    s_fw_version     = fw_version;
    s_board_model    = board_model;
    s_cam_model      = cam_model;
    s_perf_window_ms = millis();

    // Add CORS to every response (preflight + actual)
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin",  "*");
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "*");

    // WebSocket
    ws.onEvent(on_ws_event);
    server.addHandler(&ws);

    // REST
    server.on("/hello",   HTTP_GET,              handle_hello);
    server.on("/status",  HTTP_GET,              handle_status);
    server.on("/capture", HTTP_GET,              handle_capture);
    server.on("/cam",     HTTP_GET | HTTP_POST,  handle_cam_config);
    server.on("/end",     HTTP_GET | HTTP_POST,  handle_end_session);

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
}

void http_server_push_frame() {
    if (ws.count() == 0) return;

    // Rate-limit to FRAME_MS
    static uint32_t last_ms = 0;
    const uint32_t now = millis();
    if (now - last_ms < FRAME_MS) return;

    const uint32_t cap_t0 = millis();
    camera_fb_t* fb = esp_camera_fb_get();
    const uint32_t cap_ms = millis() - cap_t0;

    if (!fb || fb->format != PIXFORMAT_JPEG || fb->len > 128 * 1024) {
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

    // Non-blocking broadcast: binaryAll() copies data into internal queue and
    // returns immediately. If a client's queue is full, that client's frame is
    // silently dropped — exactly the right backpressure for live video.
    ws.binaryAll(fb->buf, fb->len);
    const size_t jpeg_len = fb->len;
    esp_camera_fb_return(fb); // safe: binaryAll() already copied the data
    last_ms = now;

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
                "clients=%u rssi=%d quality=%d heap_kb=%lu psram_kb=%lu\n",
                (unsigned long)elapsed,
                (unsigned long)s_perf_sent,
                (unsigned long)s_perf_dropped,
                s_perf_sent * 1000.0f / (float)elapsed,
                (unsigned long)avg_cap,
                (unsigned long)s_perf_cap_max_ms,
                (unsigned long)avg_jpeg,
                (unsigned long)s_perf_jpeg_max,
                (unsigned)ws.count(),
                WiFi.RSSI(),
                wifi_quality_percent(WiFi.RSSI()),
                (unsigned long)(ESP.getFreeHeap() / 1024),
                (unsigned long)(ESP.getFreePsram() / 1024));
        s_perf_sent = s_perf_dropped = 0;
        s_perf_cap_sum_ms = s_perf_cap_max_ms = 0;
        s_perf_jpeg_sum = s_perf_jpeg_max = 0;
        s_perf_window_ms = now;
    }
}

uint32_t http_server_stream_count() { return s_stream_count; }
