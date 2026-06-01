/**
 * pose-inference.worker.js — lens undistortion off the main thread.
 *
 * MediaPipe's dynamic import doesn't work when Vite bundles it into a Worker
 * (WASM ModuleFactory scope mismatch). So detectForVideo stays on the main thread.
 * This worker handles only the pixel-level undistortion LUT remap (~2-5 ms).
 *
 * Protocol:
 *   main → worker : { type: 'undistort', pixBuf: ArrayBuffer, ts: number }
 *                    pixBuf = 120×160 RGBA ImageData.data.buffer (transferred, zero-copy)
 *   worker → main : { type: 'ready' }
 *   worker → main : { type: 'undistorted', pixBuf: ArrayBuffer, ts: number }
 */

const W = 176, H = 240; // HQVGA 240×176 rotated to portrait 176×240

function buildLUT({ k1, k2, k3, p1, p2, fx, fy, cx, cy }) {
  const lut = new Int32Array(W * H);
  for (let dy = 0; dy < H; dy++) {
    for (let dx = 0; dx < W; dx++) {
      const xn = (dx - cx) / fx, yn = (dy - cy) / fy;
      const r2 = xn*xn + yn*yn, r4 = r2*r2, r6 = r4*r2;
      const rad = 1 + k1*r2 + k2*r4 + k3*r6;
      const sx  = Math.round((xn*rad + 2*p1*xn*yn + p2*(r2 + 2*xn*xn)) * fx + cx);
      const sy  = Math.round((yn*rad + p1*(r2 + 2*yn*yn) + 2*p2*xn*yn) * fy + cy);
      lut[dy*W + dx] = (sx >= 0 && sx < W && sy >= 0 && sy < H) ? (sy*W + sx) : -1;
    }
  }
  return lut;
}

function applyLUT(src, dst, lut) {
  for (let i = 0; i < W * H; i++) {
    const si = lut[i], di = i * 4;
    if (si >= 0) {
      const sdi = si * 4;
      dst[di] = src[sdi]; dst[di+1] = src[sdi+1]; dst[di+2] = src[sdi+2]; dst[di+3] = src[sdi+3];
    } else {
      dst[di] = dst[di+1] = dst[di+2] = 0; dst[di+3] = 255;
    }
  }
}

// Build LUT immediately on init (same fisheye params as main thread)
// fx/fy/cx/cy scaled from 120×160 calibration: fx*=(176/120), fy*=(240/160), cx=W/2, cy=H/2
const undistLUT = buildLUT({ k1:-0.38, k2:0.18, k3:0, p1:0, p2:0, fx:367, fy:375, cx:88, cy:120 });
self.postMessage({ type: 'ready' });

self.onmessage = ({ data }) => {
  if (data.type !== 'undistort') return;
  const src = new Uint8ClampedArray(data.pixBuf);
  const dst = new Uint8ClampedArray(W * H * 4);
  applyLUT(src, dst, undistLUT);
  // Transfer back (zero-copy)
  self.postMessage({ type: 'undistorted', pixBuf: dst.buffer, ts: data.ts }, [dst.buffer]);
};
