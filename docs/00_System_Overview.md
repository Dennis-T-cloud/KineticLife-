# 00 - System Overview

> Last updated: 2026-05-26
> Scope: current `main` branch, not archived v0.3 planning docs

KineticLife is a browser-local movement-feedback system backed by an ESP32-S3 camera and an optional FastAPI DTW summary service.

The current implementation is not the older SPIFFS-hosted MJPEG plan. The active repo uses a Vite web app/static pages, BLE as the default firmware mode, WiFi WebSocket video as a fallback/debug path, and a Python server that analyzes submitted joint-angle sequences after a set.

---

## Current System

```text
ESP32-S3 + OV2640
  BLE mode (default)
    KineticLife-BLE-<mac6>
    TX notify/RX control GATT service
    JPEG snapshots chunked after cam=0

  WiFi mode
    QR pairing or KineticLife-Setup preset-network AP
    HTTP: /hello /status /capture /cam /mode /end
    WS: /ws binary JPEG frames

Browser
  React SPA: web/src/routes/kineticlife-app.jsx
  IoT hook: web/src/hooks/useIoTConnection.ts
  Static tools: pair.html, debug.html, demo.html, demo-table.html, kinetic-demo.html
  MediaPipe PoseLandmarker runs locally
  Local rep/form state machines drive live UX

Server
  FastAPI: server/app/main.py
  Templates: server/data/templates/*.json
  DTW alignment + error spikes: server/app/ml/
  In-memory action history for current demo
```

---

## Privacy Boundary

Raw camera frames stay local to the ESP32/browser transport path.

The server receives only post-set derived data:

- `joint_angles`: 14 values per submitted frame
- timing metadata: `frame_id`, `ts_ms`, action/session ids
- derived analysis: correctness, completeness, dominant problem joints

The current API does not accept or store raw video. `world_landmarks` remain a reserved replay field in the contract and are not part of the active server models.

---

## Document Index

| Document | Purpose |
| --- | --- |
| [01_IoT_ESP32S3.md](./01_IoT_ESP32S3.md) | Firmware boot modes, BLE, WiFi pairing, HTTP/WS endpoints |
| [02_Web_MediaPipe.md](./02_Web_MediaPipe.md) | React/static web surfaces, MediaPipe flow, local exercise logic |
| [03_Cloud_DTW.md](./03_Cloud_DTW.md) | FastAPI routes, templates, DTW engine, server tests |
| [04_Interface_Contracts.md](./04_Interface_Contracts.md) | Cross-layer payloads and hard interface rules |
| [Codebase_Study_Notes.md](./Codebase_Study_Notes.md) | Implementation reading notes for the active codebase |
| [_archive_v0.3/](./_archive_v0.3/) | Historical planning docs; not source of truth |

---

## Active Entry Points

| Layer | Entry point | Notes |
| --- | --- | --- |
| Firmware | `firmware/src/main.cpp` | Chooses BLE vs WiFi mode from NVS |
| Firmware HTTP/WS | `firmware/src/http_server.cpp` | Async HTTP routes and `/ws` binary stream |
| Firmware BLE | `firmware/src/ble_test.cpp` | GATT service, camera snapshot chunking, mode switch commands |
| Firmware pairing AP | `firmware/src/wifi_ap_config.cpp` | `KineticLife-Setup` AP with preset-network selection |
| Web SPA | `web/src/main.tsx` | Mounts `KineticLifeApp` |
| Web app UI | `web/src/routes/kineticlife-app.jsx` | Main Aetheris app shell |
| Web IoT hook | `web/src/hooks/useIoTConnection.ts` | BLE/WiFi transport, MediaPipe, local summary, async DTW POST |
| Server API | `server/app/main.py` | `/health`, `/api/templates`, `/api/actions`, `/api/history/{action_id}` |

---

## Current Integration State

Implemented:

- ESP32 BLE camera mode and WiFi mode switching
- WiFi QR parsing and preset-network Soft AP flow
- Binary JPEG WebSocket streaming with latest-frame policy
- Browser BLE and WiFi frame ingestion paths
- MediaPipe PoseLandmarker in-browser
- Local rep counting, form hints, visual feedback effects
- Server-side template loading, DTW alignment, error spike detection, and action history
- Server tests for DTW, thresholds, templates, and advice rules

Known gaps:

- Firmware `/ws` currently expects a token from `/hello`; several web callers still open `/ws` without `?token=...`.
- Server persistence is in-memory; no Postgres/Alembic layer is wired in current code.
- Advice service helpers exist, but no public advice route is registered in `server/app/main.py`.
- Web `SERVER_DTW_URL` points at production URL by default, not the local `uvicorn` server.
- The browser computes current 14-D angles from image landmarks in the hook; the contract still reserves the stricter world-landmark formula for future view-invariant scoring.

---

## Local Runbook

```bash
# Firmware
cd firmware
pio run
pio run --target upload
pio device monitor

# Web
cd web
npm install
npm run dev

# Server
cd server
uv sync
uv run uvicorn app.main:app --reload
```

Recommended checks before a hardware demo:

- BLE tab in `pair.html` can connect to `KineticLife-BLE-<mac6>`
- `cam=0` produces JPEG frames over BLE
- WiFi mode responds to `/hello` and `/status`
- `/capture` returns a JPEG
- WebSocket token flow is handled before testing `/ws`
- `POST /api/actions` succeeds against the desired server

---

## Change Rule

Any change to shared payload semantics must start in [04_Interface_Contracts.md](./04_Interface_Contracts.md), then be propagated to firmware, web, and server code.
