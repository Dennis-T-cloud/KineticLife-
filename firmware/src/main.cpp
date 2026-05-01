#include <Arduino.h>
#include <WiFi.h>
#include <esp_log.h>

#include "camera_init.h"
#include "debug_log.h"
#include "http_server.h"
#include "status_led.h"
#include "wifi_ap_config.h"
#include "wifi_qr.h"

#ifndef KINETICLIFE_FW_VERSION
#define KINETICLIFE_FW_VERSION "0.3.0"
#endif
#ifndef KINETICLIFE_BOARD_MODEL
#define KINETICLIFE_BOARD_MODEL "Freenove ESP32-S3-WROOM Board (N16R8) FNK0085 B"
#endif
#ifndef KINETICLIFE_CAMERA_MODEL
#define KINETICLIFE_CAMERA_MODEL "OV5640"
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
    const unsigned long connect_start_ms = millis();
    status_led_set(DEVICE_STATE_CONNECTING);
    kl_logf("[wifi] connecting ssid=\"%s\" auth=%s\n",
            creds.ssid.c_str(),
            creds.auth_type.c_str());
    WiFi.mode(WIFI_STA);
    WiFi.setSleep(false);
    WiFi.setTxPower(WIFI_POWER_19_5dBm); // max TX power for 2m+ range stability
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

    kl_logf("[perf] wifi_connect_ms=%lu ssid=\"%s\" ip=%s rssi=%d channel=%d attempts=%d heap_kb=%lu psram_kb=%lu\n",
            millis() - connect_start_ms,
            creds.ssid.c_str(),
            WiFi.localIP().toString().c_str(),
            WiFi.RSSI(),
            WiFi.channel(),
            attempts,
            (unsigned long)(ESP.getFreeHeap() / 1024),
            (unsigned long)(ESP.getFreePsram() / 1024));
    return true;
}

static void run_pairing_mode() {
    status_led_set(DEVICE_STATE_PAIRING);
    kl_logln("[state] pairing reason=no_active_session");

    // Start soft AP so pair.html Config tab can connect without QR scan
    wifi_ap_config_start();
    kl_logf("[pair] options: (1) show QR to camera  (2) connect to '%s'/kineticlife -> open http://192.168.4.1\n",
            wifi_ap_config_ssid());

    const unsigned long qr_camera_start_ms = millis();
    if (!camera_init_qr()) {
        status_led_set(DEVICE_STATE_FATAL);
        kl_logln("[fatal] camera_init_failed mode=pairing");
        while (true) delay(1000);
    }
    kl_logf("[perf] qr_camera_init_ms=%lu mode=%s format=%s frame=%s heap_kb=%lu psram_kb=%lu\n",
            millis() - qr_camera_start_ms,
            camera_mode_name(),
            camera_pixel_format_name(),
            camera_frame_size_name(),
            (unsigned long)(ESP.getFreeHeap() / 1024),
            (unsigned long)(ESP.getFreePsram() / 1024));

    while (true) {
        status_led_handle();
        wifi_ap_config_poll();

        // Config-network path: user selected a network in pair.html
        WifiCredentials cfg_creds;
        if (wifi_ap_config_get_credentials(&cfg_creds)) {
            wifi_ap_config_stop();
            kl_logf("[pair] config_connect ssid=\"%s\"\n", cfg_creds.ssid.c_str());
            if (wifi_save_credentials(cfg_creds)) {
                kl_logln("[session] active_session_saved action=reboot_to_camera");
                delay(500);
                ESP.restart();
            } else {
                kl_logln("[pair] nvs_save_failed action=resume");
                status_led_set(DEVICE_STATE_ERROR);
                delay(2000);
                wifi_ap_config_start();
                status_led_set(DEVICE_STATE_PAIRING);
            }
            continue;
        }

        // QR path: skip camera scan while config is actively connecting
        if (wifi_ap_config_is_connecting()) continue;

        WifiCredentials scanned;
        if (!wifi_scan_qr_once(&scanned)) continue;

        kl_logf("[pair] qr_parsed ssid=\"%s\" auth=%s\n",
                scanned.ssid.c_str(), scanned.auth_type.c_str());
        wifi_ap_config_stop();
        if (!connect_wifi(scanned)) {
            kl_logln("[pair] connect_failed action=resume_scanning");
            delay(2000);
            wifi_ap_config_start();
            status_led_set(DEVICE_STATE_PAIRING);
            continue;
        }
        if (!wifi_save_credentials(scanned)) {
            kl_logln("[pair] nvs_save_failed action=resume_scanning");
            status_led_set(DEVICE_STATE_ERROR);
            delay(2000);
            wifi_ap_config_start();
            status_led_set(DEVICE_STATE_PAIRING);
            continue;
        }
        kl_logln("[session] active_session_saved action=reboot_to_camera");
        delay(1000);
        ESP.restart();
    }
}

void setup() {
    const unsigned long setup_start_ms = millis();
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
    kl_logf("[boot] board=\"%s\" camera=\"%s\" cpu_mhz=%lu flash_mb=%lu heap_kb=%lu psram_kb=%lu psram_size_kb=%lu\n",
            KINETICLIFE_BOARD_MODEL,
            KINETICLIFE_CAMERA_MODEL,
            (unsigned long)ESP.getCpuFreqMHz(),
            (unsigned long)(ESP.getFlashChipSize() / (1024 * 1024)),
            (unsigned long)(ESP.getFreeHeap() / 1024),
            (unsigned long)(ESP.getFreePsram() / 1024),
            (unsigned long)(ESP.getPsramSize() / 1024));

    WifiCredentials creds;
    const unsigned long nvs_start_ms = millis();
    if (!wifi_load_credentials(&creds)) {
        kl_logf("[perf] nvs_load_ms=%lu active_session=0\n", millis() - nvs_start_ms);
        kl_logln("[boot] no_saved_wifi action=start_qr_pairing");
        run_pairing_mode();
    }
    kl_logf("[perf] nvs_load_ms=%lu active_session=1\n", millis() - nvs_start_ms);
    kl_logf("[session] active_session_loaded ssid=\"%s\" auth=%s\n",
            creds.ssid.c_str(),
            creds.auth_type.c_str());

    const unsigned long camera_start_ms = millis();
    if (!camera_init()) {
        status_led_set(DEVICE_STATE_FATAL);
        kl_logln("[fatal] camera_init_failed mode=stream check_pin_mapping=Freenove_FNK0085_B");
        while (true) delay(1000);
    }
    kl_logf("[perf] camera_init_ms=%lu mode=%s format=%s frame=%s q=%d heap_kb=%lu psram_kb=%lu\n",
            millis() - camera_start_ms,
            camera_mode_name(),
            camera_pixel_format_name(),
            camera_frame_size_name(),
            camera_jpeg_quality(),
            (unsigned long)(ESP.getFreeHeap() / 1024),
            (unsigned long)(ESP.getFreePsram() / 1024));

    if (!connect_wifi(creds)) {
        kl_logln("[session] active_session_invalid action=clear_and_reboot_to_pairing");
        wifi_clear_credentials();
        delay(1000);
        ESP.restart();
    }

    const unsigned long http_start_ms = millis();
    http_server_start(KINETICLIFE_FW_VERSION, KINETICLIFE_BOARD_MODEL,
                      KINETICLIFE_CAMERA_MODEL);
    kl_logf("[perf] http_start_ms=%lu setup_total_ms=%lu heap_kb=%lu psram_kb=%lu\n",
            millis() - http_start_ms,
            millis() - setup_start_ms,
            (unsigned long)(ESP.getFreeHeap() / 1024),
            (unsigned long)(ESP.getFreePsram() / 1024));
    status_led_set(DEVICE_STATE_READY);
}

void loop() {
    http_server_handle();
    http_server_push_frame();
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
