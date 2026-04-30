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

## Camera Configuration

Current streaming mode (`camera_init()`):

| Parameter | Value | Notes |
| --------- | ----- | ----- |
| Resolution | FRAMESIZE_QVGA (320×240) | QVGA uses a wider sensor crop → larger FOV at 1m |
| JPEG quality | 12 | Lower = higher quality; OV2640 efficient at q=12 |
| Frame buffers | 2 in PSRAM | fb_count=2 eliminates DMA bus contention with WiFi |
| XCLK | 20 MHz | Hard limit on FNK0085B — 24 MHz causes screen tearing |
| Target fps | 20 (50ms/frame) | Set in `http_server.cpp` `target_ms=50` |

QR pairing mode (`camera_init_qr()`): GRAYSCALE QVGA, 1 buffer in DRAM.

## Performance Log Guide

The firmware prints low-rate tuning logs over serial. Stats are logged every ~30 frames (~1.5 s at 20 fps). Useful lines:

```text
[camera] mode=stream format=JPEG frame=320x240 quality=12 fb_count=2 fb=PSRAM init_ms=... heap_kb=... psram_free_kb=...
[perf] camera_init_ms=...
[perf] wifi_connect_ms=...
[perf] http_start_ms=... setup_total_ms=...
[perf] stream_first_frame first_frame_ms=... capture_ms=... write_ms=... jpeg_bytes=...
[perf] stream ... fps=... capture_ms_avg=... write_ms_avg=... jpeg_avg=... rssi=... quality=... heap_kb=... psram_free_kb=...
[warn] stream_write_slow_or_short ...
```

How to read them:

- `[camera]` line at boot: confirms `frame=320x240` (not overridden by stream URL) and PSRAM is active.
- High `first_frame_ms`: startup or first browser connection is slow.
- High `capture_ms_avg` or `capture_ms_max`: camera/PSRAM/frame-size path is slow.
- High `write_ms_avg` or `write_ms_max`: WiFi/TCP/client read path is slow; check hotspot distance, RSSI, channel congestion, and phone/browser load.
- Low `rssi` or `quality`: network link is weak. Keep RSSI better than about `-65 dBm` for smooth streaming.
- `psram_size_kb=0` or very low `psram_free_kb`: PSRAM configuration is wrong or exhausted; streaming will be unstable.

## Web Debug Page (`web/debug.html`)

The debug page streams from `/stream?res=320x240&q=12` and renders a **portrait 240×320 canvas** with a 90° CW rotation applied in JavaScript (landscape MJPEG → portrait display). The ESP32 camera module must be physically rotated 90° to match.

MediaPipe runs in VIDEO mode on a 120×160 offscreen canvas. Status bar shows `detect_ms  avg:Xms  vis:N/33  skip:X%`. Normal values at 20fps on a 60Hz display: skip 60–80%, detect avg 20–40ms.

**Important**: the stream URL must include `res=320x240`. Any other resolution triggers `apply_stream_args()` which reconfigures the sensor at stream start, causing body distortion (e.g. `res=240x240` stretches a 240×240 JPEG into the 320×240 canvas).
