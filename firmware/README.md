# KineticLife Firmware

ESP32-S3 firmware workspace for camera bring-up, WiFi QR pairing, MJPEG streaming, and LED/watchdog behavior.

## Hardware Baseline

- Board: Freenove ESP32-S3-WROOM Board (N16R8), FNK0085 B
- Camera: OV2640
- Memory target: 16 MB Flash / 8 MB PSRAM

## Quick Start

```bash
pio run
pio run --target upload
pio device monitor
```

## WiFi QR Pairing

The firmware stores WiFi credentials in NVS only as the active demo session. There is no default hotspot fallback. Boot behavior:

- NVS has an active session: connect to WiFi, start `/hello`, `/status`, `/stream`, and `/end`.
- NVS is empty: initialize the OV2640 in grayscale mode and scan for a WiFi QR code.

Current pairing QR format:

```text
K1:W:<SSID_LEN>:<SSID><PASSWORD>
```

The firmware also accepts the standard `WIFI:S:<SSID>;T:WPA;P:<PASSWORD>;;` format for compatibility. The Web pair page at `web/pair.html` generates the compact payload. Use a 2.4 GHz phone hotspot, set phone brightness to 100%, and hold the QR about 30 cm from the ESP32 camera.

When the user finishes, `web/cam.html` calls:

```text
POST http://<ESP32-IP>/end
```

ESP32 clears the temporary NVS session and reboots back to QR pairing mode.

To clear saved WiFi and force pairing again:

```bash
pio run --target erase
pio run --target upload
```

`src/config.h` is not used for default WiFi credentials in this session-based flow.

The external HTTP and pairing contracts are defined in `../docs/04_Interface_Contracts.md`.
