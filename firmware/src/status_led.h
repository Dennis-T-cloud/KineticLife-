#pragma once

enum DeviceState {
    DEVICE_STATE_BOOT,
    DEVICE_STATE_PAIRING,
    DEVICE_STATE_CONNECTING,
    DEVICE_STATE_READY,
    DEVICE_STATE_STREAMING,
    DEVICE_STATE_ERROR,
    DEVICE_STATE_FATAL
};

void status_led_begin();
void status_led_set(DeviceState state);
DeviceState status_led_state();
const char* status_led_state_name();
void status_led_handle();
