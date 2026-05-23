// Holographic HUD skeleton renderer. Keep allocations low and isolate canvas state.
import { BONE_PAIRS, ALL_JOINTS, VIS, boneKey } from './exercise-rules.js';

const OK_A = '#00DBE9';
const OK_B = '#00FF9D';
const WHITE = 'rgba(245,252,255,0.96)';
const DIM = 'rgba(255,255,255,0.28)';
const WARN = '#FFB800';
const ERR = '#FF3366';

function clamp(v, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v));
}

function point(vidTransform, lm, idx) {
  const { dx, dy, dw, dh } = vidTransform;
  return { x: dx + lm[idx].x * dw, y: dy + lm[idx].y * dh };
}

function collectErrorJoints(errorBoneSet) {
  const joints = new Set();
  for (const key of errorBoneSet ?? []) key.split('_').forEach((n) => joints.add(Number(n)));
  return joints;
}

function resolveColors(c = {}) {
  return {
    ok_a:       c.ok_a       ?? OK_A,
    ok_b:       c.ok_b       ?? OK_B,
    white:      c.white      ?? WHITE,
    dim:        c.dim        ?? DIM,
    warn:       c.warn       ?? WARN,
    err:        c.err        ?? ERR,
    labelBg:    c.labelBg    ?? 'rgba(3,5,8,0.58)',
    warningTxt: c.warningTxt ?? '#030508',
    blendMode:  c.blendMode  ?? 'lighter',
  };
}

function drawTargetPlane(ctx, vt, progress, col) {
  const alpha = clamp((progress - 0.78) / 0.14);
  if (alpha <= 0) return;

  const x0 = vt.dx + vt.dw * 0.28;
  const x1 = vt.dx + vt.dw * 0.72;
  const y = vt.dy + vt.dh * 0.78;
  const h = 16;

  ctx.save();
  ctx.globalCompositeOperation = col.blendMode;
  ctx.globalAlpha = 0.10 + alpha * 0.32;
  ctx.strokeStyle = col.ok_b;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 7]);
  ctx.shadowColor = col.ok_b;
  ctx.shadowBlur = 12 + alpha * 18;

  for (let i = 0; i < 3; i++) {
    const yy = y + i * (h / 2);
    ctx.beginPath();
    ctx.moveTo(x0, yy);
    ctx.lineTo(x1, yy);
    ctx.stroke();
  }

  for (let i = 0; i < 5; i++) {
    const x = x0 + i * ((x1 - x0) / 4);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (i - 2) * 3, y + h);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  const [r, g, b] = col.ok_b.startsWith('#')
    ? [parseInt(col.ok_b.slice(1,3),16), parseInt(col.ok_b.slice(3,5),16), parseInt(col.ok_b.slice(5,7),16)]
    : [0, 255, 157];
  ctx.fillStyle = `rgba(${r},${g},${b},${0.025 + alpha * 0.06})`;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.lineTo(x1 + 10, y + h);
  ctx.lineTo(x0 - 10, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHeadRing(ctx, vt, lm, frame, comboActive, col) {
  if (!lm[0] || lm[0].visibility < VIS) return;
  const { x, y } = point(vt, lm, 0);
  const phase = frame * (comboActive ? 0.12 : 0.055);
  const r = 12 + Math.sin(phase) * 1.4;

  ctx.save();
  ctx.globalCompositeOperation = col.blendMode;
  ctx.strokeStyle = col.white;
  ctx.lineWidth = 2;
  ctx.shadowColor = col.ok_b;
  ctx.shadowBlur = 18;

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.72;
  ctx.lineWidth = 1;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.62, y);
  ctx.lineTo(x + r * 0.62, y);
  ctx.moveTo(x, y - r * 0.62);
  ctx.lineTo(x, y + r * 0.62);
  ctx.stroke();

  ctx.globalAlpha = 0.42;
  ctx.beginPath();
  ctx.arc(x, y, r + 5, phase, phase + Math.PI * 1.25);
  ctx.strokeStyle = col.ok_a;
  ctx.stroke();
  ctx.restore();
}

function drawGlitchBone(ctx, ax, ay, bx, by, severity, frame, col) {
  const slices = 3;
  ctx.save();
  ctx.globalCompositeOperation = col.blendMode;
  ctx.lineCap = 'round';
  for (let i = 0; i < slices; i++) {
    const jitter = Math.sin(frame * 0.9 + i * 2.3 + ax * 0.01) * (2 + severity * 4);
    ctx.globalAlpha = 0.32 - i * 0.08;
    ctx.strokeStyle = i % 2 ? col.warn : col.err;
    ctx.lineWidth = 2.5 - i * 0.4;
    ctx.beginPath();
    ctx.moveTo(ax + jitter, ay + i * 1.6);
    ctx.lineTo(bx + jitter, by + i * 1.6);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawSkeleton(ctx, vidTransform, lm, errorBoneSet = new Set(), opts = {}) {
  const frame = opts.frame ?? 0;
  const targetProgress = opts.targetProgress ?? 0;
  const comboActive = Boolean(opts.comboActive);
  const errorJoints = collectErrorJoints(errorBoneSet);
  const keyJoints = new Set(opts.keyJoints ?? []);
  const spin = frame * (comboActive ? 0.18 : 0.07);
  const col = resolveColors(opts.colors);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = col.blendMode;

  drawTargetPlane(ctx, vidTransform, targetProgress, col);

  for (const [a, b] of BONE_PAIRS) {
    if (!lm[a] || !lm[b]) continue;
    const lowVis = (lm[a].visibility ?? 1) < VIS || (lm[b].visibility ?? 1) < VIS;
    const err = errorBoneSet.has(boneKey(a, b));
    const pa = point(vidTransform, lm, a);
    const pb = point(vidTransform, lm, b);

    if (err) {
      const severity = opts.dtw < 0.55 ? 1 : 0.55;
      drawGlitchBone(ctx, pa.x, pa.y, pb.x, pb.y, severity, frame, col);
    }

    const grad = ctx.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
    if (err) {
      grad.addColorStop(0, col.err);
      grad.addColorStop(0.5, 'rgba(255,51,102,0.34)');
      grad.addColorStop(1, col.warn);
    } else if (lowVis) {
      grad.addColorStop(0, col.dim);
      grad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
      grad.addColorStop(1, col.dim);
    } else {
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(0.18, col.ok_a);
      grad.addColorStop(0.5, 'rgba(255,255,255,0.28)');
      grad.addColorStop(0.82, col.ok_b);
      grad.addColorStop(1, 'rgba(255,255,255,0.9)');
    }

    ctx.globalAlpha = lowVis ? 0.28 : 0.92;
    ctx.shadowColor = err ? col.err : col.ok_b;
    ctx.shadowBlur = lowVis ? 0 : err ? 18 : comboActive ? 22 : 12;
    ctx.strokeStyle = grad;
    ctx.lineWidth = lowVis ? 2 : err ? 4.5 : 3.2;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  for (const idx of ALL_JOINTS) {
    if (!lm[idx] || (lm[idx].visibility ?? 1) < 0.2) continue;
    const lowVis = (lm[idx].visibility ?? 1) < VIS;
    const err = errorJoints.has(idx);
    const key = keyJoints.has(idx);
    const { x, y } = point(vidTransform, lm, idx);
    const r = err ? 7 : 5;
    const ringR = r + 7 + Math.sin(spin + idx * 0.7) * 1.6;
    const ringColor = err ? col.err : col.ok_b;

    if (err) {
      const jitter = Math.sin(frame * 0.7 + idx) * 4;
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = col.err;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 12 + jitter, y - 7);
      ctx.lineTo(x + 12 + jitter, y - 7);
      ctx.moveTo(x - 9 - jitter, y + 8);
      ctx.lineTo(x + 9 - jitter, y + 8);
      ctx.stroke();
    }

    if (err || key) {
      ctx.globalAlpha = lowVis ? 0.32 : 1;
      ctx.shadowColor = lowVis ? 'transparent' : ringColor;
      ctx.shadowBlur = lowVis ? 0 : err ? 20 : 14;
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = err ? 2 : 1.4;
      ctx.beginPath();
      ctx.arc(x, y, ringR, spin + idx, spin + idx + Math.PI * 1.45);
      ctx.stroke();
    }

    ctx.shadowColor = 'rgba(255,255,255,0.95)';
    ctx.shadowBlur = lowVis ? 0 : err || key ? 10 : 4;
    ctx.fillStyle = err ? col.err : col.white;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  drawHeadRing(ctx, vidTransform, lm, frame, comboActive, col);
  ctx.restore();
}

export function drawAngleOnCanvas(ctx, vidTransform, lm, ex, opts = {}) {
  const errorJoints = collectErrorJoints(opts.errorBoneSet ?? new Set());
  const frame = opts.frame ?? 0;
  const col = resolveColors(opts.colors);

  ctx.save();
  ctx.globalCompositeOperation = col.blendMode;
  ctx.font = '700 14px "Space Mono", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const d of ex.displayAngles ?? []) {
    if (!d.joint || !lm[d.joint] || (lm[d.joint].visibility ?? 1) < VIS) continue;
    const joint = point(vidTransform, lm, d.joint);
    const bad = errorJoints.has(d.joint) || (opts.dtw ?? 1) < 0.55;
    const value = Math.round(d.fn(lm));
    const angle = frame * 0.04 + d.joint;
    const arcR = 26;
    const labelX = joint.x + 44;
    const labelY = joint.y - 30;

    ctx.globalAlpha = 0.76;
    ctx.strokeStyle = bad ? col.err : 'rgba(255,255,255,0.76)';
    ctx.lineWidth = 2;
    ctx.shadowColor = bad ? col.err : col.ok_a;
    ctx.shadowBlur = bad ? 14 : 10;
    ctx.beginPath();
    ctx.arc(joint.x, joint.y, arcR, angle, angle + Math.PI * 1.25);
    ctx.stroke();

    ctx.globalAlpha = 0.72;
    ctx.fillStyle = col.labelBg;
    ctx.strokeStyle = bad ? 'rgba(255,51,102,0.45)' : 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.roundRect(labelX - 34, labelY - 13, 68, 26, 8);
    ctx.fill();
    ctx.stroke();

    if (bad) {
      ctx.fillStyle = col.err;
      ctx.beginPath();
      ctx.moveTo(labelX - 28, labelY - 7);
      ctx.lineTo(labelX - 19, labelY + 8);
      ctx.lineTo(labelX - 37, labelY + 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = col.warningTxt;
      ctx.font = '800 9px "Space Mono", ui-monospace, monospace';
      ctx.fillText('!', labelX - 28, labelY + 3);
      ctx.font = '700 14px "Space Mono", ui-monospace, monospace';
    }

    ctx.fillStyle = bad ? col.err : col.white;
    ctx.globalAlpha = 0.95;
    ctx.fillText(`${value}°`, bad ? labelX + 8 : labelX, labelY);
  }

  ctx.restore();
}
