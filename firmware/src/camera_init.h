#pragma once
#include "esp_camera.h"

bool camera_init();
bool camera_init_ble();
bool camera_init_qr();
void camera_deinit();
bool camera_capture_self_test(uint8_t attempts, uint32_t retry_delay_ms);
bool camera_set_framesize(const char* size_str);
bool camera_set_quality(int q);
bool camera_set_sensor_param(const char* name, int val);
const char* camera_mode_name();
const char* camera_frame_size_name();
const char* camera_pixel_format_name();
int camera_jpeg_quality();
