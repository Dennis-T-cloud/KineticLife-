// Shared lightweight demo feedback effects.
// Pure local Canvas/DOM effects; no external runtime dependency.

const STYLE_ID = 'kl-feedback-effects-style';
const LIME = '#DEFF9A';
const RED = '#FF5555';

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes klRepPop {
      0% { transform: scale(1); text-shadow: 0 0 0 rgba(222,255,154,0); }
      35% { transform: scale(1.42); text-shadow: 0 0 22px rgba(222,255,154,0.95); }
      100% { transform: scale(1); text-shadow: 0 0 0 rgba(222,255,154,0); }
    }
    .kl-rep-pop { animation: klRepPop 360ms cubic-bezier(.2,.9,.2,1); }
    .kl-rep-float {
      position: fixed;
      z-index: 60;
      pointer-events: none;
      color: ${LIME};
      font: 900 20px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      text-shadow: 0 0 18px rgba(222,255,154,0.75);
      transform: translate(-50%, -50%);
      opacity: 0;
      animation: klRepFloat 720ms ease-out forwards;
    }
    @keyframes klRepFloat {
      0% { opacity: 0; transform: translate(-50%, -20%) scale(.8); }
      18% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
      100% { opacity: 0; transform: translate(-50%, -150%) scale(1); }
    }
  `;
  document.head.appendChild(style);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function toCanvasPoint(vidTransform, lm, idx) {
  if (!lm?.[idx]) return null;
  const { dx, dy, dw, dh } = vidTransform;
  return {
    x: dx + lm[idx].x * dw,
    y: dy + lm[idx].y * dh,
    visibility: lm[idx].visibility ?? 0,
  };
}

function bodyCenter(vidTransform, lm) {
  const candidates = [11, 12, 23, 24]
    .map(idx => toCanvasPoint(vidTransform, lm, idx))
    .filter(p => p && p.visibility >= 0.3);
  if (!candidates.length) {
    return {
      x: vidTransform.dx + vidTransform.dw * 0.5,
      y: vidTransform.dy + vidTransform.dh * 0.48,
    };
  }
  return {
    x: candidates.reduce((sum, p) => sum + p.x, 0) / candidates.length,
    y: candidates.reduce((sum, p) => sum + p.y, 0) / candidates.length,
  };
}

function drawBoneGlow(ctx, vidTransform, lm, key, alpha, width, color) {
  const [a, b] = key.split('_').map(Number);
  const pa = toCanvasPoint(vidTransform, lm, a);
  const pb = toCanvasPoint(vidTransform, lm, b);
  if (!pa || !pb || pa.visibility < 0.2 || pb.visibility < 0.2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = width * 2.2;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y);
  ctx.lineTo(pb.x, pb.y);
  ctx.stroke();
  ctx.restore();
}

export function createFeedbackEffects({ repNumEl } = {}) {
  injectStyles();
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let particles = [];
  let successSweeps = [];

  function popCounter(repCount) {
    if (!repNumEl) return;
    repNumEl.classList.remove('kl-rep-pop');
    void repNumEl.offsetWidth;
    repNumEl.classList.add('kl-rep-pop');

    const rect = repNumEl.getBoundingClientRect();
    const floatEl = document.createElement('div');
    floatEl.className = 'kl-rep-float';
    floatEl.textContent = `+${repCount}`;
    floatEl.style.left = `${rect.left + rect.width / 2}px`;
    floatEl.style.top = `${rect.top + rect.height / 2}px`;
    document.body.appendChild(floatEl);
    setTimeout(() => floatEl.remove(), 800);
  }

  function spawnParticles(origin, now) {
    if (reduceMotion) return;
    const count = 30;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
      const speed = 100 + Math.random() * 190;
      const life = 520 + Math.random() * 260;
      particles.push({
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        r: 2.5 + Math.random() * 4,
        born: now,
        life,
        color: Math.random() > 0.22 ? LIME : '#ffffff',
      });
    }
  }

  function spawnSuccessSweep(lm, vidTransform, now) {
    if (reduceMotion) return;
    successSweeps.push({
      born: now,
      life: 760,
      lm: lm.map(p => ({ x: p.x, y: p.y, visibility: p.visibility })),
      vidTransform: { ...vidTransform },
    });
  }

  return {
    onRepCounted({ repCount, lm, vidTransform, now = performance.now() }) {
      popCounter(repCount);
      const origin = bodyCenter(vidTransform, lm);
      spawnParticles(origin, now);
      if (lm && vidTransform) spawnSuccessSweep(lm, vidTransform, now);
    },

    draw(ctx, now, vidTransform, lm, errorBoneSet = new Set()) {
      if (!reduceMotion) {
        particles = particles.filter(p => now - p.born < p.life);
        for (const p of particles) {
          const age = now - p.born;
          const t = age / p.life;
          const dt = age / 1000;
          const alpha = 1 - easeOutCubic(t);
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(p.x + p.vx * dt, p.y + p.vy * dt + 180 * dt * dt, p.r * (1 - 0.35 * t), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        successSweeps = successSweeps.filter(s => now - s.born < s.life);
        for (const sweep of successSweeps) {
          const t = clamp((now - sweep.born) / sweep.life, 0, 1);
          const radius = lerp(18, Math.max(sweep.vidTransform.dw, sweep.vidTransform.dh) * 0.62, easeOutCubic(t));
          const center = bodyCenter(sweep.vidTransform, sweep.lm);
          ctx.save();
          ctx.globalAlpha = 0.45 * (1 - t);
          ctx.strokeStyle = LIME;
          ctx.shadowColor = LIME;
          ctx.shadowBlur = 24;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      if (lm && errorBoneSet.size) {
        // Fixed width keeps shadowBlur constant so Chrome skips per-frame blur recalculation.
        // Only alpha pulses (slower cycle) to preserve the visual warning without GPU churn.
        const pulse = 0.5 + 0.5 * Math.sin(now / 220);
        const alpha = reduceMotion ? 0.30 : 0.20 + pulse * 0.24;
        const width = reduceMotion ? 10 : 12;
        for (const key of errorBoneSet) {
          drawBoneGlow(ctx, vidTransform, lm, key, alpha, width, RED);
        }
      }
    },

    reset() {
      particles = [];
      successSweeps = [];
      document.querySelectorAll('.kl-rep-float').forEach(el => el.remove());
      repNumEl?.classList.remove('kl-rep-pop');
    },
  };
}
