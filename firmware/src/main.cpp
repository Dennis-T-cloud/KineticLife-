#include <Arduino.h>
#include <WiFi.h>
#include <esp_log.h>

#include "camera_init.h"
#include "debug_log.h"
#include "http_server.h"
#include "status_led.h"
#include "wifi_qr.h"

#ifndef KINETICLIFE_FW_VERSION
#define KINETICLIFE_FW_VERSION "0.3.0"
#endif
#ifndef KINETICLIFE_BOARD_MODEL
#define KINETICLIFE_BOARD_MODEL "Freenove ESP32-S3-WROOM Board (N16R8) FNK0085 B"
#endif
#ifndef KINETICLIFE_CAMERA_MODEL
#define KINETICLIFE_CAMERA_MODEL "OV2640"
#endif

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

static void log_wifi_scan_for_target(const String& target_ssid) {
    kl_logf("[wifi] scan_start target=\"%s\"\n", target_ssid.c_str());
    const int network_count = WiFi.scanNetworks(false, true);
    bool found_target = false;

    if (network_count < 0) {
        kl_logf("[wifi] scan_failed result=%d\n", network_count);
        return;
    }

    kl_logf("[wifi] scan_done networks=%d\n", network_count);
    for (int i = 0; i < network_count; i++) {
        const String ssid = WiFi.SSID(i);
        const bool is_target = ssid == target_ssid;
        if (is_target) found_target = true;
        if (is_target || i < 8) {
            kl_logf("[wifi] scan_result index=%d%s ssid=\"%s\" rssi=%d channel=%d enc=%d\n",
                    i,
                    is_target ? " target=1" : "",
                    ssid.c_str(),
                    WiFi.RSSI(i),
                    WiFi.channel(i),
                    (int)WiFi.encryptionType(i));
        }
    }
    kl_logf("[wifi] scan_target_found=%d ssid=\"%s\"\n",
            found_target ? 1 : 0,
            target_ssid.c_str());
    WiFi.scanDelete();
}

static bool connect_wifi(const WifiCredentials& creds) {
    status_led_set(DEVICE_STATE_CONNECTING);
    kl_logf("[wifi] connecting ssid=\"%s\" auth=%s\n",
            creds.ssid.c_str(),
            creds.auth_type.c_str());
    WiFi.mode(WIFI_STA);
    WiFi.setSleep(false);
    WiFi.disconnect(false);
    delay(500);
    // Scan removed: iOS hides hotspot SSID when screen is off, causing
    // scan to report not-found even though WiFi.begin() can still connect.
    // The scan delay also gives iOS more time to enter power-saving mode.
    WiFi.begin(creds.ssid.c_str(),
               creds.auth_type == "nopass" ? nullptr : creds.password.c_str());
    delay(1000);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 60) {
        delay(500);
        const wl_status_t status = WiFi.status();
        if (attempts % 5 == 0) {
            kl_logf("[wifi] attempt=%d status=%d/%s\n",
                    attempts + 1,
                    (int)status,
                    wifi_status_name(status));
        }
        attempts++;
    }

    if (WiFi.status() != WL_CONNECTED) {
        const wl_status_t status = WiFi.status();
        kl_logf("[wifi] connect_failed ssid=\"%s\" status=%d/%s attempts=%d\n",
                creds.ssid.c_str(),
                (int)status,
                wifi_status_name(status),
                attempts);
        status_led_set(DEVICE_STATE_ERROR);
        WiFi.disconnect(true);
        delay(500);
        return false;
    }

    kl_logf("[wifi] connected ip=%s rssi=%d channel=%d\n",
            WiFi.localIP().toString().c_str(),
            WiFi.RSSI(),
            WiFi.channel());

    // Verify stability: iOS hotspot can briefly connect then drop
    delay(2000);
    if (WiFi.status() != WL_CONNECTED) {
        const wl_status_t dropped = WiFi.status();
        kl_logf("[wifi] connect_unstable ssid=\"%s\" status=%d/%s reason=dropped_after_connect\n",
                creds.ssid.c_str(), (int)dropped, wifi_status_name(dropped));
        status_led_set(DEVICE_STATE_ERROR);
        WiFi.disconnect(true);
        delay(500);
        return false;
    }

    return true;
}

static void run_pairing_mode() {
    status_led_set(DEVICE_STATE_PAIRING);
    kl_logln("[state] pairing reason=no_active_session");
    kl_logln("[pair] show pair.html QR to camera; adjust distance until span_px is roughly 100-200");

    if (!camera_init_qr()) {
        status_led_set(DEVICE_STATE_FATAL);
        kl_logln("[fatal] camera_init_failed mode=pairing");
        while (true) delay(1000);
    }

    while (true) {
        status_led_handle();
        WifiCredentials scanned;
        if (!wifi_scan_qr_once(&scanned)) {
            continue;
        }

        kl_logf("[pair] qr_parsed ssid=\"%s\" auth=%s\n",
                scanned.ssid.c_str(),
                scanned.auth_type.c_str());
        if (!connect_wifi(scanned)) {
            kl_logln("[pair] connect_failed action=resume_scanning");
            delay(2000);
            status_led_set(DEVICE_STATE_PAIRING);
            continue;
        }

        if (!wifi_save_credentials(scanned)) {
            kl_logln("[pair] nvs_save_failed action=resume_scanning");
            status_led_set(DEVICE_STATE_ERROR);
            delay(2000);
            status_led_set(DEVICE_STATE_PAIRING);
            continue;
        }

        kl_logln("[session] active_session_saved action=reboot_to_camera");
        delay(1000);
        ESP.restart();
    }
}

void setup() {
    Serial.begin(115200);
    unsigned long serial_wait_start = millis();
    while (!Serial && millis() - serial_wait_start < 3000) {
        delay(10);
    }
    esp_log_level_set("cam_hal", ESP_LOG_NONE);
    esp_log_level_set("camera", ESP_LOG_NONE);
    esp_log_level_set("sccb", ESP_LOG_WARN);
    status_led_begin();

    kl_logf("\n\n[boot] KineticLife firmware=%s\n", KINETICLIFE_FW_VERSION);
    kl_logf("[boot] board=\"%s\" camera=\"%s\" heap_kb=%lu psram_kb=%lu\n",
            KINETICLIFE_BOARD_MODEL,
            KINETICLIFE_CAMERA_MODEL,
            (unsigned long)(ESP.getFreeHeap() / 1024),
            (unsigned long)(ESP.getFreePsram() / 1024));

    WifiCredentials creds;
    if (!wifi_load_credentials(&creds)) {
        kl_logln("[boot] no_saved_wifi action=start_qr_pairing");
        run_pairing_mode();
    }
    kl_logf("[session] active_session_loaded ssid=\"%s\" auth=%s\n",
            creds.ssid.c_str(),
            creds.auth_type.c_str());

    if (!camera_init()) {
        status_led_set(DEVICE_STATE_FATAL);
        kl_logln("[fatal] camera_init_failed mode=stream check_pin_mapping=Freenove_FNK0085_B");
        while (true) delay(1000);
    }

    if (!connect_wifi(creds)) {
        kl_logln("[session] active_session_invalid action=clear_and_reboot_to_pairing");
        wifi_clear_credentials();
        delay(1000);
        ESP.restart();
    }

    http_server_start(KINETICLIFE_FW_VERSION, KINETICLIFE_BOARD_MODEL,
                      KINETICLIFE_CAMERA_MODEL);
    status_led_set(DEVICE_STATE_READY);
}

void loop() {
    http_server_handle();
    status_led_handle();

    static unsigned long last_status_ms = 0;
    if (millis() - last_status_ms >= 60000) {
        last_status_ms = millis();
        kl_logf("[status] state=%s uptime=%lus ip=%s rssi=%ddBm heap_kb=%lu psram_kb=%lu camera=%s/%s/%s q=%d streams=%lu\n",
                status_led_state_name(),
                millis() / 1000,
                WiFi.localIP().toString().c_str(),
                WiFi.RSSI(),
                (unsigned long)(ESP.getFreeHeap() / 1024),
                (unsigned long)(ESP.getFreePsram() / 1024),
                camera_mode_name(),
                camera_pixel_format_name(),
                camera_frame_size_name(),
                camera_jpeg_quality(),
                (unsigned long)http_server_stream_count());
    }
}
