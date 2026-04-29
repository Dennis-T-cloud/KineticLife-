#pragma once
#include <stdint.h>

void http_server_start(const char* fw_version, const char* board_model,
                       const char* cam_model);
void http_server_handle();
uint32_t http_server_stream_count();
