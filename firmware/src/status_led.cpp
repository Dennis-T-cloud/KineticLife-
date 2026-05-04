#include "status_led.h"

#include <Arduino.h>
#include "debug_log.h"

#ifndef STATUS_RGB_PIN
#if defined(RGB_BUILTIN)
#define STATUS_RGB_PIN RGB_BUILTIN
#else
#define STATUS_RGB_PIN 48
#endif
#endif

static DeviceState s_state = DEVICE_STATE_BOOT;
static bool s_on = false;
static unsigned long s_last_toggle_ms = 0;
static unsigned long s_pattern_start_ms = 0;
static unsigned long s_last_render_ms = 0;

static const unsigned long LED_RENDER_MS = 20;

static const char* state_name(DeviceState state) {
    switch (state) {
        case DEVICE_STATE_BOOT: return "boot";
        case DEVICE_STATE_PAIRING: return "pairing";
        case DEVICE_STATE_CONNECTING: return "connecting";
        case DEVICE_STATE_READY: return "ready";
        case DEVICE_STATE_STREAMING: return "streaming";
        case DEVICE_STATE_ERROR: return "error";
        case DEVICE_STATE_FATAL: return "fatal";
        default: return "unknown";
    }
}

static const char* state_color_name(DeviceState state) {
    switch (state) {
        case DEVICE_STATE_PAIRING: return "blue";
        case DEVICE_STATE_CONNECTING: return "yellow";
        case DEVICE_STATE_READY:
        case DEVICE_STATE_STREAMING: return "green";
        case DEVICE_STATE_ERROR:
        case DEVICE_STATE_FATAL: return "red";
        case DEVICE_STATE_BOOT:
        default: return "white";
    }
}

static const char* state_pattern_name(DeviceState state) {
    switch (state) {
        case DEVICE_STATE_PAIRING: return "breathe_4p2s";
        case DEVICE_STATE_CONNECTING: return "blink_2hz";
        case DEVICE_STATE_STREAMING: return "breathe_3p6s";
        case DEVICE_STATE_ERROR: return "blink_1hz";
        default: return "solid";
    }
}

static void write_rgb(uint8_t r, uint8_t g, uint8_t b) {
#if STATUS_RGB_PIN >= 0
    neopixelWrite(STATUS_RGB_PIN, r, g, b);
#else
    (void)r;
    (void)g;
    (void)b;
#endif
}

static void state_color(DeviceState state, uint8_t* r, uint8_t* g, uint8_t* b) {
    *r = 0;
    *g = 0;
    *b = 0;

    switch (state) {
        case DEVICE_STATE_PAIRING:
            *b = 32;
            break;
        case DEVICE_STATE_CONNECTING:
            *r = 32;
            *g = 24;
            break;
        case DEVICE_STATE_READY:
        case DEVICE_STATE_STREAMING:
            *g = 32;
            break;
        case DEVICE_STATE_ERROR:
        case DEVICE_STATE_FATAL:
            *r = 32;
            break;
        case DEVICE_STATE_BOOT:
        default:
            *r = 16;
            *g = 16;
            *b = 16;
            break;
    }
}

static unsigned long blink_period_ms(DeviceState state) {
    switch (state) {
        case DEVICE_STATE_ERROR:
            return 500;
        case DEVICE_STATE_CONNECTING:
            return 250;
        default:
            return 0;
    }
}

static unsigned long breathe_period_ms(DeviceState state) {
    switch (state) {
        case DEVICE_STATE_PAIRING:
            return 4200;
        case DEVICE_STATE_STREAMING:
            return 3600;
        default:
            return 0;
    }
}

static uint8_t smoothstep8(uint8_t x) {
    const uint32_t xx = (uint32_t)x * x;
    return (uint8_t)((xx * (765 - 2 * (uint32_t)x)) / (255UL * 255UL));
}

static uint8_t breathe_level(unsigned long now_ms, unsigned long period_ms) {
    const unsigned long phase = (now_ms - s_pattern_start_ms) % period_ms;
    const unsigned long half = period_ms / 2;
    const uint8_t ramp = (phase < half)
        ? (uint8_t)((phase * 255UL) / half)
        : (uint8_t)(((period_ms - phase) * 255UL) / half);
    const uint8_t eased = smoothstep8(ramp);
    return 2 + (uint8_t)((eased * 253UL) / 255UL);
}

static void scale_color(uint8_t* r, uint8_t* g, uint8_t* b, uint8_t level) {
    *r = (uint8_t)((*r * (uint16_t)level) / 255U);
    *g = (uint8_t)((*g * (uint16_t)level) / 255U);
    *b = (uint8_t)((*b * (uint16_t)level) / 255U);
}

void status_led_begin() {
    write_rgb(0, 0, 0);
    s_on = true;
    s_last_toggle_ms = millis();
    s_pattern_start_ms = s_last_toggle_ms;
    s_last_render_ms = 0;
    s_state = DEVICE_STATE_BOOT;
    status_led_handle();
    kl_logf("[led] state=%s color=%s pattern=%s pin=%d\n",
            state_name(s_state),
            state_color_name(s_state),
            state_pattern_name(s_state),
            STATUS_RGB_PIN);
}

void status_led_set(DeviceState state) {
    if (s_state == state) return;
    DeviceState previous = s_state;
    s_state = state;
    s_on = true;
    s_last_toggle_ms = millis();
    s_pattern_start_ms = s_last_toggle_ms;
    s_last_render_ms = 0;
    status_led_handle();
    kl_logf("[led] state=%s previous=%s color=%s pattern=%s pin=%d\n",
            state_name(s_state),
            state_name(previous),
            state_color_name(s_state),
            state_pattern_name(s_state),
            STATUS_RGB_PIN);
}

DeviceState status_led_state() {
    return s_state;
}

const char* status_led_state_name() {
    return state_name(s_state);
}

void status_led_handle() {
    const unsigned long now = millis();
    if (s_last_render_ms != 0 && now - s_last_render_ms < LED_RENDER_MS) return;
    s_last_render_ms = now;

    const unsigned long period_ms = blink_period_ms(s_state);
    const unsigned long breath_ms = breathe_period_ms(s_state);
    if (period_ms > 0 && now - s_last_toggle_ms >= period_ms) {
        s_last_toggle_ms = now;
        s_on = !s_on;
    } else if (period_ms == 0) {
        s_on = true;
    }

    if (!s_on) {
        write_rgb(0, 0, 0);
        return;
    }

    uint8_t r;
    uint8_t g;
    uint8_t b;
    state_color(s_state, &r, &g, &b);
    if (breath_ms > 0) {
        const uint8_t level = breathe_level(now, breath_ms);
        scale_color(&r, &g, &b, level);
    }
    write_rgb(r, g, b);
}
