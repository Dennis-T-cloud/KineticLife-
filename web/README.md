# KineticLife Web

Phone/iPad PWA workspace for ESP32 stream ingest, MediaPipe pose extraction, realtime UI, and WebSocket transport.

## Quick Start

```bash
npm install
npm run dev
```

For static hardware testing, use:

- `pair.html`: generate WiFi QR and open the camera page.
- `cam.html`: connect to ESP32 `/ws` WebSocket binary stream, run MediaPipe pose extraction, display 14-D joint angles, poll `/status`, and call `/end` when the user finishes.
- `debug.html?legacy=1`: old combined pose debug page.

The QR pages generate compact WiFi QR payloads in the current contract format:

```text
K1:<TYPE_CODE>:<SSID_LEN>:<SSID><PASSWORD>
```

The Vite app entry point is `src/main.tsx`.
