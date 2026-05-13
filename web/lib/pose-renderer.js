// Canvas skeleton and angle-annotation rendering.
// All functions are pure given their arguments — no module-level state.
import { BONE_PAIRS, ALL_JOINTS, C_OK, C_ERR, C_DEFAULT, VIS, boneKey } from './exercise-rules.js';

export function drawSkeleton(ctx, vidTransform, lm, errorBoneSet) {
  const { dx, dy, dw, dh } = vidTransform;
  const toX = i => dx + lm[i].x * dw;
  const toY = i => dy + lm[i].y * dh;

  ctx.lineCap  = 'round';
  ctx.lineJoin = 'round';

  for (const [a, b] of BONE_PAIRS) {
    const lowVis = lm[a].visibility < VIS || lm[b].visibility < VIS;
    const err    = errorBoneSet.has(boneKey(a, b));
    ctx.beginPath();
    ctx.moveTo(toX(a), toY(a));
    ctx.lineTo(toX(b), toY(b));
    ctx.strokeStyle = lowVis ? C_DEFAULT : err ? C_ERR : C_OK;
    ctx.lineWidth   = lowVis ? 2 : err ? 8 : 6;
    ctx.globalAlpha = lowVis ? 0.4 : 1.0;
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  const errorJoints = new Set();
  for (const key of errorBoneSet) {
    key.split('_').forEach(n => errorJoints.add(Number(n)));
  }
  for (const idx of ALL_JOINTS) {
    if (lm[idx].visibility < 0.2) continue;
    const err = errorJoints.has(idx);
    ctx.beginPath();
    ctx.arc(toX(idx), toY(idx), 5, 0, 2 * Math.PI);
    ctx.fillStyle   = lm[idx].visibility < VIS ? C_DEFAULT : err ? C_ERR : C_OK;
    ctx.globalAlpha = lm[idx].visibility < VIS ? 0.35 : 1.0;
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  // Head center anchor — nose (index 0), reserved for head-motion features
  if (lm[0] && lm[0].visibility >= VIS) {
    const hx = toX(0), hy = toY(0);
    ctx.beginPath();
    ctx.arc(hx, hy, 8, 0, 2 * Math.PI);
    ctx.fillStyle   = 'rgba(255,255,255,0.22)';
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth   = 2;
    ctx.fill();
    ctx.stroke();
  }
}

export function drawAngleOnCanvas(ctx, vidTransform, lm, ex) {
  const { dx, dy, dw, dh } = vidTransform;
  ctx.font      = 'bold 24px system-ui';
  ctx.textAlign = 'center';

  for (const d of ex.displayAngles) {
    if (!d.joint || lm[d.joint].visibility < VIS) continue;
    const x   = dx + lm[d.joint].x * dw;
    const y   = dy + lm[d.joint].y * dh - 30;
    const txt = `${d.fn(lm)}°`;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 36, y - 20, 72, 28);
    ctx.fillStyle = '#fff';
    ctx.fillText(txt, x, y);
  }
}
