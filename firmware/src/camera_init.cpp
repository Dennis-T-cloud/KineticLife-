#include "camera_init.h"
#include <Arduino.h>
#include "debug_log.h"

// Freenove ESP32-S3-WROOM Board (FNK0085 B) pin mapping
// Source: https://github.com/Freenove/Freenove_ESP32_S3_WROOM_Board
// Verify against official repo if camera init fails (error 0x105 = pin conflict)
#define PWDN_GPIO_NUM   -1
#define RESET_GPIO_NUM  -1
#define XCLK_GPIO_NUM   15
#define SIOD_GPIO_NUM    4
#define SIOC_GPIO_NUM    5
#define Y9_GPIO_NUM     16
#define Y8_GPIO_NUM     17
#define Y7_GPIO_NUM     18
#define Y6_GPIO_NUM     12
#define Y5_GPIO_NUM     10
#define Y4_GPIO_NUM      8
#define Y3_GPIO_NUM      9
#define Y2_GPIO_NUM     11
#define VSYNC_GPIO_NUM   6
#define HREF_GPIO_NUM    7
#define PCLK_GPIO_NUM   13

static const char* s_camera_mode = "not_initialized";
static framesize_t s_frame_size = FRAMESIZE_INVALID;
static pixformat_t s_pixel_format = PIXFORMAT_RGB565;
static int s_jpeg_quality = -1;

static const char* frame_size_name(framesize_t frame_size) {
    switch (frame_size) {
        case FRAMESIZE_240X240: return "240x240";
        case FRAMESIZE_QQVGA: return "160x120";
        case FRAMESIZE_QVGA: return "320x240";
        case FRAMESIZE_VGA: return "640x480";
        default: return "unknown";
    }
}

static const char* pixel_format_name(pixformat_t pixel_format) {
    switch (pixel_format) {
        case PIXFORMAT_JPEG: return "JPEG";
        case PIXFORMAT_GRAYSCALE: return "GRAYSCALE";
        default: return "unknown";
    }
}

static bool camera_init_with(pixformat_t pixel_format, framesize_t frame_size,
                             int jpeg_quality, int fb_count,
                             camera_fb_location_t fb_location) {
    const unsigned long init_start_ms = millis();
    camera_config_t config;
    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer   = LEDC_TIMER_0;
    config.pin_d0       = Y2_GPIO_NUM;
    config.pin_d1       = Y3_GPIO_NUM;
    config.pin_d2       = Y4_GPIO_NUM;
    config.pin_d3       = Y5_GPIO_NUM;
    config.pin_d4       = Y6_GPIO_NUM;
    config.pin_d5       = Y7_GPIO_NUM;
    config.pin_d6       = Y8_GPIO_NUM;
    config.pin_d7       = Y9_GPIO_NUM;
    config.pin_xclk     = XCLK_GPIO_NUM;
    config.pin_pclk     = PCLK_GPIO_NUM;
    config.pin_vsync    = VSYNC_GPIO_NUM;
    config.pin_href     = HREF_GPIO_NUM;
    config.pin_sccb_sda = SIOD_GPIO_NUM;
    config.pin_sccb_scl = SIOC_GPIO_NUM;
    config.pin_pwdn     = PWDN_GPIO_NUM;
    config.pin_reset    = RESET_GPIO_NUM;
    config.xclk_freq_hz = 20000000;
    config.pixel_format = pixel_format;
    config.frame_size   = frame_size;
    config.jpeg_quality = jpeg_quality;
    config.fb_count     = fb_count;
    config.grab_mode    = CAMERA_GRAB_LATEST;
    config.fb_location  = fb_location;

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        kl_logf("[camera] init_failed err=0x%x\n", err);
        return false;
    }

    sensor_t* s = esp_camera_sensor_get();
    s->set_framesize(s, frame_size);
    s->set_quality(s, jpeg_quality);
    s->set_whitebal(s, 1);
    s->set_awb_gain(s, 1);
    s->set_contrast(s, 2);
    s->set_brightness(s, -1);
    s->set_saturation(s, -2);
    s->set_sharpness(s, 2);
    s->set_gain_ctrl(s, 1);
    s->set_exposure_ctrl(s, 1);
    s->set_aec2(s, 1);
    s->set_ae_level(s, -1);

    s_frame_size = frame_size;
    s_pixel_format = pixel_format;
    s_jpeg_quality = jpeg_quality;

    kl_logf("[camera] mode=%s format=%s frame=%s quality=%d fb_count=%d fb=%s init_ms=%lu heap_kb=%lu psram_free_kb=%lu psram_size_kb=%lu\n",
            s_camera_mode,
            pixel_format_name(pixel_format),
            frame_size_name(frame_size),
            jpeg_quality,
            fb_count,
            fb_location == CAMERA_FB_IN_PSRAM ? "PSRAM" : "DRAM",
            millis() - init_start_ms,
            (unsigned long)(ESP.getFreeHeap() / 1024),
            (unsigned long)(ESP.getFreePsram() / 1024),
            (unsigned long)(ESP.getPsramSize() / 1024));
    return true;
}

bool camera_set_framesize(const char* size_str) {
    sensor_t* s = esp_camera_sensor_get();
    if (!s) return false;
    framesize_t fs = FRAMESIZE_INVALID;
    if      (strcmp(size_str, "160x120") == 0) fs = FRAMESIZE_QQVGA;
    else if (strcmp(size_str, "240x240") == 0) fs = FRAMESIZE_240X240;
    else if (strcmp(size_str, "320x240") == 0) fs = FRAMESIZE_QVGA;
    if (fs == FRAMESIZE_INVALID) return false;
    if (fs == s_frame_size) return true;
    s->set_framesize(s, fs);
    s_frame_size = fs;
    return true;
}

bool camera_set_quality(int q) {
    if (q < 4 || q > 63) return false;
    if (q == s_jpeg_quality) return true;
    sensor_t* s = esp_camera_sensor_get();
    if (!s) return false;
    s->set_quality(s, q);
    s_jpeg_quality = q;
    return true;
}

bool camera_init() {
    s_camera_mode = "stream";
    // fb_count=2 in PSRAM: camera DMA uses the SPI bus, WiFi DMA stays on
    // internal bus — eliminates the throughput collision that caused ~0.3 FPS.
    // QVGA (320x240) uses a wider crop of the OV3660 sensor → larger FOV at 1m.
    // OV3660 at q=12 produces smaller JPEG than OV2640 q=15 at comparable quality.
    return camera_init_with(PIXFORMAT_JPEG, FRAMESIZE_QVGA, 12, 2,
                            CAMERA_FB_IN_PSRAM);
}

bool camera_init_qr() {
    s_camera_mode = "pairing";
    return camera_init_with(PIXFORMAT_GRAYSCALE, FRAMESIZE_QVGA, 12, 1,
                            CAMERA_FB_IN_DRAM);
}

const char* camera_mode_name() {
    return s_camera_mode;
}

const char* camera_frame_size_name() {
    return frame_size_name(s_frame_size);
}

const char* camera_pixel_format_name() {
    return pixel_format_name(s_pixel_format);
}

int camera_jpeg_quality() {
    return s_jpeg_quality;
}
