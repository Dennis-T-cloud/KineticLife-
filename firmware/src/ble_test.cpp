#include "ble_test.h"

#include <Arduino.h>

#if KINETICLIFE_ENABLE_BLE_TEST

#include <BLE2902.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <esp_camera.h>
#include <esp_mac.h>

#include "camera_init.h"
#include "debug_log.h"

static const char* BLE_SERVICE_UUID = "9b8f0001-6f4d-4d4f-9c9a-4b4c49464501";
static const char* BLE_TX_UUID      = "9b8f0002-6f4d-4d4f-9c9a-4b4c49464501";
static const char* BLE_RX_UUID      = "9b8f0003-6f4d-4d4f-9c9a-4b4c49464501";

enum BleTestMode { BLE_TEST_IDLE, BLE_TEST_THROUGHPUT, BLE_TEST_CAMERA };

static BLEServer* s_server = nullptr;
static BLECharacteristic* s_tx = nullptr;
static bool s_connected = false;
static BleTestMode s_mode = BLE_TEST_IDLE;
static uint32_t s_started_ms = 0;
static uint32_t s_duration_ms = 10000;
static uint32_t s_seq = 0;
static uint32_t s_sent_notifications = 0;
static uint32_t s_sent_bytes = 0;
static uint16_t s_payload_bytes = 180;
static uint16_t s_notify_gap_ms = 12;
static uint32_t s_next_notify_ms = 0;
static uint32_t s_last_log_ms = 0;

static bool s_camera_ready = false;
static uint8_t s_cam_fail_count = 0;
static const uint8_t CAM_FAIL_RESET_THRESHOLD = 5;
static camera_fb_t* s_cam_fb = nullptr;
static uint32_t s_cam_frame_id = 0;
static size_t s_cam_offset = 0;
static uint16_t s_cam_chunk_index = 0;
static uint16_t s_cam_total_chunks = 0;
static bool s_cam_meta_pending = false;
static uint32_t s_cam_frames = 0;
static uint32_t s_cam_bytes = 0;

static volatile bool s_connect_pending = false;
static volatile bool s_disconnect_pending = false;
static volatile uint8_t s_command_head = 0;
static volatile uint8_t s_command_tail = 0;
static char s_pending_commands[12][32] = {{0}};

static String ble_device_id() {
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    char buf[7];
    snprintf(buf, sizeof(buf), "%02x%02x%02x", mac[3], mac[4], mac[5]);
    return String(buf);
}

static void release_camera_frame() {
    if (!s_cam_fb) return;
    esp_camera_fb_return(s_cam_fb);
    s_cam_fb = nullptr;
    s_cam_offset = 0;
    s_cam_chunk_index = 0;
    s_cam_total_chunks = 0;
    s_cam_meta_pending = false;
}

static void restart_advertising() {
    if (!s_server) return;
    BLEAdvertising* advertising = BLEDevice::getAdvertising();
    advertising->addServiceUUID(BLE_SERVICE_UUID);
    advertising->setScanResponse(true);
    advertising->setMinPreferred(0x06);
    advertising->setMaxPreferred(0x12);
    BLEDevice::startAdvertising();
}

static void queue_command(const std::string& value) {
    const uint8_t next_head = (uint8_t)((s_command_head + 1) % 12);
    if (next_head == s_command_tail) return;

    char* slot = s_pending_commands[s_command_head];
    const size_t n = min(value.length(), sizeof(s_pending_commands[0]) - 1);
    for (size_t i = 0; i < n; i++) {
        char c = value[i];
        if (c >= 'A' && c <= 'Z') c = (char)(c - 'A' + 'a');
        slot[i] = c;
    }
    slot[n] = '\0';
    s_command_head = next_head;
}

static uint32_t parse_uint_after(const String& cmd, const char* key, uint32_t fallback) {
    const int pos = cmd.indexOf(key);
    if (pos < 0) return fallback;
    const int start = pos + strlen(key);
    return (uint32_t)cmd.substring(start).toInt();
}

static int32_t parse_int_after(const String& cmd, const char* key, int32_t fallback) {
    const int pos = cmd.indexOf(key);
    if (pos < 0) return fallback;
    return (int32_t)cmd.substring(pos + strlen(key)).toInt();
}

static void notify_bytes(const uint8_t* payload, uint16_t len) {
    s_tx->setValue((uint8_t*)payload, len);
    s_tx->notify();
    s_sent_notifications++;
    s_sent_bytes += len;
    s_next_notify_ms = millis() + s_notify_gap_ms;
}

static void notify_text(const String& text) {
    notify_bytes((const uint8_t*)text.c_str(), (uint16_t)text.length());
}

static void stop_test(const char* reason) {
    if (s_mode == BLE_TEST_IDLE) return;
    uint32_t elapsed = millis() - s_started_ms;
    if (elapsed == 0) elapsed = 1;

    if (s_mode == BLE_TEST_CAMERA) {
        kl_logf("[ble_cam] stop reason=%s elapsed_ms=%lu frames=%lu bytes=%lu kBps=%.2f notifications=%lu\n",
                reason,
                (unsigned long)elapsed,
                (unsigned long)s_cam_frames,
                (unsigned long)s_cam_bytes,
                (float)s_cam_bytes / (float)elapsed,
                (unsigned long)s_sent_notifications);
    } else {
        kl_logf("[ble] throughput_stop reason=%s elapsed_ms=%lu notifications=%lu bytes=%lu kBps=%.2f\n",
                reason,
                (unsigned long)elapsed,
                (unsigned long)s_sent_notifications,
                (unsigned long)s_sent_bytes,
                (float)s_sent_bytes / (float)elapsed);
    }

    release_camera_frame();
    s_mode = BLE_TEST_IDLE;
}

static void start_throughput_test(uint32_t duration_ms) {
    release_camera_frame();
    s_mode = BLE_TEST_THROUGHPUT;
    s_started_ms = millis();
    s_duration_ms = constrain(duration_ms, 1000UL, 60000UL);
    s_seq = 0;
    s_sent_notifications = 0;
    s_sent_bytes = 0;
    s_last_log_ms = s_started_ms;
    s_next_notify_ms = s_started_ms;
    kl_logf("[ble] throughput_start duration_ms=%lu payload_bytes=%u gap_ms=%u\n",
            (unsigned long)s_duration_ms,
            (unsigned)s_payload_bytes,
            (unsigned)s_notify_gap_ms);
}

static bool ensure_camera_ready() {
    if (s_camera_ready) return true;
    kl_logln("[ble_cam] camera_not_ready retrying");
    camera_deinit();
    // OV2640 power-on stabilization: same requirement as boot path.
    // delay() on Arduino ESP32 calls vTaskDelay, allowing BLE stack tasks to run.
    delay(3000);
    if (!camera_init_ble()) {
        kl_logln("[ble_cam] camera_init_failed");
        return false;
    }
    if (!camera_capture_self_test(2, 1000)) {
        kl_logln("[ble_cam] camera_self_test_failed");
        return false;
    }
    s_camera_ready = true;
    s_cam_fail_count = 0;
    kl_logf("[ble_cam] camera_ready frame=%s q=%d\n",
            camera_frame_size_name(),
            camera_jpeg_quality());
    return true;
}

static void start_camera_test(uint32_t duration_ms) {
    release_camera_frame();
    if (!ensure_camera_ready()) {
        s_mode = BLE_TEST_IDLE;
        return;
    }

    s_mode = BLE_TEST_CAMERA;
    s_started_ms = millis();
    // duration_ms=0 → run until disconnect or explicit stop
    s_duration_ms = (duration_ms == 0) ? 0 : max(duration_ms, (uint32_t)1000);
    s_sent_notifications = 0;
    s_sent_bytes = 0;
    s_cam_frames = 0;
    s_cam_bytes = 0;
    s_last_log_ms = s_started_ms;
    s_next_notify_ms = s_started_ms;
    kl_logf("[ble_cam] start duration_ms=%lu payload_bytes=%u gap_ms=%u frame=%s q=%d\n",
            (unsigned long)s_duration_ms,
            (unsigned)s_payload_bytes,
            (unsigned)s_notify_gap_ms,
            camera_frame_size_name(),
            camera_jpeg_quality());
}

static void log_perf(uint32_t now) {
    if (now - s_last_log_ms < 1000) return;
    uint32_t elapsed = now - s_started_ms;
    if (elapsed == 0) elapsed = 1;

    if (s_mode == BLE_TEST_CAMERA) {
        kl_logf("[ble_cam] perf elapsed_ms=%lu frames=%lu bytes=%lu kBps=%.2f notifications=%lu payload_bytes=%u gap_ms=%u\n",
                (unsigned long)elapsed,
                (unsigned long)s_cam_frames,
                (unsigned long)s_cam_bytes,
                (float)s_cam_bytes / (float)elapsed,
                (unsigned long)s_sent_notifications,
                (unsigned)s_payload_bytes,
                (unsigned)s_notify_gap_ms);
    } else {
        kl_logf("[ble] perf elapsed_ms=%lu notifications=%lu bytes=%lu kBps=%.2f payload_bytes=%u gap_ms=%u\n",
                (unsigned long)elapsed,
                (unsigned long)s_sent_notifications,
                (unsigned long)s_sent_bytes,
                (float)s_sent_bytes / (float)elapsed,
                (unsigned)s_payload_bytes,
                (unsigned)s_notify_gap_ms);
    }
    s_last_log_ms = now;
}

static void send_throughput_packet() {
    uint8_t payload[180];
    const uint16_t len = min<uint16_t>(s_payload_bytes, sizeof(payload));
    payload[0] = (uint8_t)(s_seq & 0xff);
    payload[1] = (uint8_t)((s_seq >> 8) & 0xff);
    payload[2] = (uint8_t)((s_seq >> 16) & 0xff);
    payload[3] = (uint8_t)((s_seq >> 24) & 0xff);
    for (uint16_t i = 4; i < len; i++) {
        payload[i] = (uint8_t)(i + s_seq);
    }
    notify_bytes(payload, len);
    s_seq++;
}

static bool capture_camera_frame() {
    release_camera_frame();
    const uint32_t t0 = millis();
    s_cam_fb = esp_camera_fb_get();
    const uint32_t cap_ms = millis() - t0;
    if (!s_cam_fb || s_cam_fb->format != PIXFORMAT_JPEG) {
        release_camera_frame();
        s_cam_fail_count++;
        kl_logf("[ble_cam] capture_failed cap_ms=%lu fail_count=%u\n",
                (unsigned long)cap_ms, (unsigned)s_cam_fail_count);
        if (s_cam_fail_count >= CAM_FAIL_RESET_THRESHOLD) {
            // Camera may be stuck; mark not-ready so ensure_camera_ready() will reinit.
            kl_logln("[ble_cam] too_many_failures resetting camera_ready");
            s_camera_ready = false;
            s_cam_fail_count = 0;
            s_mode = BLE_TEST_IDLE;
        }
        s_next_notify_ms = millis() + 500;
        return false;
    }

    s_cam_fail_count = 0;
    s_cam_frame_id++;
    s_cam_offset = 0;
    s_cam_chunk_index = 0;
    s_cam_total_chunks = (s_cam_fb->len + s_payload_bytes - 1) / s_payload_bytes;
    s_cam_meta_pending = true;
    kl_logf("[ble_cam] frame_start id=%lu bytes=%lu chunks=%u cap_ms=%lu\n",
            (unsigned long)s_cam_frame_id,
            (unsigned long)s_cam_fb->len,
            (unsigned)s_cam_total_chunks,
            (unsigned long)cap_ms);
    return true;
}

static void send_camera_packet() {
    if (!s_cam_fb && !capture_camera_frame()) return;

    if (s_cam_meta_pending) {
        String meta = "CAM:";
        meta += s_cam_frame_id;
        meta += ":";
        meta += s_cam_fb->len;
        meta += ":";
        meta += s_cam_total_chunks;
        meta += ":";
        meta += camera_frame_size_name();
        meta += ":";
        meta += camera_jpeg_quality();
        notify_text(meta);
        s_cam_meta_pending = false;
        return;
    }

    const size_t remaining = s_cam_fb->len - s_cam_offset;
    const uint16_t len = min<uint16_t>(s_payload_bytes, remaining);
    notify_bytes(s_cam_fb->buf + s_cam_offset, len);
    s_cam_offset += len;
    s_cam_chunk_index++;

    if (s_cam_offset >= s_cam_fb->len) {
        const size_t frame_len = s_cam_fb->len;
        s_cam_frames++;
        s_cam_bytes += frame_len;
        kl_logf("[ble_cam] frame_done id=%lu bytes=%lu chunks=%u frames=%lu\n",
                (unsigned long)s_cam_frame_id,
                (unsigned long)frame_len,
                (unsigned)s_cam_chunk_index,
                (unsigned long)s_cam_frames);
        release_camera_frame();
    }
}

class BleServerCallbacks final : public BLEServerCallbacks {
    void onConnect(BLEServer*) override {
        s_connect_pending = true;
    }

    void onDisconnect(BLEServer*) override {
        s_disconnect_pending = true;
    }
};

class BleRxCallbacks final : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic* characteristic) override {
        queue_command(characteristic->getValue());
    }
};

static void handle_pending_ble_events() {
    if (s_connect_pending) {
        s_connect_pending = false;
        s_connected = true;
        kl_logln("[ble] connected");
    }

    if (s_disconnect_pending) {
        s_disconnect_pending = false;
        stop_test("disconnect");
        s_connected = false;
        kl_logln("[ble] disconnected action=advertise");
        restart_advertising();
    }

    if (s_command_tail == s_command_head) return;

    char cmd_buf[sizeof(s_pending_commands[0])];
    strncpy(cmd_buf, s_pending_commands[s_command_tail], sizeof(cmd_buf));
    cmd_buf[sizeof(cmd_buf) - 1] = '\0';
    s_command_tail = (uint8_t)((s_command_tail + 1) % 12);

    String cmd(cmd_buf);
    cmd.trim();

    if (cmd.startsWith("size")) {
        const uint32_t requested = parse_uint_after(cmd, "=", s_payload_bytes);
        s_payload_bytes = (uint16_t)constrain(requested, 8UL, 180UL);
        kl_logf("[ble] payload_size bytes=%u\n", (unsigned)s_payload_bytes);
        return;
    }

    if (cmd.startsWith("gap")) {
        const uint32_t requested = parse_uint_after(cmd, "=", s_notify_gap_ms);
        s_notify_gap_ms = (uint16_t)constrain(requested, 4UL, 100UL);
        kl_logf("[ble] notify_gap ms=%u\n", (unsigned)s_notify_gap_ms);
        return;
    }

    if (cmd.startsWith("start")) {
        start_throughput_test(parse_uint_after(cmd, "=", s_duration_ms));
        return;
    }

    if (cmd.startsWith("cam")) {
        start_camera_test(parse_uint_after(cmd, "=", s_duration_ms));
        return;
    }

    if (cmd == "stop") {
        stop_test("client_stop");
        return;
    }

    if (cmd.startsWith("mode=")) {
        String m = cmd.substring(5);
        if (m == "wifi" || m == "ble") {
            stop_test("mode_switch");
            Preferences p;
            p.begin("kl_mode", false);
            p.putString("mode", m);
            p.end();
            kl_logf("[mode] ble_switch to=%s action=reboot\n", m.c_str());
            delay(300);
            ESP.restart();
        }
        return;
    }

    if (cmd.startsWith("q=")) {
        camera_set_quality((int)parse_uint_after(cmd, "=", (uint32_t)camera_jpeg_quality()));
        return;
    }

    if (cmd.startsWith("res=")) {
        camera_set_framesize(cmd.substring(4).c_str());
        return;
    }

    // brightness, contrast, saturation, sharpness, ae_level, vflip, hmirror
    {
        static const char* const SENSOR_PARAMS[] = {
            "brightness", "contrast", "saturation", "sharpness", "ae_level", "vflip", "hmirror"
        };
        for (size_t i = 0; i < sizeof(SENSOR_PARAMS)/sizeof(SENSOR_PARAMS[0]); i++) {
            const char* key = SENSOR_PARAMS[i];
            const size_t klen = strlen(key);
            if (cmd.length() > klen + 1 &&
                strncmp(cmd.c_str(), key, klen) == 0 &&
                cmd[klen] == '=') {
                camera_set_sensor_param(key, parse_int_after(cmd, "=", 0));
                return;
            }
        }
    }

    kl_logf("[ble] unknown_command value=\"%s\"\n", cmd.c_str());
}

void ble_test_begin() {
    const String name = "KineticLife-BLE-" + ble_device_id();
    BLEDevice::init(name.c_str());
    BLEDevice::setMTU(185);

    s_server = BLEDevice::createServer();
    s_server->setCallbacks(new BleServerCallbacks());

    BLEService* service = s_server->createService(BLE_SERVICE_UUID);
    s_tx = service->createCharacteristic(
        BLE_TX_UUID,
        BLECharacteristic::PROPERTY_NOTIFY | BLECharacteristic::PROPERTY_READ);
    s_tx->addDescriptor(new BLE2902());

    BLECharacteristic* rx = service->createCharacteristic(
        BLE_RX_UUID,
        BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
    rx->setCallbacks(new BleRxCallbacks());

    service->start();
    restart_advertising();

    kl_logf("[ble] ready name=%s service=%s tx=%s rx=%s mtu_request=185\n",
            name.c_str(),
            BLE_SERVICE_UUID,
            BLE_TX_UUID,
            BLE_RX_UUID);
}

void ble_test_mark_camera_ready() {
    s_camera_ready = true;
}

void ble_test_handle() {
    handle_pending_ble_events();

    if (!s_connected || s_mode == BLE_TEST_IDLE || !s_tx) return;

    const uint32_t now = millis();
    if (s_duration_ms > 0 && now - s_started_ms >= s_duration_ms) {
        stop_test("duration_complete");
        return;
    }
    if ((int32_t)(now - s_next_notify_ms) < 0) return;

    if (s_mode == BLE_TEST_CAMERA) send_camera_packet();
    else send_throughput_packet();

    log_perf(now);
}

#else

void ble_test_begin() {}
void ble_test_handle() {}
void ble_test_mark_camera_ready() {}

#endif
