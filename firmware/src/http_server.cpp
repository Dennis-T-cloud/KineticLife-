#include "http_server.h"
#include <WebServer.h>
#include <ESPmDNS.h>
#include <esp_camera.h>
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
        Serial.printf("[http] GET /status remote=%s state=%s ip=%s rssi=%d camera=%s/%s/%s q=%d\n",
                      server.client().remoteIP().toString().c_str(),
                      status_led_state_name(),
                      WiFi.localIP().toString().c_str(),
                      WiFi.RSSI(),
                      camera_mode_name(),
                      camera_pixel_format_name(),
                      camera_frame_size_name(),
                      camera_jpeg_quality());
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
    json += "\"wifi_status\":" + String((int)WiFi.status()) + ",";
    json += "\"stream_count\":" + String(s_stream_count) + ",";
    json += "\"uptime_s\":" + String(millis() / 1000) + ",";
    json += "\"free_heap_kb\":" + String(ESP.getFreeHeap() / 1024) + ",";
    json += "\"free_psram_kb\":" + String(ESP.getFreePsram() / 1024);
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

static void handle_capture() {
    WiFiClient client = server.client();
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb || fb->format != PIXFORMAT_JPEG || fb->len > 128 * 1024) {
        if (fb) esp_camera_fb_return(fb);
        client.print(
            "HTTP/1.1 503 Service Unavailable\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "Content-Length: 0\r\n\r\n"
        );
        return;
    }
    char header[160];
    snprintf(header, sizeof(header),
             "HTTP/1.1 200 OK\r\n"
             "Access-Control-Allow-Origin: *\r\n"
             "Content-Type: image/jpeg\r\n"
             "Content-Length: %u\r\n"
             "Cache-Control: no-store\r\n\r\n",
             (unsigned)fb->len);
    client.print(header);
    client.write(fb->buf, fb->len);
    esp_camera_fb_return(fb);
}

static bool apply_stream_args() {
    if (!server.hasArg("res")) return true;

    String res = server.arg("res");
    const int at = res.indexOf('@');
    if (at >= 0) res = res.substring(0, at);

    if (!camera_set_framesize(res.c_str())) {
        server.sendHeader("Access-Control-Allow-Origin", "*");
        server.send(400, "application/json", "{\"error\":\"invalid_resolution\"}");
        return false;
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
    status_led_set(DEVICE_STATE_STREAMING);
    Serial.printf("[stream] client connected count=%lu remote=%s\n",
                  (unsigned long)s_stream_count,
                  client.remoteIP().toString().c_str());

    client.print(
        "HTTP/1.1 200 OK\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Content-Type: multipart/x-mixed-replace; boundary=frame\r\n"
        "Connection: keep-alive\r\n\r\n"
    );

    uint32_t frame_id = 0;

    while (client.connected()) {
        // Process /cam, /status and other requests without blocking the stream.
        // s_streaming guard above prevents recursive re-entry on /stream.
        server.handleClient();

        camera_fb_t* fb = esp_camera_fb_get();
        if (!fb) { delay(10); continue; }

        // Drop oversized frames (contract: max 128 KB)
        if (fb->len > 128 * 1024) {
            esp_camera_fb_return(fb);
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

        client.write((const uint8_t*)header, hlen);
        client.write(fb->buf, fb->len);
        client.write((const uint8_t*)"\r\n", 2);

        esp_camera_fb_return(fb);
        status_led_handle();
        delay(66);  // ~15 FPS target; keeps phone-hotspot TCP and MediaPipe stable
    }

    Serial.printf("[stream] client disconnected frames=%lu\n", (unsigned long)frame_id);
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
