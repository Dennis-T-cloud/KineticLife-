# 02 - Web Frontend + MediaPipe

> Last updated: 2026-05-26
> Scope: `web/` current Vite/React project plus static demo pages

The web layer owns the user interface, browser camera-frame ingestion, MediaPipe pose inference, local exercise feedback, and summary-time DTW submission.

---

## Current Web Surfaces

| File | Purpose |
| --- | --- |
| `index.html` | Vite entry that mounts the React SPA |
| `src/main.tsx` | creates the React root and renders `KineticLifeApp` |
| `src/routes/kineticlife-app.jsx` | main Aetheris app shell and screens |
| `src/hooks/useIoTConnection.ts` | BLE/WiFi transport, MediaPipe pipeline, rep state, analysis result |
| `pair.html` | QR pairing, preset-network AP helper, direct connect, BLE test |
| `debug.html` | ESP32/BLE frame diagnostics, MediaPipe, camera tuning |
| `demo.html` | older ESP32-only workout demo |
| `demo-table.html` | tablet/desktop demo; ESP32, BLE, or local camera source |
| `kinetic-demo.html` | full UI showcase with BLE/WiFi and server DTW call |
| `lib/*.js` | shared exercise rules, smoothing, rendering, and visual feedback effects |

---

## Dependencies

Current `web/package.json`:

- React 18 + Vite 5
- TypeScript
- Framer Motion
- Zustand
- `@mediapipe/tasks-vision`
- `idb`
- `qrcode`

Quick start:

```bash
cd web
npm install
npm run dev
npm run typecheck
npm run build
```

---

## Runtime Flow in the React App

`useIoTConnection.ts` is the main active integration point.

```text
connectBLE()
  request Web Bluetooth device KineticLife-BLE*
  configure size/gap
  send cam=0
  receive CAM metadata + JPEG chunks
  decode ImageBitmap

connectWiFi(url)
  apply /cam defaults
  open WebSocket /ws
  decode binary JPEG ImageBitmap

startSession(exerciseKey, repsTarget)
  preload MediaPipe
  start RAF loop
  rotate frame into portrait inference canvas
  PoseLandmarker.detectForVideo()
  local exercise rules update rep phase/count
  draw skeleton/effects
  buffer key angles and 14-D frames

stopSession()
  show local result immediately
  POST joint-angle frames to /api/actions asynchronously
  merge server result when available
```

Live user feedback is local. The server is a summary enhancement and must not block the UI.

---

## MediaPipe Pipeline

The web project uses `createPoseLandmarkerRuntime()` from `mediapipe_loader.mjs`, which can load MediaPipe from CDN or local vendor assets depending on page/runtime settings.

In the React hook:

- frames are stored in refs, not React state
- MediaPipe inference is capped by `FPS_CAP_MS`
- display landmarks are smoothed with EMA alpha `0.45`
- raw landmarks drive rep counting and form checks
- React sensor state updates are throttled to at most 10 per second

The current hook computes 14-D angles from 2D image landmarks. This is intentionally aligned with the live display path, but it is less view-invariant than the contract's reserved world-landmark formula.

---

## Shared Exercise Modules

| Module | Purpose |
| --- | --- |
| `lib/exercise-rules.js` | exercise definitions, key angles, rest/work conditions, form checks |
| `lib/landmark-smoothing.js` | display-only EMA smoothing |
| `lib/pose-renderer.js` | skeleton drawing and angle labels |
| `lib/feedback-effects.js` | rep particles, scanlines, error pulses, finish effects |

Important rule: smoothed landmarks are for display only. Counting and form checks should use raw landmarks.

---

## BLE Path

The BLE path is now the default hardware path.

Browser requirements:

- Chromium browser
- HTTPS or `localhost`
- Web Bluetooth available

GATT values are defined in [04_Interface_Contracts.md](./04_Interface_Contracts.md). The web sends:

```text
size=180
gap=12
cam=0
stop
mode=wifi
```

The BLE camera payload format is:

```text
CAM:<frame_id>:<bytes>:<chunks>:<size>:<q>
```

followed by raw JPEG notification chunks.

---

## WiFi Path

WiFi video uses ESP32 HTTP plus WebSocket:

```text
GET /cam?...          apply camera defaults
GET /hello            get metadata and ws_token
WS  /ws?token=...     receive binary JPEG frames
```

Known current mismatch: `useIoTConnection.ts`, `debug.html`, `demo-table.html`, and `kinetic-demo.html` still construct `/ws` without `?token=...`, while firmware currently enforces a token gate. Fixing that token handoff is required for reliable WiFi mode.

---

## Local Summary + Server DTW

On stop:

1. Local summary is computed immediately:
   - reps
   - elapsed seconds
   - local form score
   - simple local DTW-like key-angle distance
   - local advice text
2. The hook submits a `client.action_submit` payload to `SERVER_DTW_URL`.
3. If the server responds, the UI merges:
   - `correct`
   - `completeness`
   - `dtw_distance`
   - `problem_joints`
   - `source: "server"`
4. If the server fails, the local result remains.

Current `SERVER_DTW_URL` is hardcoded to:

```text
https://api.kineticlife.app/api/actions
```

For local testing, change that constant or add a dev-time proxy.

---

## Static Page Notes

`pair.html` has five tabs:

- QR Pair
- Config Networks
- Direct Connect
- BLE Test
- Host QR

The Config Networks tab talks to `http://192.168.4.1` and lists preset networks compiled into the firmware's local `config.h`.

`debug.html` is the best page for hardware diagnostics. It shows stream status, camera settings, MediaPipe status, and angle output.

`demo-table.html?source=ble` is the quickest BLE camera demo path.

---

## Web Verification

```bash
cd web
npm run typecheck
npm run build
```

Hardware checks:

- BLE connect from `pair.html`
- BLE snapshot preview updates
- `demo-table.html?source=ble` can enter a session
- WiFi direct connect probes `/hello` and `/status`
- WiFi `/ws` includes the firmware token before stream testing
