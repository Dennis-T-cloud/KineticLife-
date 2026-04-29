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

## License

TBD — set before public Demo.

---

*Version: v0.3 · Demo Day target: 2026-06-05 (6 weeks from 2026-04-24)*
