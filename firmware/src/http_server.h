#pragma once
#include <stdint.h>

void http_server_start(const char* fw_version, const char* board_model,
                       const char* cam_model);
void http_server_handle();       // call every loop tick — runs ws.cleanupClients()
void http_server_push_frame();   // call every loop tick — captures and broadcasts one JPEG frame
uint32_t http_server_stream_count();
