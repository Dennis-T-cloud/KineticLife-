# KineticLife

> Real-time fitness tracking and AI-assisted coaching. ESP32-S3 (Freenove FNK0085 B, OV2640 140° wide-angle) streams live video over WebSocket → browser runs MediaPipe pose estimation → heuristic rep counting, form checks, and DTW biomechanics scoring. Front-end is a full React SPA ("Aetheris") with a dual-theme design system, local AI plan engine (Kinetic Core), and muscle heatmap analytics. **Raw video never leaves the local network.**

**Status**: `ui-update-test` branch active · v0.3 · Sprint 4 UI + Bug fixes complete; DTW server pipeline ready, JSX integration pending

**Hardware baseline**: Freenove ESP32-S3-WROOM (N16R8), model **FNK0085 B**, OV2640 140° wide-angle camera. All firmware pin mapping, camera tuning, and calibration notes assume this board unless explicitly stated otherwise.

---

## Repository Layout

```
KineticLife/
├── README.md
├── docs/
│   ├── 00_System_Overview.md
│   ├── 01_IoT_ESP32S3.md
│   ├── 02_Web_MediaPipe.md
│   ├── 03_Cloud_DTW.md
│   ├── 04_Interface_Contracts.md  ← hard contract — read before any cross-layer change
│   ├── Codebase_Study_Notes.md
│   ├── ai-aidesign.md             ← Kinetic Core AI coach spec & implementation notes
│   ├── ai-movement.md             ← movement classification design
│   ├── ai-socity.md               ← Nexus community module spec
│   └── _archive_v0.3/
├── firmware/                      ← ESP32-S3 PlatformIO project
│   ├── platformio.ini
│   └── src/
├── web/                           ← React PWA (Vite + framer-motion)
│   ├── src/
│   │   ├── main.tsx               ← mounts KineticLifeApp
│   │   └── routes/
│   │       └── kineticlife-app.jsx  ← main SPA (~7490 lines, all screens)
│   ├── lib/                       ← shared JS modules (used by SPA + static pages)
│   │   ├── exercise-rules.js      ← angle thresholds, rep state, form checks
│   │   ├── landmark-smoothing.js  ← EMA display smoothing (α=0.45)
│   │   ├── pose-renderer.js       ← canvas skeleton + angle annotation
│   │   └── feedback-effects.js    ← rep particles, scanline, error pulse
│   ├── index.html                 ← SPA entry (React root)
│   ├── kinetic-demo.html          ← standalone DTW demo (real server pipeline, dev/test only)
│   ├── pair.html                  ← WiFi pairing (QR + Soft AP config)
│   ├── debug.html                 ← ESP32 WS + MediaPipe + lens calibration
│   ├── demo.html                  ← ESP32-only workout demo (v0.2)
│   ├── demo-table.html            ← tablet/desktop dual-source demo (v0.2)
│   └── designHANDOFF.txt          ← AI-to-AI context handoff (full implementation history)
├── server/                        ← FastAPI backend stub
│   ├── app/main.py
│   └── pyproject.toml
└── shared/
    └── fixtures/
        └── joint_angles_v1.json   ← regression fixtures
```

---

## The One Hard Rule

Any **cross-platform data format change** (joint angles, WS messages, ESP32 endpoints, DB shared fields) must be:

1. **First** PR'd into `docs/04_Interface_Contracts.md`
2. Reviewed by all 3 engineers
3. **Then** implemented in the affected role doc + code

---

## Local Setup

### Firmware
```bash
cd firmware
pio run                    # build
pio run --target upload    # flash
pio device monitor         # serial
```

### Web (React SPA)
```bash
cd web
npm install
npm run dev                # http://localhost:5173  → full Aetheris SPA
npm run build              # production build to dist/
```

The SPA (`index.html` → `kineticlife-app.jsx`) is the primary interface. Static HTML pages (`debug.html`, `demo.html`, `kinetic-demo.html`, etc.) are separate development/testing tools served by the same Vite dev server or any static HTTP server.

> **DTW split**: `kinetic-demo.html` contains the real server DTW pipeline (`computeAllAngles`, `/api/actions`, `/api/templates`, real template reference curves). The main SPA (`kineticlife-app.jsx`) currently uses local heuristic scoring — server DTW integration is the next milestone.

### Server
```bash
cd server
uv sync                    # or: pip install -e .
uv run uvicorn app.main:app --reload
```

---

## Local Hardware Test (iPhone + Laptop)

ESP32 streams WebSocket video → browser runs MediaPipe locally → displays 14-D joint angles in real time.

### What you need

- Freenove ESP32-S3-WROOM (FNK0085 B) + OV2640 140° camera, flashed with firmware in `firmware/`
- iPhone (acts as WiFi hotspot)
- macOS laptop on the same hotspot

### Steps

#### 1. Flash firmware

```bash
cd firmware
pio run --target upload
pio device monitor
```

On first boot with no saved credentials, ESP32 enters pairing mode (blue LED blinks):

```text
[pair] No saved WiFi; entering pairing mode
```

To force re-pairing: `pio run --target erase && pio run --target upload`

#### 2. Start iPhone hotspot

Use a 2.4 GHz hotspot. Connect laptop to it. Avoid spaces in SSID.

#### 3. Pair via Soft AP (recommended)

```bash
cd web && python3 -m http.server 8080
# open http://localhost:8080/pair.html
```

1. Connect laptop to `KineticLife-Setup` (password: `kineticlife`)
2. Open `pair.html` → Config tab → enter hotspot credentials
3. ESP32 connects, saves, reboots
4. Reconnect laptop to iPhone hotspot

**QR tab** (alternative): Enter SSID/password → hold phone at 100% brightness ~20–30 cm from camera. Wait for serial `[session] saved`. Less reliable with 140° lens — use Soft AP if QR fails.

#### 4. Connect

ESP32 is at `http://fitcam-d37d7c.local/` (mDNS) or the IP shown in serial monitor.

Open the Aetheris SPA via the dev server (`http://localhost:5173`), navigate to Connect, and enter the device URL. Or use `debug.html` for raw WebSocket + MediaPipe diagnostics.

#### 5. macOS firewall

Required if the browser page is served from the laptop and ESP32 is on a different subnet:

```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off
# re-enable after: --setglobalstate on
```

#### 6. End session

Press **End Session** in the UI, or: `curl -X POST http://fitcam-d37d7c.local/end`

ESP32 clears NVS credentials and reboots to pairing mode.

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| Stream not loading | mDNS failed — use IP from serial monitor directly |
| ESP32 IP unknown | `pio device monitor`, look for `[http] ready ip=...` |
| Soft AP not visible | Wait 10 s after boot; blue LED should be blinking |
| QR parse fails | Use Soft AP; OV2640 140° lens degrades QR reliability |
| WiFi connect fails | Keep phone screen on; hotspot must be 2.4 GHz |
| `ws://` refused | Confirm laptop and ESP32 on same hotspot network |
| Safari shows "streaming…" forever on HTTPS | Safari blocks `ws://` as mixed content on HTTPS pages — open the app over `http://` (e.g. `http://localhost:5173`) or use BLE mode |
| No pose detected | Ensure full body visible; move 1–2 m from camera |
| macOS firewall blocks | Run `socketfilterfw --setglobalstate off` |

---

## Branching & PR

- `main` — protected, requires 1 review
- `ui-update-test` — current active development branch
- Feature branches: `iot/*`, `web/*`, `server/*`, `docs/*`
- Contract changes (touching `docs/04_*`): requires **2 reviews**
- Commit format: `<area>: <subject>` (e.g. `web: add Kinetic Core AI plan`)

---

## License

TBD — set before public release.
