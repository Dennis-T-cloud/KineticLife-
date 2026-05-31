# KineticLife

Real-time fitness tracking and form feedback for an ESP32-S3 camera device. The current project combines:

- Freenove ESP32-S3-WROOM Board (N16R8), model FNK0085 B, with an OV2640 140-degree camera
- BLE camera snapshot streaming as the default firmware boot path
- WiFi mode with QR or preset-network pairing, HTTP diagnostics, and binary JPEG WebSocket video
- A Vite/React SPA plus static demo/debug pages that run MediaPipe in the browser
- A FastAPI DTW service for summary-time action analysis from 14-D joint-angle sequences

Raw video is processed locally in the browser. Server calls use derived joint-angle frames only.

**Status**: `feature-homeworkout` branch, documentation refreshed 2026-05-30.

---

## Repository Layout

```text
KineticLife-/
├── README.md
├── docs/
│   ├── 00_System_Overview.md
│   ├── 01_IoT_ESP32S3.md
│   ├── 02_Web_MediaPipe.md
│   ├── 03_Cloud_DTW.md
│   ├── 04_Interface_Contracts.md
│   ├── Codebase_Study_Notes.md
│   └── _archive_v0.3/
├── firmware/
│   ├── platformio.ini
│   ├── cam_setup.md
│   ├── lib/quirc/
│   └── src/
├── web/
│   ├── index.html
│   ├── pair.html
│   ├── debug.html
│   ├── demo.html
│   ├── demo-table.html
│   ├── kinetic-demo.html
│   ├── lib/
│   └── src/
│       ├── hooks/useIoTConnection.ts
│       └── routes/
├── server/
│   ├── app/
│   ├── data/templates/
│   ├── scripts/
│   └── tests/
└── shared/
    └── fixtures/joint_angles_v1.json
```

---

## Current Architecture

```text
ESP32-S3 camera
  BLE mode by default:
    advertises KineticLife-BLE-<mac6>
    sends JPEG snapshots over GATT after cam=0

  WiFi mode:
    QR scan or KineticLife-Setup preset-network AP
    /hello, /status, /capture, /cam, /mode, /end
    /ws binary JPEG stream

Browser
  React SPA: web/src/routes/kineticlife-app.jsx
  IoT hook: web/src/hooks/useIoTConnection.ts
  Static pages: pair/debug/demo/demo-table/kinetic-demo
  MediaPipe PoseLandmarker runs locally
  Local heuristic rep counting and form checks

Server
  FastAPI app: server/app/main.py
  POST /api/actions runs template classification + DTW alignment
  GET /api/templates returns key-angle template signals
  GET /api/history/{action_id} returns in-memory submitted frames
```

**WiFi streaming fixes (2026-05-30):**

- `ConnectScreen` now parses `/hello` JSON and saves `ws_token` to localStorage — WS auth gap is closed
- JPEG quality hardcoded to `WIFI_JPEG_QUALITY = 40` in firmware `config.h`; web `/cam?q=` requests are ignored
- Camera warm-up (`camera_warmup_stream`) runs 20 frames after WiFi connects to stabilise OV2640 AE/AWB; sensor registers are not touched during warm-up (setting vflip inside warm-up caused a 44-second DMA stall)
- Push rate reduced from 15 fps (67 ms) to 10 fps (100 ms) — matches observed client consumption rate (~3–8 fps on Firefox iOS WebKit)
- **Pull-mode flow control**: client sends `"READY"` over WebSocket after each frame is processed; server pushes next frame only on receipt. Eliminates TCP receive-buffer overflow and the multi-second freeze at connection start. Legacy clients (debug.html) fall back to FRAME_MS rate automatically
- Default `connMode` changed from `"ble"` to `"wifi"` so first-launch users reach the WiFi path without visiting Settings
- Safari/Firefox layout: `html,body` get `overscroll-behavior-x:none; touch-action:pan-y` to prevent visual-viewport drift; bottom-nav gets `env(safe-area-inset-left/right)` and `box-sizing:border-box`; `connect-wrap` padding updated with `env(safe-area-inset-bottom)`; nexus scroll enabled on Firefox iOS with `touch-action:pan-y; -webkit-overflow-scrolling:touch`

---

## Local Setup

### Firmware

```bash
cd firmware
pio run
pio run --target upload
pio device monitor
```

Default boot mode is BLE. To switch a flashed device into WiFi mode, use the BLE tab in `web/pair.html` and send `mode=wifi`, or call `/mode?set=wifi` when the device is already reachable over WiFi.

### Web

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:5173`. The React SPA is mounted by `src/main.tsx`; most app UI lives in `src/routes/kineticlife-app.jsx`.

Useful direct pages:

- `pair.html`: QR pairing, preset-network Soft AP flow, Direct Connect, BLE test
- `debug.html`: camera/MediaPipe diagnostics
- `demo-table.html?source=ble`: BLE camera demo path
- `kinetic-demo.html`: full UI showcase and DTW demo surface

### Server

```bash
cd server
uv sync
uv run uvicorn app.main:app --reload
```

Local API defaults to `http://127.0.0.1:8000`. The web hook currently targets `https://api.kineticlife.app/api/actions`; change that constant or proxy locally when testing the server with the SPA.

---

## Hardware Notes

- Board: Freenove ESP32-S3-WROOM Board (N16R8), FNK0085 B
- Camera: OV2640 140-degree wide-angle
- Required PlatformIO PSRAM setting: `board_build.arduino.memory_type = qio_opi`
- WiFi streaming target: QVGA JPEG, latest-frame WebSocket policy
- BLE camera path: low-resolution JPEG snapshots chunked over GATT

Do not commit local WiFi credentials. `firmware/src/config.h` is intentionally ignored and used for local preset networks.

---

## Contract Rule

Cross-layer data formats live in `docs/04_Interface_Contracts.md`. Update that document first before changing:

- ESP32 HTTP/BLE/WebSocket fields
- joint-angle order or semantics
- `/api/actions`, `/api/templates`, or history response shapes
- replay or stored-frame privacy rules

---

## Verification

```bash
cd web && npm run typecheck
cd server && uv run pytest
cd firmware && pio run
```

These commands cover the current main code paths: React/TS types, FastAPI DTW helpers, and ESP32 firmware build.

---

## License

TBD before public release.
