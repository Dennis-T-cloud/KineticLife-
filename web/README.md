# KineticLife Web

React PWA — ESP32 stream ingest, MediaPipe pose extraction, real-time Aetheris UI, Kinetic Core AI plan engine, and WebSocket/BLE transport.

## Quick Start

```bash
npm install
npm run dev      # http://localhost:5173  (full Aetheris SPA)
npm run build    # production build → dist/
```

`index.html` mounts the React SPA. All screens (Auth, Dashboard, Live, Analysis, AI Core, Profile, Settings) live in `src/routes/kineticlife-app.jsx`.

---

## Main SPA — Aetheris

The primary interface is the Aetheris React SPA. Key characteristics:

- **Single file**: `src/routes/kineticlife-app.jsx` (~7 000 lines) — all screens, state, CSS-in-JS, and canvas logic in one file.
- **Entry**: `src/main.tsx` mounts `<KineticLifeApp />`.
- **Design system**: Deep Space (default) and Sunset dual themes, `#030508` base, emerald/amber accent tokens, Sora font, glassmorphism panels, Framer Motion Z-axis transitions.
- **Persistent canvas**: `AetherisWorld` (nebula + particles) never unmounts; shifts color on theme/state change. Stars use per-particle sinusoidal drift (4 independent random phases, mirrors a GLSL vertex shader) instead of linear velocity — supernova halo/spike effect unchanged.
- **Local storage keys**: `ath_profile`, `ath_muscles`, `ath_ai_core_profile`, `ath_ai_messages`.

### Screen Map

| Screen | Route state | Description |
|--------|------------|-------------|
| Auth | `auth` | Name entry, theme selector |
| Dashboard | `dashboard` | Bento: Jump-in / AI Plan / Home Workout |
| Connect | `connect` | WiFi URL or BLE pairing |
| Live | `live` | Camera stream, skeleton, rep counter, DTW |
| Analysis | `analysis` | Post-set accuracy ring, form chart, coach feedback |
| Plan Config | `plan_config` | Kinetic Core card + AI weekly schedule |
| Home Coach | `home_coach` | No-equipment protocol |
| AI Core | `core` | Kinetic Core chat + AI Recommended Plan |
| Profile | `profile` | Muscle heatmap, session stats |
| Settings | `settings` | Device config, theme toggle |

### Kinetic Core AI Plan

Local rule-based AI coach (no external API). Profile stored in `ath_ai_core_profile`:

- `heightCm`, `weightKg`, `trainingDaysPerWeek`, `injuryTags`, `focusTags`

`generateAiCorePlan()` scores exercises by muscle fatigue, injury constraints, and focus tags. `buildWeekSchedule()` assigns exercises to training days respecting muscle recovery periods (large muscle groups: 2-day minimum gap; small: 1-day). Clicking today's plan item calls `onBegin()` directly.

---

## Shared Library Modules (`lib/`)

Used by both the React SPA and the static HTML demo pages:

| File | Purpose |
|------|---------|
| `lib/exercise-rules.js` | Angle thresholds, rep state machine, form check rules |
| `lib/landmark-smoothing.js` | Display-only EMA smoothing (α = 0.45) |
| `lib/pose-renderer.js` | Canvas skeleton, angle annotation, holographic HUD effects |
| `lib/feedback-effects.js` | Rep particles, scanline CTA, error pulse, set-finish burst |

**Rule**: raw landmarks drive rep counting and form checks; smoothed landmarks are display-only. Never feed smoothed data into logic.

---

## Static HTML Pages

Legacy and diagnostic pages served alongside the SPA. Not part of the React build.

| Page | Purpose |
|------|---------|
| `pair.html` | WiFi pairing — QR tab and Soft AP config tab |
| `debug.html` | ESP32 WS stream + MediaPipe + 14-D angles + lens calibration LUT |
| `demo.html` | ESP32-only workout demo (v0.2 baseline, stable) |
| `demo-table.html` | Tablet/desktop: ESP32 or `getUserMedia` fallback (v0.2 baseline) |
| `kinetic-demo.html` | Experimental page (do not rely on for demos) |

`demo.html` and `demo-table.html` are stable reference pages. New exercises go into `lib/exercise-rules.js`; visual changes into `lib/pose-renderer.js`.

### Offline MediaPipe

All pages load MediaPipe via `mediapipe_loader.mjs` (CDN → local vendor fallback). For demo-day with no internet:

```bash
python3 -m http.server 8081
# open http://localhost:8081/debug.html?mp=local&cam=http://<ESP32-IP>
```

Do not open with `file://` — WebAssembly is unreliable over that protocol.

---

## Camera Parameter Tuning

`debug.html` exposes live controls (brightness, contrast, saturation, sharpness, AE level, JPEG quality). Once tuned, apply the values in **three places**:

1. **Firmware** — camera init defaults in `firmware/src/`
2. **`demo.html`** — `/cam` call in `init()`
3. **`demo-table.html`** — `/cam` call in `init()`

Current defaults (apply to `demo.html` / `demo-table.html` static pages only):

```
res=320x240  q=12  brightness=0  contrast=1  saturation=0
sharpness=1  ae_level=0  vflip=0  hmirror=0
```

Live SPA cam params (set via `/cam` before WebSocket stream starts):

| Mode | Resolution | q  | vflip |
|------|------------|----|-------|
| WiFi | 320×240    | 40 | 1     |
| BLE  | 160×120    | 25 | 1     |

Lens distortion calibration parameters (140° OV5647, fisheye theta model — shared between WiFi and BLE modes):

```
k1=-0.38  k2=0.18  k3=0  p1=0  p2=0
fx=fy=250  cx=60  cy=80
canvas: inferCanvas 120×160 (portrait, post-rotation)
```

Pipeline (both modes): hardware `vflip=1` → software +90° rotate (landscape→portrait) → `_applyDistLUT()` → MediaPipe on 120×160 undistorted canvas.

> OV2640 AEC and AWB run continuously in hardware. Visual brightness/color converges over ~5–10 s after each connection. The `/cam` parameters control only static ISP offsets and JPEG quality.

---

## Key Constraints

| Decision | Reason |
|----------|--------|
| `board_build.arduino.memory_type = qio_opi` must stay | Freenove N16R8 has real OPI PSRAM; removing causes TG1 watchdog crash |
| `monitor_dtr = 0` / `monitor_rts = 0` required | USB CDC toggles cause reconnect loop |
| XCLK must stay at **20 MHz** | FNK0085B PCB designed for 20 MHz; 24 MHz causes screen tearing |
| `Camera: FB_IN_PSRAM, fb_count=2` | Two PSRAM buffers eliminate DMA + WiFi bus contention |
| Front-camera mirror: flip before inference | Makes lm[12/14/16] map to anatomical right arm |
| EMA α=0.45 display only, raw for logic | Smooth display without affecting rep counts |
| Error debounce 4 frames | ~0.4 s at 10 fps matches natural error perception |
| DTW in Web Worker | O(N²) blocks main thread if inline |
