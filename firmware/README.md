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

The external HTTP and pairing contracts are defined in `../docs/04_Interface_Contracts.md`.
