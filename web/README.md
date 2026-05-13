# KineticLife Web

Phone/iPad PWA workspace for ESP32 stream ingest, MediaPipe pose extraction, realtime UI, and WebSocket transport.

## Quick Start

```bash
npm install
npm run dev
```

For static hardware testing, use:

- `index.html`: default entry that redirects to `pair.html` and includes fallback links.
- `pair.html`: generate WiFi QR and open the camera page.
- `debug.html`: connect to ESP32 `/ws` WebSocket binary stream, run MediaPipe pose extraction, display 14-D joint angles, show live WS stream target in metrics bar, and call `/end` when the user finishes.
- `demo.html`: ESP32-connected demo mode with real-time heuristic feedback, rep counting, and immediate local post-set summary. Optional DTW summary reports can be added after Finish Set by submitting completed-rep angle sequences. Calls `/cam` at startup to apply default camera settings (q=12, 320×240). Raw video overlay toggle (`raw ●/○`). Shows black screen if no ESP32 URL present. Skeleton rendered from EMA-smoothed landmarks (α=0.45); rep counting and form checks use raw landmarks.
- `demo-table.html`: tablet/desktop variant. If `?cam=<url>` is present → ESP32 WS stream (same pipeline as demo.html). If no `?cam=` param → falls back to device front camera via `getUserMedia`. Front-camera frames are flipped horizontally before MediaPipe inference so landmark left/right matches the user's anatomical side. Source shown as `ESP32` or `Local Cam` badge. All exercises, form checks, smoothing, and local summary behavior are identical to demo.html.

The QR pages generate compact WiFi QR payloads in the current contract format:

```text
K1:<TYPE_CODE>:<SSID_LEN>:<SSID><PASSWORD>
```

The Vite dev server serves `index.html` at `/`, which redirects to the pairing flow.

## Demo Page Module Structure

The current demo pages are static HTML entry points with shared ES modules:

```text
demo.html              ESP32-only workout demo
demo-table.html        ESP32 or local-camera tablet/desktop demo
mediapipe_loader.mjs   remote/local MediaPipe asset fallback
runtime_log.mjs        low-frequency browser console diagnostics
lib/exercise-rules.js  exercise thresholds, angle math, skeleton constants
lib/landmark-smoothing.js
                       display-only EMA smoothing
lib/pose-renderer.js   Canvas skeleton and angle annotation drawing
lib/feedback-effects.js
                       shared rep-count, particle, scanline, and error-pulse effects
```

`demo.html` and `demo-table.html` are sibling pages, not inheritance-based views.
They share rules/rendering/effects modules, but still keep separate page orchestration
for source setup, recording loop, summary, and UI wiring. New exercises should start
in `lib/exercise-rules.js`; visual rendering changes should start in
`lib/pose-renderer.js`; demo feedback animations should start in
`lib/feedback-effects.js`.

## Offline MediaPipe Assets

`debug.html`, `demo.html`, and `demo-table.html` load MediaPipe through `mediapipe_loader.mjs`.
By default it tries CDN resources first, then falls back to the vendored files under
`vendor/mediapipe/`.

For demo-day testing with no external internet, run a local static server and force local assets:

```bash
python3 -m http.server 8081
```

```text
http://localhost:8081/debug.html?mp=local&cam=http://<ESP32-IP>
http://localhost:8081/demo.html?mp=local&cam=http://<ESP32-IP>
```

Do not open these pages with `file://`; Safari and WebAssembly module loading are more reliable over `http://localhost`.

Open Safari Web Inspector Console and filter for `[kl]` to see low-frequency runtime logs:
page URL, ESP32 base URL/device IP, MediaPipe local/remote source, delegate, WS open/close/error, RSSI, frame size, JPEG quality, heap, and PSRAM.

## Camera Parameter Tuning

`debug.html` exposes live camera controls (brightness, contrast, saturation, sharpness, ae\_level, JPEG quality). Use it to find the optimal values for the physical setup.

Once tuned, the finalized values must be applied in **three places** to keep all pages consistent:

1. **Firmware** — camera init defaults in `firmware/src/` (values the ESP32 boots with)
2. **`demo.html`** — the `/cam` call in `init()` (line ~566)
3. **`demo-table.html`** — the `/cam` call in `init()` (line ~569)

Current defaults used by demo.html and demo-table.html (match `debug.html` FW object):

```text
res=320x240  q=12  brightness=0  contrast=1  saturation=0
sharpness=1  ae_level=0  vflip=0  hmirror=0
```

> Note: OV2640 AEC (auto-exposure) and AWB (auto white balance) run continuously in hardware and are not disabled by `/cam`. Visual brightness/color will still converge over ~5–10 s after each connection. The `/cam` parameters only control static ISP offsets (contrast ratio, sharpness kernel, etc.) and JPEG compression quality.
