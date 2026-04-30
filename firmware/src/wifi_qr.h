#pragma once

#include <Arduino.h>

struct WifiCredentials {
    String ssid;
    String password;
    // Matches the QR payload contract: "WPA", "WEP", or "nopass".
    String auth_type;
};

bool wifi_load_credentials(WifiCredentials* creds);
bool wifi_save_credentials(const WifiCredentials& creds);
bool wifi_clear_credentials();
bool wifi_parse_qr_payload(const String& payload, WifiCredentials* creds);
bool wifi_scan_qr_once(WifiCredentials* creds);
