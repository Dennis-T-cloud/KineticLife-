#include "http_server.h"
#include <WebServer.h>
#include <ESPmDNS.h>
#include <esp_camera.h>
#include <esp_heap_caps.h>
#include <esp_mac.h>
#include <Arduino.h>
#include <WiFi.h>
#include "camera_init.h"
#include "status_led.h"
#include "wifi_qr.h"

static WebServer server(80);

static const char* s_fw_version  = "0.3.0";
static const char* s_board_model = "";
static const char* s_cam_model   = "";
static uint32_t s_stream_count = 0;
static bool s_streaming = false;

static const uint32_t STREAM_PERF_LOG_MS = 5000;
static const uint32_t STREAM_SLOW_CAPTURE_MS = 80;
static const uint32_t STREAM_SLOW_WRITE_MS = 120;

static const char* wifi_status_name(wl_status_t status) {
    switch (status) {
        case WL_IDLE_STATUS: return "idle";
        case WL_NO_SSID_AVAIL: return "no_ssid_available";
        case WL_SCAN_COMPLETED: return "scan_completed";
        case WL_CONNECTED: return "connected";
        case WL_CONNECT_FAILED: return "connect_failed";
        case WL_CONNECTION_LOST: return "connection_lost";
        case WL_DISCONNECTED: return "disconnected";
        default: return "unknown";
    }
}

static int wifi_quality_percent(int rssi) {
    if (rssi <= -90) return 0;
    if (rssi >= -50) return 100;
    return 2 * (rssi + 100);
}

struct StreamPerfStats {
    uint32_t window_start_ms = 0;
    uint32_t frames = 0;
    uint32_t dropped = 0;
    uint32_t slow_capture = 0;
    uint32_t slow_write = 0;
    uint32_t capture_sum_ms = 0;
    uint32_t capture_max_ms = 0;
    uint32_t write_sum_ms = 0;
    uint32_t write_max_ms = 0;
    uint32_t loop_sum_ms = 0;
    uint32_t loop_max_ms = 0;
    uint32_t jpeg_sum_bytes = 0;
    uint32_t jpeg_max_bytes = 0;
};

static void stream_perf_reset(StreamPerfStats* stats, uint32_t now_ms) {
    *stats = StreamPerfStats();
    stats->window_start_ms = now_ms;
}

static void stream_perf_log(StreamPerfStats* stats, const WiFiClient& client,
                            uint32_t now_ms, bool force, bool enabled) {
    if (!enabled) return;
    const uint32_t elapsed_ms = now_ms - stats->window_start_ms;
    if (!force && elapsed_ms < STREAM_PERF_LOG_MS) return;
    if (elapsed_ms == 0) return;

    const float fps = stats->frames * 1000.0f / elapsed_ms;
    const uint32_t avg_capture = stats->frames ? stats->capture_sum_ms / stats->frames : 0;
    const uint32_t avg_write = stats->frames ? stats->write_sum_ms / stats->frames : 0;
    const uint32_t avg_loop = stats->frames ? stats->loop_sum_ms / stats->frames : 0;
    const uint32_t avg_jpeg = stats->frames ? stats->jpeg_sum_bytes / stats->frames : 0;
    const int rssi = WiFi.RSSI();

    Serial.printf("[perf] stream remote=%s elapsed_ms=%lu frames=%lu fps=%.1f dropped=%lu "
                  "capture_ms_avg=%lu capture_ms_max=%lu write_ms_avg=%lu write_ms_max=%lu "
                  "loop_ms_avg=%lu loop_ms_max=%lu jpeg_avg=%lu jpeg_max=%lu "
                  "slow_capture=%lu slow_write=%lu wifi=%d/%s rssi=%d quality=%d channel=%d "
                  "heap_kb=%lu min_heap_kb=%lu psram_free_kb=%lu psram_largest_kb=%lu\n",
                  client.remoteIP().toString().c_str(),
                  (unsigned long)elapsed_ms,
                  (unsigned long)stats->frames,
                  fps,
                  (unsigned long)stats->dropped,
                  (unsigned long)avg_capture,
                  (unsigned long)stats->capture_max_ms,
                  (unsigned long)avg_write,
                  (unsigned long)stats->write_max_ms,
                  (unsigned long)avg_loop,
                  (unsigned long)stats->loop_max_ms,
                  (unsigned long)avg_jpeg,
                  (unsigned long)stats->jpeg_max_bytes,
                  (unsigned long)stats->slow_capture,
                  (unsigned long)stats->slow_write,
                  (int)WiFi.status(),
                  wifi_status_name(WiFi.status()),
                  rssi,
                  wifi_quality_percent(rssi),
                  WiFi.channel(),
                  (unsigned long)(ESP.getFreeHeap() / 1024),
                  (unsigned long)(ESP.getMinFreeHeap() / 1024),
                  (unsigned long)(ESP.getFreePsram() / 1024),
                  (unsigned long)(heap_caps_get_largest_free_block(MALLOC_CAP_SPIRAM) / 1024));

    stream_perf_reset(stats, now_ms);
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

static void handle_hello() {
    Serial.printf("[http] GET /hello remote=%s\n",
                  server.client().remoteIP().toString().c_str());
    server.sendHeader("Access-Control-Allow-Origin", "*");

    String json = "{";
    json += "\"v\":1,";
    json += "\"device_id\":\"" + device_id() + "\",";
    json += "\"fw_version\":\"" + String(s_fw_version) + "\",";
    json += "\"mac\":\"" + mac_string() + "\",";
    json += "\"board_model\":\"" + String(s_board_model) + "\",";
    json += "\"cam_model\":\"" + String(s_cam_model) + "\",";
    json += "\"state\":\"" + String(status_led_state_name()) + "\",";
    json += "\"supported_resolutions\":[\"160x120@20\",\"240x240@15\",\"320x240@10\"],";
    json += "\"default_resolution\":\"240x240@15\",";
    json += "\"uptime_s\":" + String(millis() / 1000) + ",";
    json += "\"free_psram_kb\":" + String(ESP.getFreePsram() / 1024);
    json += "}";

    server.send(200, "application/json", json);
}

static void handle_status() {
    static unsigned long last_status_request_log_ms = 0;
    if (millis() - last_status_request_log_ms >= 10000) {
        last_status_request_log_ms = millis();
        Serial.printf("[http] GET /status remote=%s state=%s ip=%s wifi=%d/%s rssi=%d quality=%d channel=%d camera=%s/%s/%s q=%d heap_kb=%lu psram_kb=%lu\n",
                      server.client().remoteIP().toString().c_str(),
                      status_led_state_name(),
                      WiFi.localIP().toString().c_str(),
                      (int)WiFi.status(),
                      wifi_status_name(WiFi.status()),
                      WiFi.RSSI(),
                      wifi_quality_percent(WiFi.RSSI()),
                      WiFi.channel(),
                      camera_mode_name(),
                      camera_pixel_format_name(),
                      camera_frame_size_name(),
                      camera_jpeg_quality(),
                      (unsigned long)(ESP.getFreeHeap() / 1024),
                      (unsigned long)(ESP.getFreePsram() / 1024));
    }
    server.sendHeader("Access-Control-Allow-Origin", "*");

    String json = "{";
    json += "\"state\":\"" + String(status_led_state_name()) + "\",";
    json += "\"device_id\":\"" + device_id() + "\",";
    json += "\"fw_version\":\"" + String(s_fw_version) + "\",";
    json += "\"board_model\":\"" + String(s_board_model) + "\",";
    json += "\"cam_model\":\"" + String(s_cam_model) + "\",";
    json += "\"camera_mode\":\"" + String(camera_mode_name()) + "\",";
    json += "\"pixel_format\":\"" + String(camera_pixel_format_name()) + "\",";
    json += "\"frame_size\":\"" + String(camera_frame_size_name()) + "\",";
    json += "\"jpeg_quality\":" + String(camera_jpeg_quality()) + ",";
    json += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
    json += "\"rssi_dbm\":" + String(WiFi.RSSI()) + ",";
    json += "\"wifi_quality\":" + String(wifi_quality_percent(WiFi.RSSI())) + ",";
    json += "\"wifi_channel\":" + String(WiFi.channel()) + ",";
    json += "\"wifi_bssid\":\"" + WiFi.BSSIDstr() + "\",";
    json += "\"wifi_status\":" + String((int)WiFi.status()) + ",";
    json += "\"wifi_status_name\":\"" + String(wifi_status_name(WiFi.status())) + "\",";
    json += "\"stream_count\":" + String(s_stream_count) + ",";
    json += "\"uptime_s\":" + String(millis() / 1000) + ",";
    json += "\"cpu_mhz\":" + String(ESP.getCpuFreqMHz()) + ",";
    json += "\"free_heap_kb\":" + String(ESP.getFreeHeap() / 1024) + ",";
    json += "\"min_free_heap_kb\":" + String(ESP.getMinFreeHeap() / 1024) + ",";
    json += "\"largest_heap_block_kb\":" + String(heap_caps_get_largest_free_block(MALLOC_CAP_8BIT) / 1024) + ",";
    json += "\"free_psram_kb\":" + String(ESP.getFreePsram() / 1024) + ",";
    json += "\"psram_size_kb\":" + String(ESP.getPsramSize() / 1024) + ",";
    json += "\"largest_psram_block_kb\":" + String(heap_caps_get_largest_free_block(MALLOC_CAP_SPIRAM) / 1024);
    json += "}";

    server.send(200, "application/json", json);
}

static void handle_cam_config() {
    server.sendHeader("Access-Control-Allow-Origin", "*");

    sensor_t* s = esp_camera_sensor_get();
    if (!s) {
        server.send(503, "application/json", "{\"ok\":false,\"error\":\"no_sensor\"}");
        return;
    }

    if (server.hasArg("res"))        camera_set_framesize(server.arg("res").c_str());
    if (server.hasArg("q"))          camera_set_quality(server.arg("q").toInt());
    if (server.hasArg("brightness")) s->set_brightness(s, constrain(server.arg("brightness").toInt(), -2, 2));
    if (server.hasArg("contrast"))   s->set_contrast(s,   constrain(server.arg("contrast").toInt(),   -2, 2));

    String json = "{\"ok\":true,\"frame_size\":\"";
    json += camera_frame_size_name();
    json += "\",\"jpeg_quality\":";
    json += camera_jpeg_quality();
    json += "}";
    Serial.printf("[http] cam_config res=%s q=%d\n",
                  camera_frame_size_name(), camera_jpeg_quality());
    server.send(200, "application/json", json);
}

static void handle_end_session() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json", "{\"ok\":true,\"action\":\"clear_wifi_and_reboot\"}");
    Serial.println("[session] end requested; clearing credentials and rebooting");
    wifi_clear_credentials();
    delay(300);
    ESP.restart();
}

static bool apply_stream_args();

static void handle_capture() {
    WiFiClient client = server.client();
    const uint32_t t0 = millis();
    camera_fb_t* fb = esp_camera_fb_get();
    const uint32_t capture_ms = millis() - t0;
    if (!fb || fb->format != PIXFORMAT_JPEG || fb->len > 128 * 1024) {
        if (fb) esp_camera_fb_return(fb);
        client.print(
            "HTTP/1.1 503 Service Unavailable\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "Content-Length: 0\r\n\r\n"
        );
        return;
    }
    char header[192];
    snprintf(header, sizeof(header),
             "HTTP/1.1 200 OK\r\n"
             "Access-Control-Allow-Origin: *\r\n"
             "Content-Type: image/jpeg\r\n"
             "Content-Length: %u\r\n"
             "Cache-Control: no-store\r\n"
             "Connection: keep-alive\r\n\r\n",
             (unsigned)fb->len);
    client.print(header);
    client.write(fb->buf, fb->len);
    esp_camera_fb_return(fb);
    if (capture_ms >= 100) {
        Serial.printf("[warn] capture_slow capture_ms=%lu jpeg_bytes=%u heap_kb=%lu\n",
                      (unsigned long)capture_ms, (unsigned)fb->len,
                      (unsigned long)(ESP.getFreeHeap() / 1024));
    }
}

static bool apply_stream_args() {
    if (server.hasArg("res")) {
        String res = server.arg("res");
        const int at = res.indexOf('@');
        if (at >= 0) res = res.substring(0, at);

        if (!camera_set_framesize(res.c_str())) {
            server.sendHeader("Access-Control-Allow-Origin", "*");
            server.send(400, "application/json", "{\"error\":\"invalid_resolution\"}");
            return false;
        }
    }

    if (server.hasArg("q") && !camera_set_quality(server.arg("q").toInt())) {
        server.sendHeader("Access-Control-Allow-Origin", "*");
        server.send(400, "application/json", "{\"error\":\"invalid_quality\"}");
        return false;
    }

    sensor_t* s = esp_camera_sensor_get();
    if (s) {
        if (server.hasArg("brightness")) {
            s->set_brightness(s, constrain(server.arg("brightness").toInt(), -2, 2));
        }
        if (server.hasArg("contrast")) {
            s->set_contrast(s, constrain(server.arg("contrast").toInt(), -2, 2));
        }
    }

    return true;
}

static void handle_stream() {
    if (s_streaming) {
        server.sendHeader("Access-Control-Allow-Origin", "*");
        server.send(503, "application/json", "{\"error\":\"stream_busy\"}");
        return;
    }
    if (!apply_stream_args()) return;

    s_streaming = true;
    WiFiClient client = server.client();
    client.setNoDelay(true);
    s_stream_count++;
    const bool perf_enabled = server.hasArg("perf") && server.arg("perf") != "0";
    const String remote_ip = client.remoteIP().toString();
    Serial.printf("[stream] client connected count=%lu remote=%s url=/stream res=%s q=%d perf=%d wifi=%d/%s rssi=%d quality=%d channel=%d heap_kb=%lu psram_free_kb=%lu psram_size_kb=%lu\n",
                  (unsigned long)s_stream_count,
                  remote_ip.c_str(),
                  camera_frame_size_name(),
                  camera_jpeg_quality(),
                  perf_enabled ? 1 : 0,
                  (int)WiFi.status(),
                  wifi_status_name(WiFi.status()),
                  WiFi.RSSI(),
                  wifi_quality_percent(WiFi.RSSI()),
                  WiFi.channel(),
                  (unsigned long)(ESP.getFreeHeap() / 1024),
                  (unsigned long)(ESP.getFreePsram() / 1024),
                  (unsigned long)(ESP.getPsramSize() / 1024));
    Serial.flush();
    status_led_set(DEVICE_STATE_STREAMING);

    client.print(
        "HTTP/1.1 200 OK\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Content-Type: multipart/x-mixed-replace; boundary=frame\r\n"
        "Connection: keep-alive\r\n\r\n"
    );

    uint32_t frame_id = 0;
    const uint32_t stream_start_ms = millis();
    bool logged_first_frame = false;
    StreamPerfStats perf;
    stream_perf_reset(&perf, stream_start_ms);

    while (client.connected()) {
        const uint32_t loop_start_ms = millis();
        // Do not call server.handleClient() while streaming. Arduino WebServer is
        // synchronous; re-entering it during the long-lived stream lets /status
        // and /cam compete with the MJPEG socket and causes browser fetch aborts.

        const uint32_t capture_start_ms = millis();
        camera_fb_t* fb = esp_camera_fb_get();
        const uint32_t capture_ms = millis() - capture_start_ms;
        if (!fb) {
            perf.dropped++;
            if (capture_ms >= STREAM_SLOW_CAPTURE_MS) {
                perf.slow_capture++;
                Serial.printf("[warn] stream_capture_failed capture_ms=%lu heap_kb=%lu psram_kb=%lu\n",
                              (unsigned long)capture_ms,
                              (unsigned long)(ESP.getFreeHeap() / 1024),
                              (unsigned long)(ESP.getFreePsram() / 1024));
            }
            delay(10);
            stream_perf_log(&perf, client, millis(), false, perf_enabled);
            continue;
        }

        // Drop oversized frames (contract: max 128 KB)
        if (fb->len > 128 * 1024) {
            perf.dropped++;
            Serial.printf("[warn] stream_drop_oversized frame_bytes=%u limit=131072 q=%d res=%s\n",
                          (unsigned)fb->len,
                          camera_jpeg_quality(),
                          camera_frame_size_name());
            esp_camera_fb_return(fb);
            stream_perf_log(&perf, client, millis(), false, perf_enabled);
            continue;
        }

        int64_t ts_ms = esp_timer_get_time() / 1000LL;
        char header[192];
        int hlen = snprintf(header, sizeof(header),
            "--frame\r\n"
            "Content-Type: image/jpeg\r\n"
            "Content-Length: %u\r\n"
            "X-Frame-Id: %u\r\n"
            "X-Timestamp-Ms: %lld\r\n\r\n",
            (unsigned)fb->len, frame_id++, ts_ms);

        const uint32_t write_start_ms = millis();
        const size_t written_header = client.write((const uint8_t*)header, hlen);
        const size_t written_frame = client.write(fb->buf, fb->len);
        const size_t written_tail = client.write((const uint8_t*)"\r\n", 2);
        const uint32_t write_ms = millis() - write_start_ms;

        const size_t frame_len = fb->len;
        esp_camera_fb_return(fb);

        if (!logged_first_frame) {
            logged_first_frame = true;
            Serial.printf("[perf] stream_first_frame remote=%s first_frame_ms=%lu capture_ms=%lu write_ms=%lu jpeg_bytes=%u\n",
                          remote_ip.c_str(),
                          (unsigned long)(millis() - stream_start_ms),
                          (unsigned long)capture_ms,
                          (unsigned long)write_ms,
                          (unsigned)frame_len);
            Serial.flush();
        }

        const uint32_t loop_ms = millis() - loop_start_ms;
        perf.frames++;
        perf.capture_sum_ms += capture_ms;
        perf.capture_max_ms = max(perf.capture_max_ms, capture_ms);
        perf.write_sum_ms += write_ms;
        perf.write_max_ms = max(perf.write_max_ms, write_ms);
        perf.loop_sum_ms += loop_ms;
        perf.loop_max_ms = max(perf.loop_max_ms, loop_ms);
        perf.jpeg_sum_bytes += frame_len;
        perf.jpeg_max_bytes = max(perf.jpeg_max_bytes, (uint32_t)frame_len);
        if (capture_ms >= STREAM_SLOW_CAPTURE_MS) perf.slow_capture++;
        if (write_ms >= STREAM_SLOW_WRITE_MS) perf.slow_write++;

        // Always warn on slow/short write — TCP backpressure from browser being busy
        if (write_ms >= STREAM_SLOW_WRITE_MS ||
            written_header != (size_t)hlen ||
            written_frame != frame_len ||
            written_tail != 2) {
            Serial.printf("[warn] write_slow frame=%lu write_ms=%lu jpeg=%u wrote=%u rssi=%d heap_kb=%lu\n",
                          (unsigned long)(frame_id - 1),
                          (unsigned long)write_ms,
                          (unsigned)frame_len,
                          (unsigned)written_frame,
                          WiFi.RSSI(),
                          (unsigned long)(ESP.getFreeHeap() / 1024));
        }

        // Always-on brief stats every ~30 frames (~1.5s at 20fps)
        if (perf.frames > 0 && perf.frames % 30 == 0) {
            Serial.printf("[stream] frames=%lu fps=%.1f write_avg=%lu write_max=%lu capture_avg=%lu dropped=%lu rssi=%d heap_kb=%lu\n",
                          (unsigned long)perf.frames,
                          perf.frames * 1000.0f / max(1UL, (unsigned long)(millis() - perf.window_start_ms)),
                          perf.write_sum_ms / perf.frames,
                          perf.write_max_ms,
                          perf.capture_sum_ms / perf.frames,
                          (unsigned long)perf.dropped,
                          WiFi.RSSI(),
                          (unsigned long)(ESP.getFreeHeap() / 1024));
        }

        status_led_handle();
        stream_perf_log(&perf, client, millis(), false, perf_enabled);

        // Target 50ms/frame (20fps). Web adaptive tick (max(50, detectMs+30)) keeps
        // TCP buffer drained — if detect spikes, tick backs off automatically.
        const uint32_t loop_elapsed_ms = millis() - loop_start_ms;
        const uint32_t target_ms = 50;
        delay(loop_elapsed_ms < target_ms ? target_ms - loop_elapsed_ms : 10);
    }

    stream_perf_log(&perf, client, millis(), true, perf_enabled);
    Serial.printf("[stream] client disconnected frames=%lu duration_ms=%lu heap_kb=%lu psram_kb=%lu wifi=%d/%s rssi=%d quality=%d\n",
                  (unsigned long)frame_id,
                  (unsigned long)(millis() - stream_start_ms),
                  (unsigned long)(ESP.getFreeHeap() / 1024),
                  (unsigned long)(ESP.getFreePsram() / 1024),
                  (int)WiFi.status(),
                  wifi_status_name(WiFi.status()),
                  WiFi.RSSI(),
                  wifi_quality_percent(WiFi.RSSI()));
    s_streaming = false;
    status_led_set(DEVICE_STATE_READY);
}

static void handle_options() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "*");
    server.send(204);
}

void http_server_start(const char* fw_version, const char* board_model,
                       const char* cam_model) {
    s_fw_version = fw_version;
    s_board_model = board_model;
    s_cam_model  = cam_model;

    server.on("/hello",   HTTP_GET,     handle_hello);
    server.on("/status",  HTTP_GET,     handle_status);
    server.on("/capture", HTTP_GET,     handle_capture);
    server.on("/stream",  HTTP_GET,     handle_stream);
    server.on("/cam",     HTTP_GET,     handle_cam_config);
    server.on("/cam",     HTTP_POST,    handle_cam_config);
    server.on("/end",     HTTP_POST,    handle_end_session);
    server.on("/end",     HTTP_GET,     handle_end_session);
    server.on("/hello",   HTTP_OPTIONS, handle_options);
    server.on("/status",  HTTP_OPTIONS, handle_options);
    server.on("/capture", HTTP_OPTIONS, handle_options);
    server.on("/stream",  HTTP_OPTIONS, handle_options);
    server.on("/cam",     HTTP_OPTIONS, handle_options);
    server.on("/end",     HTTP_OPTIONS, handle_options);
    server.begin();

    // mDNS: device reachable at http://fitcam-<mac6>.local/
    String mdns_name = "fitcam-" + device_id();
    if (MDNS.begin(mdns_name.c_str())) {
        MDNS.addService("http", "tcp", 80);
        MDNS.addServiceTxt("http", "tcp", "device_id", device_id());
        Serial.printf("[network] mdns=http://%s.local/\n", mdns_name.c_str());
    }

    Serial.printf("[http] ready ip=http://%s mdns=http://%s.local endpoints=/hello,/status,/capture,/stream,/cam,/end\n",
                  WiFi.localIP().toString().c_str(),
                  mdns_name.c_str());
}

void http_server_handle() {
    server.handleClient();
}

uint32_t http_server_stream_count() {
    return s_stream_count;
}
