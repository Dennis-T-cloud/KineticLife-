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
- `debug.html`: connect to ESP32 `/ws` WebSocket binary stream, run MediaPipe pose extraction, display 14-D joint angles, and call `/end` when the user finishes.
- `demo.html`: standalone local-camera demo mode with real-time heuristic feedback.

The QR pages generate compact WiFi QR payloads in the current contract format:

```text
K1:<TYPE_CODE>:<SSID_LEN>:<SSID><PASSWORD>
```

The Vite dev server serves `index.html` at `/`, which redirects to the pairing flow.
