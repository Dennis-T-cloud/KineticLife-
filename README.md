# KineticLife

> Real-time fitness action accuracy feedback. Freenove ESP32-S3-WROOM Board (N16R8) FNK0085 B + OV2640 camera + MediaPipe (browser-side) + cloud DTW. **Raw video never leaves the phone.**

**Status**: v0.3 · 6-week Demo Day sprint · 3-person part-time team

**Hardware baseline**: Freenove ESP32-S3-WROOM Board (N16R8), model **FNK0085 B**, with **OV2640** camera. All firmware pin mapping, camera tuning, and calibration notes should assume this board unless a document explicitly says otherwise.

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

End-to-end test without the cloud backend: ESP32 streams video → iPhone runs MediaPipe → displays 14-D joint angles in real time.

### What you need

- Freenove ESP32-S3-WROOM (FNK0085 B) flashed with firmware in `firmware/`
- iPhone (acts as WiFi hotspot)
- macOS laptop (serves the static pairing and camera pages)

### Steps

#### 1. Flash firmware

```bash
cd firmware
pio run --target upload
```

On first boot, if NVS has no saved WiFi credentials, the ESP32 enters QR pairing mode and prints:

```text
[pair] No saved WiFi credentials; entering QR pairing mode
```

To force pairing again after a successful setup:

```bash
cd firmware
pio run --target erase
pio run --target upload
```

#### 2. Start iPhone hotspot

Start the hotspot and connect the laptop to it.

> For max compatibility, use a 2.4 GHz hotspot and avoid spaces in the hotspot SSID.

#### 3. Find the laptop's hotspot IP

```bash
ipconfig getifaddr en0    # try en1 if blank
```

#### 4. Allow incoming connections

macOS firewall blocks them by default:

```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off
# re-enable after testing:
# sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on
```

#### 5. Serve the static web pages

```bash
cd web
python3 -m http.server 8080
```

#### 6. Pair ESP32 with the WiFi QR

Open the pair page on iPhone Safari:

```text
http://<laptop-ip>:8080/pair.html
```

Enter the hotspot SSID/password. The page generates the compact QR payload used by the current firmware:

```text
K1:W:<SSID_LEN>:<SSID><PASSWORD>
```

Set the phone brightness to 100%, hold the QR about 30 cm from the ESP32 camera, and wait for the serial monitor to print:

```text
[session] active_session_saved action=reboot_to_camera
```

After reboot, open `cam.html` from the Pair page. It consumes ESP32 `/stream`, runs MediaPipe in the browser, and displays the 14-D joint angles. If mDNS fails, copy the ESP32 serial monitor IP into the Camera address field.

When the user is done, press **End Session** on `cam.html`. The page calls `/end`; ESP32 clears the temporary WiFi session from NVS and reboots back to QR pairing mode. There is intentionally no default hotspot in firmware.

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| Stream is black | mDNS failed — append `?cam=http://<ESP32-IP>` to the URL |
| ESP32 IP unknown | Open `pio device monitor` and wait for the `[status]` line |
| ESP32 stays in pairing mode | Re-enter the hotspot SSID/password, use 100% screen brightness, and hold the QR closer/farther around 30 cm |
| WiFi connection fails after QR parse | Confirm the hotspot is 2.4 GHz and the password is correct; rename SSID without spaces if needed |
| Next user should pair from scratch | Press **End Session** in `cam.html`, or run `pio run --target erase` before flashing |
| "no pose detected" | Ensure full body is visible; move closer to camera |
| Page unreachable from phone | Confirm firewall is off and laptop is on the hotspot network |

---

## License

TBD — set before public Demo.

---

*Version: v0.3 · Demo Day target: 2026-06-05 (6 weeks from 2026-04-24)*
