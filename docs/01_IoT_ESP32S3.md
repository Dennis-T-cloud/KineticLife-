# 01 - IoT / ESP32-S3 Firmware

> Last updated: 2026-05-26
> Hardware baseline: Freenove ESP32-S3-WROOM Board (N16R8), FNK0085 B, OV2640 140-degree camera

This document describes the active firmware in `firmware/src/`.

---

## Current Scope

Firmware owns:

- boot-mode selection stored in NVS
- BLE camera snapshot streaming and test commands
- WiFi QR parsing and preset-network pairing
- HTTP diagnostics and camera tuning
- binary JPEG WebSocket streaming
- RGB status LED behavior
- session cleanup and mode switching

Firmware does not run MediaPipe, rep counting, DTW, or cloud advice.

---

## File Map

| File | Responsibility |
| --- | --- |
| `main.cpp` | boot flow, mode selection, WiFi connection, main loop |
| `ble_test.cpp` / `.h` | BLE GATT service, throughput test, camera snapshot chunks, mode commands |
| `http_server.cpp` / `.h` | Async HTTP routes, WebSocket stream, token gate, mDNS |
| `wifi_qr.cpp` / `.h` | QR decode, compact/standard WiFi payload parsing, NVS WiFi session |
| `wifi_ap_config.cpp` / `.h` | `KineticLife-Setup` Soft AP and preset-network config server |
| `camera_init.cpp` / `.h` | stream, QR, and BLE camera modes |
| `status_led.cpp` / `.h` | LED state and blink patterns |
| `config.h` | local preset networks; gitignored |

Third-party QR code detection is vendored in `firmware/lib/quirc/`.

---

## Boot Modes

Default mode is BLE unless `kl_mode.mode` in NVS is set to `wifi`.

| Mode | Behavior |
| --- | --- |
| `ble` | waits for OV2640 power stabilization, initializes a low-resolution camera mode when possible, advertises BLE, skips WiFi/HTTP/WS |
| `wifi` | loads WiFi session or enters pairing, starts HTTP server and `/ws` stream after network connection |

Mode switch commands:

```text
BLE RX:   mode=wifi
BLE RX:   mode=ble
HTTP:     GET/POST /mode?set=wifi
HTTP:     GET/POST /mode?set=ble
```

Double reset within the boot window clears WiFi credentials and restores the default BLE mode.

---

## BLE Camera Mode

BLE name:

```text
KineticLife-BLE-<mac6>
```

GATT UUIDs:

| Item | UUID | Direction |
| --- | --- | --- |
| Service | `9b8f0001-6f4d-4d4f-9c9a-4b4c49464501` | discover |
| TX notify | `9b8f0002-6f4d-4d4f-9c9a-4b4c49464501` | ESP32 to browser |
| RX control | `9b8f0003-6f4d-4d4f-9c9a-4b4c49464501` | browser to ESP32 |

Supported text commands:

```text
mode=wifi
mode=ble
size=<8..180>
gap=<4..100>
start=<1000..60000>
cam=<0..60000>
stop
```

`start` runs synthetic throughput notifications. `cam` starts camera snapshots. Camera metadata is sent as ASCII:

```text
CAM:<frame_id>:<bytes>:<chunks>:<size>:<q>
```

Raw JPEG chunks follow over TX notifications until the frame byte count is complete.

Browser support note: Web Bluetooth works in Chromium-based browsers from HTTPS or `localhost`; iOS Safari does not expose Web Bluetooth.

---

## WiFi Pairing Mode

WiFi mode has two pairing paths when no active session is stored.

### QR Path

The camera scans either compact KineticLife QR payloads or standard WiFi QR strings:

```text
K1:<TYPE_CODE>:<SSID_LEN>:<SSID><PASSWORD>
WIFI:S:<SSID>;T:<TYPE>;P:<PASSWORD>;;
```

`TYPE_CODE` is `W`, `E`, or `N` for WPA/WPA2, WEP, or no password.

### Preset-Network Soft AP Path

Firmware starts a Soft AP:

```text
SSID: KineticLife-Setup
Password: kineticlife
URL: http://192.168.4.1
```

The AP exposes preset networks from local `firmware/src/config.h`:

| Endpoint | Purpose |
| --- | --- |
| `/` | minimal config page |
| `/config-networks` | list preset SSIDs and auth types |
| `/try-config?idx=N` | try one preset |
| `/config-status` | report connecting/connected/failed |

`config.h` is local and gitignored. Do not document or commit real credentials.

---

## WiFi HTTP and WebSocket API

Main WiFi endpoints from `http_server.cpp`:

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/hello` | GET | device identity, firmware metadata, WebSocket token |
| `/status` | GET | WiFi, heap, PSRAM, camera, stream counters |
| `/capture` | GET | one JPEG snapshot |
| `/cam` | GET/POST | deferred camera tuning |
| `/mode` | GET/POST | switch between BLE and WiFi modes |
| `/end` | GET/POST | clear WiFi credentials and reboot |
| `/ws` | WebSocket | binary JPEG stream |

`/hello` includes `ws_token`. Current firmware installs a token gate for `/ws`; clients should open:

```text
ws://<device>/ws?token=<ws_token>
```

Known integration gap: several current web callers still open `/ws` without the token. Update web before relying on WiFi streaming.

---

## WebSocket Stream

Transport behavior:

- each message is one complete JPEG
- maximum JPEG size is 256 KB
- target throttle is 67 ms per frame
- actual QVGA OV2640 throughput is camera-bound, commonly around 9 FPS
- latest-frame policy: send only to connected clients with an empty queue
- slow clients skip stale frames instead of accumulating latency
- `ws.cleanupClients()` runs from the main loop

Camera tuning parameters accepted by `/cam`:

```text
res, q, brightness, contrast, saturation, sharpness, ae_level, vflip, hmirror
```

The request handler only records pending values; sensor writes are applied later from `http_server_handle()` to avoid blocking the async TCP task.

---

## Camera Modes

| Mode | Function | Notes |
| --- | --- | --- |
| WiFi stream | `camera_init()` | QVGA JPEG, 2 PSRAM frame buffers |
| QR pairing | `camera_init_qr()` | grayscale QVGA, DRAM buffer |
| BLE camera | `camera_init_ble()` | low-resolution JPEG snapshots for GATT chunking |

Keep these constraints:

- PSRAM memory type must stay configured for the Freenove N16R8 board.
- XCLK must stay at the tested value for FNK0085 B stability.
- OV2640 needs several seconds of power stabilization before BLE camera self-test is reliable.

---

## LED States

| State | Meaning |
| --- | --- |
| boot | startup |
| pairing | WiFi pairing / QR / Soft AP |
| connecting | WiFi connect attempt |
| ready | BLE ready or WiFi HTTP server ready |
| streaming | WiFi WebSocket client connected |
| error | recoverable problem |
| fatal | camera or hardware initialization failure |

The LED is part of the operator UI. Keep it aligned with `status_led_state_name()` because `/hello` and `/status` expose that same state.

---

## Verification

```bash
cd firmware
pio run
pio run --target upload
pio device monitor
```

Useful smoke tests:

- BLE advertises as `KineticLife-BLE-<mac6>`
- BLE `cam=0` produces JPEG frames in `pair.html`
- BLE `mode=wifi` reboots into WiFi flow
- WiFi `/hello` returns `ws_token`
- WiFi `/capture` returns a JPEG
- WebSocket client uses `/ws?token=...`
- `/end` clears WiFi session and reboots
