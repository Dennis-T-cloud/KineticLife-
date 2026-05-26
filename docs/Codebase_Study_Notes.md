# KineticLife Codebase Study Notes

> Last updated: 2026-05-26

These notes describe the current repository, not the archived v0.3 plan.

---

## Mental Model

KineticLife has three active layers:

1. Firmware turns the ESP32-S3 + OV2640 into either a BLE camera device or a WiFi WebSocket camera device.
2. Web code runs MediaPipe locally, draws the live experience, counts reps, and produces immediate local feedback.
3. Server code analyzes submitted joint-angle sequences after a set using template matching and DTW-style alignment.

The live user experience should continue working when the server is offline.

---

## Firmware Reading Path

Start with:

- `firmware/src/main.cpp`
- `firmware/src/ble_test.cpp`
- `firmware/src/http_server.cpp`
- `firmware/src/wifi_ap_config.cpp`
- `firmware/src/wifi_qr.cpp`
- `firmware/src/camera_init.cpp`
- `firmware/src/status_led.cpp`

The important idea in `main.cpp` is boot-mode selection:

- default `ble`
- stored under `kl_mode.mode`
- `ble` skips WiFi/HTTP/WS
- `wifi` loads WiFi credentials or enters pairing

BLE mode is not just a test stub anymore. It initializes the camera when possible, advertises `KineticLife-BLE-<mac6>`, and can send JPEG snapshots in chunks after the browser writes `cam=0`.

WiFi mode starts HTTP and `/ws` after pairing or a saved session. `/hello` now returns a `ws_token`, and `/ws` is protected by a token gate.

---

## Firmware Pairing

There are two WiFi pairing paths:

- QR camera scan using compact `K1:` or standard `WIFI:` payloads
- Soft AP `KineticLife-Setup`, which serves preset networks from local `config.h`

`config.h` is gitignored and should stay local because it contains real WiFi credentials.

The Soft AP path does not accept arbitrary typed SSID/passwords in current firmware. It lists compiled preset networks and lets the user choose one.

---

## Web Reading Path

Start with:

- `web/src/main.tsx`
- `web/src/routes/kineticlife-app.jsx`
- `web/src/hooks/useIoTConnection.ts`
- `web/lib/exercise-rules.js`
- `web/lib/landmark-smoothing.js`
- `web/lib/pose-renderer.js`
- `web/lib/feedback-effects.js`
- `web/pair.html`

`useIoTConnection.ts` is the key integration file. It owns:

- BLE device discovery and GATT command writes
- BLE JPEG chunk reassembly
- WiFi WebSocket JPEG decode
- MediaPipe runtime loading
- frame rotation into portrait inference canvas
- local exercise state machine
- local analysis summary
- async `/api/actions` submission

React state is deliberately throttled. Camera frames and high-frequency session state live in refs.

---

## Static Pages

`pair.html` is the hardware operator page:

- QR Pair
- Config Networks
- Direct Connect
- BLE Test
- Host QR

`debug.html` is the camera and MediaPipe diagnostics page.

`demo-table.html` is useful for tablet testing and has BLE/local-camera/ESP32 paths.

`kinetic-demo.html` is the fuller UI showcase surface.

---

## Server Reading Path

Start with:

- `server/app/main.py`
- `server/app/ml/dtw_engine.py`
- `server/app/ml/preprocessing.py`
- `server/app/ml/templates.py`
- `server/app/ml/thresholds.py`
- `server/app/advice/service.py`
- `server/app/advice/rules.py`

`main.py` registers only:

- `GET /health`
- `GET /api/templates`
- `POST /api/actions`
- `GET /api/history/{action_id}`

The server loads templates at startup and stores submitted actions in memory. It gzip-compresses the submitted frames for the history endpoint.

The DTW implementation is custom code. It computes a banded alignment path over 14-D frames, derives aligned per-joint errors, then finds sustained error spikes.

---

## Tests

Server tests are currently the strongest automated coverage:

- `server/tests/test_dtw_engine.py`
- `server/tests/test_templates.py`
- `server/tests/test_thresholds.py`
- `server/tests/test_advice_rules.py`
- `server/tests/test_calc_timeseries_variance.py`

Useful commands:

```bash
cd server && uv run pytest
cd web && npm run typecheck
cd firmware && pio run
```

---

## Important Current Gaps

- WiFi `/ws` token: firmware requires `?token=...`; web callers should fetch `/hello` and append it.
- Server URL: `useIoTConnection.ts` posts to production by default.
- Advice service: implemented as helper code but not exposed as a route.
- Persistence: action history is in-memory only.
- Angle formula: web hook computes 14-D angles from 2D image landmarks, while the long-term contract wants world-landmark angles.

These are good first places to look before adding new features.
