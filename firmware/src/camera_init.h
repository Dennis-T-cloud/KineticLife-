#pragma once
#include "esp_camera.h"

bool camera_init();
bool camera_init_qr();
bool camera_set_framesize(const char* size_str);
bool camera_set_quality(int q);
const char* camera_mode_name();
const char* camera_frame_size_name();
const char* camera_pixel_format_name();
int camera_jpeg_quality();
