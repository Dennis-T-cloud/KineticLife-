#pragma once
#include "wifi_qr.h"

// Soft AP pairing helper.
// In pairing mode, start() creates a "KineticLife-Setup" AP and serves HTTP
// endpoints that let pair.html trigger a config-network connect without QR.

void        wifi_ap_config_start();
void        wifi_ap_config_poll();                          // call every loop tick
bool        wifi_ap_config_is_connecting();                 // true while STA connect is in progress
bool        wifi_ap_config_get_credentials(WifiCredentials* out); // true once connected
void        wifi_ap_config_stop();
const char* wifi_ap_config_ssid();                         // "KineticLife-Setup"
