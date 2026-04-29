#pragma once

#include <cstdarg>
#include <cstdio>

#include <Arduino.h>
#include <esp_rom_sys.h>

inline void kl_logf(const char* format, ...) {
    char buffer[256];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);

    esp_rom_printf("%s", buffer);
    Serial.print(buffer);
}

inline void kl_logln(const char* message) {
    kl_logf("%s\n", message);
}
