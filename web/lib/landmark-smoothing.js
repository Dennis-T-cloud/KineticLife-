// EMA landmark smoother — display only.
// Raw landmarks must continue driving rep counts and form checks.
// Returns a stateful { smooth(raw), reset() } object.
export function createSmoother(alpha = 0.45, visThreshold = 0.5) {
  let state = null;
  return {
    smooth(raw) {
      if (!state || state.length !== raw.length) {
        state = raw.map(p => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility }));
        return state;
      }
      for (let i = 0; i < raw.length; i++) {
        const r = raw[i], s = state[i];
        if (r.visibility >= visThreshold) {
          s.x = alpha * r.x + (1 - alpha) * s.x;
          s.y = alpha * r.y + (1 - alpha) * s.y;
          s.z = alpha * r.z + (1 - alpha) * s.z;
        }
        s.visibility = r.visibility;
      }
      return state;
    },
    reset() { state = null; },
  };
}
