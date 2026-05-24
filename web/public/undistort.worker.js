// Lens undistortion worker — fisheye theta model (Brown-Conrady)
// Runs the 19 200-pixel bilinear LUT off the main thread.
// Protocol:
//   init   { type:'init', params:{k1,k2,k3,p1,p2,fx,fy,cx,cy} }  → { type:'ready' }
//   undistort { type:'undistort', id, srcBuf:ArrayBuffer }          → { type:'result', id, dstBuf:ArrayBuffer }
const W = 120, H = 160;
let lut = null;

function buildLUT({ k1, k2, k3, p1, p2, fx, fy, cx, cy }) {
  const l = new Float32Array(W * H * 2);
  for (let v = 0; v < H; v++) {
    for (let u = 0; u < W; u++) {
      const xn = (u - cx) / fx, yn = (v - cy) / fy;
      const r = Math.sqrt(xn * xn + yn * yn);
      const idx = (v * W + u) * 2;
      if (r < 1e-8) { l[idx] = u; l[idx + 1] = v; continue; }
      const th = Math.atan(r), t2 = th * th, t4 = t2 * t2, t6 = t2 * t4;
      const td = th * (1 + k1 * t2 + k2 * t4 + k3 * t6), sc = td / r;
      const r2 = xn * xn + yn * yn;
      l[idx]     = (xn * sc + 2 * p1 * xn * yn + p2 * (r2 + 2 * xn * xn)) * fx + cx;
      l[idx + 1] = (yn * sc + p1 * (r2 + 2 * yn * yn) + 2 * p2 * xn * yn) * fy + cy;
    }
  }
  return l;
}

self.onmessage = ({ data }) => {
  if (data.type === 'init') {
    lut = buildLUT(data.params);
    self.postMessage({ type: 'ready' });
    return;
  }
  if (data.type === 'undistort') {
    const { id, srcBuf } = data;
    const src = new Uint8ClampedArray(srcBuf);
    const dstBuf = new ArrayBuffer(W * H * 4);
    const dst = new Uint8ClampedArray(dstBuf);
    for (let v = 0; v < H; v++) {
      for (let u = 0; u < W; u++) {
        const li = (v * W + u) * 2, sx = lut[li], sy = lut[li + 1];
        const x0 = sx | 0, y0 = sy | 0, x1 = x0 + 1, y1 = y0 + 1;
        const di = (v * W + u) * 4;
        if (x0 >= 0 && x1 < W && y0 >= 0 && y1 < H) {
          const dx = sx - x0, dy = sy - y0;
          const w00 = (1-dx)*(1-dy), w10 = dx*(1-dy), w01 = (1-dx)*dy, w11 = dx*dy;
          for (let c = 0; c < 3; c++)
            dst[di+c] = (src[(y0*W+x0)*4+c]*w00 + src[(y0*W+x1)*4+c]*w10 + src[(y1*W+x0)*4+c]*w01 + src[(y1*W+x1)*4+c]*w11) + 0.5 | 0;
          dst[di+3] = 255;
        }
      }
    }
    self.postMessage({ type: 'result', id, dstBuf }, [dstBuf]);
  }
};
