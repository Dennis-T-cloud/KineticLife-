# KineticLife

> Real-time fitness action accuracy feedback. Freenove ESP32-S3-WROOM Board (N16R8) FNK0085 B + OV5640 160° wide-angle camera + MediaPipe (browser-side, local) + cloud DTW on joint angles only. **Raw video never leaves the local network.**

**Status**: v0.3 · 6-week Demo Day sprint · 3-person part-time team

**Hardware baseline**: Freenove ESP32-S3-WROOM Board (N16R8), model **FNK0085 B**, with **OV5640 160° wide-angle** camera. All firmware pin mapping, camera tuning, and calibration notes should assume this board unless a document explicitly says otherwise.

## Repository Layout

```
KineticLife/
├── README.md                      
├── docs/                           ← Architecture & design
│   ├── 00_System_Overview.md
│   ├── 01_IoT_ESP32S3.md
│   ├── 02_Web_MediaPipe.md
│   ├── 03_Cloud_DTW.md
│   ├── 04_Interface_Contracts.md
│   └── _archive_v0.3/              ← pre-v0.3 full design discussion
├── firmware/                       ← ESP32-S3 firmware (PlatformIO)
│   ├── platformio.ini
│   ├── src/
│   └── README.md
├── web/                            ← Phone/iPad PWA (React + Vite)
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── pose/
│   │   ├── edge/
│   │   ├── render/
│   │   ├── api/
│   │   └── routes/
│   └── README.md
├── server/                         ← FastAPI backend
│   ├── pyproject.toml
│   ├── fly.toml
│   ├── app/
│   ├── scripts/
│   └── README.md
├── shared/
│   └── fixtures/
│       └── joint_angles_v1.json    ← shared regression fixtures (frontend + backend)
└── data/
    └── templates/                  ← standard action JSON (gitignored individual recordings)
```

---

## The One Hard Rule

Any **cross-platform data format change** (joint angles, WS messages, ESP32 endpoints, DB shared fields) must be:

1. **First** PR'd into `docs/04_Interface_Contracts.md`
2. Reviewed by all 3 engineers
3. **Then** implemented in the affected role doc + code

Breaking this rule is what causes W4 integration to explode.

---

## Branching & PR

- `main` — protected, requires 1 review
- Feature branches: `iot/*`, `web/*`, `server/*`, `docs/*`
- Contract changes (touching `docs/04_*`): requires **2 reviews** (one from each other role)
- Commit format: `<area>: <subject>` (e.g. `web: add gesture detector`)

---

## Local Setup

### Firmware
```bash
cd firmware
pio run                # build
pio run --target upload  # flash
pio device monitor       # serial
```

### Web
```bash
cd web
npm install
npm run dev              # http://localhost:5173
```

### Server
```bash
cd server
uv sync                  # or: pip install -e .
uv run uvicorn app.main:app --reload
```

---

## Local Hardware Test (iPhone + Laptop)

End-to-end test without the cloud backend: ESP32 streams WebSocket video → browser runs MediaPipe locally → displays 14-D joint angles in real time.

### What you need

- Freenove ESP32-S3-WROOM (FNK0085 B) + OV5640 camera, flashed with firmware in `firmware/`
- iPhone (acts as WiFi hotspot)
- macOS laptop on the same hotspot

### Steps

#### 1. Flash firmware

```bash
cd firmware
pio run --target upload
pio device monitor
```

On first boot with no saved credentials, ESP32 enters pairing mode (blue LED blinks) and prints:

```text
[pair] No saved WiFi; entering pairing mode
```

To force re-pairing after setup: `pio run --target erase && pio run --target upload`

#### 2. Start iPhone hotspot

Start hotspot, connect laptop to it. Use a 2.4 GHz hotspot; avoid spaces in the SSID.

#### 3. Pair via Soft AP (easiest path)

Open `web/pair.html` locally (file://) or serve it:

```bash
cd web && python3 -m http.server 8080
# open http://localhost:8080/pair.html
```

**Config tab** (Soft AP path — no QR needed):

1. Connect laptop to `KineticLife-Setup` (password: `kineticlife`)
2. Open `pair.html` → Config tab → load preset networks or enter credentials
3. ESP32 connects, saves, reboots
4. Reconnect laptop to iPhone hotspot

**QR tab** (alternative — keep laptop on hotspot throughout):

Enter hotspot SSID/password → QR appears. Hold phone screen at 100% brightness ~20–30 cm from ESP32 camera. Wait for serial: `[session] saved`.

> OV5640 note: 160° wide-angle lens reduces QR ECC success rate. Soft AP is more reliable.

#### 4. Open the stream + debug page

After reboot, ESP32 is at `http://fitcam-d37d7c.local/` (mDNS) or the IP shown in serial monitor.

```bash
# Or open directly in browser:
open http://fitcam-d37d7c.local/
```

If mDNS fails, open `web/debug.html` and enter the IP manually. The debug page connects via `ws://` and runs MediaPipe + DTW locally.

#### 5. Allow incoming connections (macOS firewall)

Only needed if using `debug.html` served from laptop:

```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off
# re-enable after: --setglobalstate on
```

#### 6. End session

Press **End Session** in the page, or: `curl -X POST http://fitcam-d37d7c.local/end`

ESP32 clears NVS credentials and reboots to pairing mode.

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| Stream not loading | mDNS failed — use IP from serial monitor directly |
| ESP32 IP unknown | `pio device monitor`, look for `[http] ready ip=...` |
| Soft AP not visible | Wait 10 s after boot; blue LED should be blinking |
| QR parse fails repeatedly | Use Soft AP path instead; OV5640 160° lens degrades QR reliability |
| WiFi connect fails after QR | Keep phone screen on; hotspot must be 2.4 GHz |
| `ws://` connection refused | Confirm laptop and ESP32 are on the same hotspot network |
| No pose detected | Ensure full body visible; move 1–2 m from camera |
| macOS firewall blocks page | Run `socketfilterfw --setglobalstate off` |

---

## License

TBD — set before public Demo.

---

*Version: v0.3 · Demo Day target: 2026-06-05 (6 weeks from 2026-04-24)*
