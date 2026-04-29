#include "wifi_qr.h"

#include <Preferences.h>
#include <esp_camera.h>
#include "debug_log.h"

extern "C" {
#include <quirc.h>
}

static const char* NVS_NAMESPACE = "wifi";
static const char* KEY_SSID = "ssid";
static const char* KEY_PASS = "pass";
static const char* KEY_TYPE = "type";

static unsigned long s_last_scan_report_ms = 0;
static uint32_t s_scan_count = 0;
static uint32_t s_no_qr_count = 0;
static uint32_t s_decode_fail_count = 0;
static uint32_t s_invalid_payload_count = 0;
static uint32_t s_camera_fail_count = 0;

static void maybe_report_scan_stats() {
    if (millis() - s_last_scan_report_ms < 10000) return;
    s_last_scan_report_ms = millis();
    kl_logf("[qr] scan_status scans=%lu no_qr=%lu decode_fail=%lu invalid_payload=%lu camera_fail=%lu\n",
                  (unsigned long)s_scan_count,
                  (unsigned long)s_no_qr_count,
                  (unsigned long)s_decode_fail_count,
                  (unsigned long)s_invalid_payload_count,
                  (unsigned long)s_camera_fail_count);
}

static void frame_luma_stats(const camera_fb_t* fb, uint8_t* min_luma,
                             uint8_t* max_luma, uint8_t* avg_luma) {
    uint8_t min_v = 255;
    uint8_t max_v = 0;
    uint32_t sum = 0;
    const size_t sample_count = min(static_cast<size_t>(fb->len),
                                    static_cast<size_t>(1024));

    if (sample_count == 0) {
        *min_luma = 0;
        *max_luma = 0;
        *avg_luma = 0;
        return;
    }

    const size_t step = max(static_cast<size_t>(1), fb->len / sample_count);
    size_t taken = 0;
    for (size_t i = 0; i < fb->len && taken < sample_count; i += step) {
        const uint8_t value = fb->buf[i];
        min_v = min(min_v, value);
        max_v = max(max_v, value);
        sum += value;
        taken++;
    }

    *min_luma = min_v;
    *max_luma = max_v;
    *avg_luma = taken == 0 ? 0 : static_cast<uint8_t>(sum / taken);
}

static bool is_valid_auth_type(const String& auth_type) {
    return auth_type == "WPA" || auth_type == "WEP" || auth_type == "nopass";
}

static bool read_wifi_field(const String& body, int* pos, String* key, String* value) {
    const int len = body.length();

    while (*pos < len && body[*pos] == ';') {
        (*pos)++;
    }
    if (*pos >= len) return false;

    const int colon = body.indexOf(':', *pos);
    if (colon < 0) return false;

    *key = body.substring(*pos, colon);
    *value = "";
    *pos = colon + 1;

    bool escaped = false;
    while (*pos < len) {
        const char c = body[*pos];
        (*pos)++;

        if (escaped) {
            *value += c;
            escaped = false;
        } else if (c == '\\') {
            escaped = true;
        } else if (c == ';') {
            break;
        } else {
            *value += c;
        }
    }

    return key->length() > 0;
}

bool wifi_load_credentials(WifiCredentials* creds) {
    if (!creds) return false;

    Preferences prefs;
    if (!prefs.begin(NVS_NAMESPACE, false)) return false;

    if (!prefs.isKey(KEY_SSID) || !prefs.isKey(KEY_TYPE)) {
        prefs.end();
        kl_logln("[session] nvs_empty active_session=false");
        return false;
    }

    const String ssid = prefs.getString(KEY_SSID, "");
    const String auth_type = prefs.getString(KEY_TYPE, "WPA");
    const String password = prefs.isKey(KEY_PASS) ? prefs.getString(KEY_PASS, "") : "";
    prefs.end();

    if (ssid.length() == 0 || !is_valid_auth_type(auth_type)) {
        kl_logf("[session] nvs_invalid ssid_len=%u auth=%s\n",
                      (unsigned)ssid.length(),
                      auth_type.c_str());
        return false;
    }

    creds->ssid = ssid;
    creds->password = password;
    creds->auth_type = auth_type;
    return true;
}

bool wifi_save_credentials(const WifiCredentials& creds) {
    if (creds.ssid.length() == 0 || !is_valid_auth_type(creds.auth_type)) return false;

    Preferences prefs;
    if (!prefs.begin(NVS_NAMESPACE, false)) return false;

    const bool ok = prefs.putString(KEY_SSID, creds.ssid) > 0 &&
                    prefs.putString(KEY_TYPE, creds.auth_type) > 0;
    prefs.putString(KEY_PASS, creds.auth_type == "nopass" ? "" : creds.password);
    prefs.end();
    kl_logf("[session] nvs_save ok=%d ssid=\"%s\" auth=%s password_len=%u\n",
                  ok ? 1 : 0,
                  creds.ssid.c_str(),
                  creds.auth_type.c_str(),
                  (unsigned)creds.password.length());
    return ok;
}

bool wifi_clear_credentials() {
    Preferences prefs;
    if (!prefs.begin(NVS_NAMESPACE, false)) return false;
    const bool ok = prefs.clear();
    prefs.end();
    kl_logf("[session] nvs_clear ok=%d\n", ok ? 1 : 0);
    return ok;
}

static bool wifi_parse_compact_payload(const String& payload, WifiCredentials* creds) {
    if (!payload.startsWith("K1:") || payload.length() < 7) return false;

    const char type_code = payload[3];
    if (payload[4] != ':') return false;

    const int len_end = payload.indexOf(':', 5);
    if (len_end < 0) return false;

    const int ssid_len = payload.substring(5, len_end).toInt();
    const int ssid_start = len_end + 1;
    const int password_start = ssid_start + ssid_len;
    if (ssid_len <= 0 || password_start > payload.length()) return false;

    String auth_type;
    if (type_code == 'W') {
        auth_type = "WPA";
    } else if (type_code == 'E') {
        auth_type = "WEP";
    } else if (type_code == 'N') {
        auth_type = "nopass";
    } else {
        return false;
    }

    const String ssid = payload.substring(ssid_start, password_start);
    const String password = auth_type == "nopass" ? "" : payload.substring(password_start);

    if (ssid.length() == 0 || ssid.length() > 32) return false;
    if (auth_type != "nopass" && password.length() == 0) return false;
    if (password.length() > 64) return false;

    creds->ssid = ssid;
    creds->password = password;
    creds->auth_type = auth_type;
    return true;
}

bool wifi_parse_qr_payload(const String& payload, WifiCredentials* creds) {
    if (!creds) return false;
    if (wifi_parse_compact_payload(payload, creds)) return true;
    if (!payload.startsWith("WIFI:")) return false;

    String ssid;
    String password;
    String auth_type = "WPA";
    String body = payload.substring(5);
    int pos = 0;

    while (pos < body.length()) {
        String key;
        String value;
        if (!read_wifi_field(body, &pos, &key, &value)) break;

        if (key == "S") {
            ssid = value;
        } else if (key == "P") {
            password = value;
        } else if (key == "T") {
            auth_type = value;
        }
    }

    if (ssid.length() == 0 || ssid.length() > 32) return false;
    if (!is_valid_auth_type(auth_type)) return false;
    if (auth_type != "nopass" && password.length() == 0) return false;
    if (password.length() > 64) return false;

    creds->ssid = ssid;
    creds->password = auth_type == "nopass" ? "" : password;
    creds->auth_type = auth_type;
    return true;
}

static String payload_from_quirc_data(const struct quirc_data& data) {
    String payload;
    payload.reserve(data.payload_len);
    for (int i = 0; i < data.payload_len; i++) {
        payload += static_cast<char>(data.payload[i]);
    }
    return payload;
}

static int qr_code_span_px(const struct quirc_code& code) {
    int min_x = code.corners[0].x;
    int max_x = code.corners[0].x;
    int min_y = code.corners[0].y;
    int max_y = code.corners[0].y;
    for (int i = 1; i < 4; i++) {
        min_x = min(min_x, code.corners[i].x);
        max_x = max(max_x, code.corners[i].x);
        min_y = min(min_y, code.corners[i].y);
        max_y = max(max_y, code.corners[i].y);
    }
    return max(max_x - min_x, max_y - min_y);
}

bool wifi_scan_qr_once(WifiCredentials* creds) {
    if (!creds) return false;
    s_scan_count++;
    maybe_report_scan_stats();

    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) {
        s_camera_fail_count++;
        kl_logf("[qr] frame_capture_failed scans=%lu camera_fail=%lu\n",
                      (unsigned long)s_scan_count,
                      (unsigned long)s_camera_fail_count);
        delay(50);
        return false;
    }

    if (fb->format != PIXFORMAT_GRAYSCALE) {
        esp_camera_fb_return(fb);
        kl_logf("[qr] frame_invalid_format format=%d expected=%d\n",
                      (int)fb->format,
                      (int)PIXFORMAT_GRAYSCALE);
        delay(200);
        return false;
    }

    static struct quirc* qr = nullptr;
    static int qr_width = 0;
    static int qr_height = 0;

    if (!qr) {
        qr = quirc_new();
    }
    if (!qr) {
        esp_camera_fb_return(fb);
        kl_logln("[qr] quirc_allocation_failed");
        delay(500);
        return false;
    }

    bool found = false;
    if ((qr_width == fb->width && qr_height == fb->height) ||
        quirc_resize(qr, fb->width, fb->height) >= 0) {
        qr_width = fb->width;
        qr_height = fb->height;

        int width = 0;
        int height = 0;
        uint8_t* image = quirc_begin(qr, &width, &height);
        const size_t image_len = static_cast<size_t>(width) * static_cast<size_t>(height);
        memcpy(image, fb->buf, min(static_cast<size_t>(fb->len), image_len));
        quirc_end(qr);

        const int count = quirc_count(qr);
        if (s_scan_count <= 2 || count > 0 || s_scan_count % 30 == 0) {
            uint8_t min_luma;
            uint8_t max_luma;
            uint8_t avg_luma;
            frame_luma_stats(fb, &min_luma, &max_luma, &avg_luma);
            kl_logf("[qr] frame scan=%lu size=%ux%u bytes=%u luma_min=%u luma_avg=%u luma_max=%u qr_candidates=%d\n",
                          (unsigned long)s_scan_count,
                          (unsigned)fb->width,
                          (unsigned)fb->height,
                          (unsigned)fb->len,
                          (unsigned)min_luma,
                          (unsigned)avg_luma,
                          (unsigned)max_luma,
                          count);
        }
        if (count == 0) {
            s_no_qr_count++;
        }
        static struct quirc_code code;
        static struct quirc_data data;
        for (int i = 0; i < count && !found; i++) {
            quirc_extract(qr, i, &code);

            quirc_decode_error_t err = quirc_decode(&code, &data);
            quirc_decode_error_t first_err = err;
            bool used_flip = false;
            if (err != QUIRC_SUCCESS) {
                quirc_flip(&code);
                used_flip = true;
                err = quirc_decode(&code, &data);
            }

            if (err == QUIRC_SUCCESS) {
                const String payload = payload_from_quirc_data(data);
                found = wifi_parse_qr_payload(payload, creds);
                if (found) {
                    kl_logf("[qr] decode_ok index=%d flipped=%d grid=%d span_px=%d payload_len=%u ssid=\"%s\" auth=%s password_len=%u\n",
                                  i,
                                  used_flip ? 1 : 0,
                                  code.size,
                                  qr_code_span_px(code),
                                  (unsigned)data.payload_len,
                                  creds->ssid.c_str(),
                                  creds->auth_type.c_str(),
                                  (unsigned)creds->password.length());
                } else {
                    s_invalid_payload_count++;
                    kl_logf("[qr] payload_invalid index=%d flipped=%d grid=%d span_px=%d payload_len=%u prefix=\"%s\"\n",
                                  i,
                                  used_flip ? 1 : 0,
                                  code.size,
                                  qr_code_span_px(code),
                                  (unsigned)data.payload_len,
                                  payload.substring(0, 16).c_str());
                }
            } else {
                s_decode_fail_count++;
                kl_logf("[qr] decode_fail index=%d grid=%d span_px=%d first_err=%d/%s final_err=%d/%s flipped=%d\n",
                        i,
                        code.size,
                        qr_code_span_px(code),
                        (int)first_err,
                        quirc_strerror(first_err),
                        (int)err,
                        quirc_strerror(err),
                        used_flip ? 1 : 0);
            }
        }
    } else {
        kl_logf("[qr] quirc_resize_failed frame=%ux%u\n",
                      (unsigned)fb->width,
                      (unsigned)fb->height);
    }

    esp_camera_fb_return(fb);
    delay(200);
    return found;
}
