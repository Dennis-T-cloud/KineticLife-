import { useState, useEffect, useRef } from "react";
import { useIoTConnection } from "../hooks/useIoTConnection";

// ── Exercise definitions (ids must match exercise-rules.js EXERCISES keys) ──
const EXERCISES = [
  { id: "squat",         label: "Bodyweight Squat", icon: "SQ", muscle: "quads" },
  { id: "bicep_curl",    label: "Dumbbell Curl",     icon: "BC", muscle: "biceps" },
  { id: "lateral_raise", label: "Lateral Raise",     icon: "LR", muscle: "shoulders" },
];

const ENTRY_MODES = [
  {
    id: "jump",
    label: "Jump-in",
    kicker: "Fast start",
    detail: "Choose one movement and start the live set.",
  },
  {
    id: "plan",
    label: "Plan",
    kicker: "Guided set",
    detail: "Use your saved history to continue structured training.",
  },
  {
    id: "home",
    label: "Home Workout",
    kicker: "Low friction",
    detail: "Keep it light, bodyweight-first, and coach-led.",
  },
];

const PROFILE_STORAGE_KEY = "kineticlife.athleteProfile";
const DEVICE_SETTINGS_KEY = "kineticlife.deviceSettings";
const MUSCLE_STORAGE_KEY = "kineticlife.muscleStatus";

const MUSCLE_DEFS = [
  { id: "chest", label: "Chest", group: "Upper" },
  { id: "upper_back", label: "Upper Back", group: "Back" },
  { id: "lower_back", label: "Lower Back", group: "Back" },
  { id: "biceps", label: "Biceps", group: "Arms" },
  { id: "triceps", label: "Triceps", group: "Arms" },
  { id: "core", label: "Core", group: "Center" },
  { id: "quads", label: "Front Thighs", group: "Legs" },
  { id: "front_calves", label: "Front Lower Legs", group: "Legs" },
  { id: "hamstrings", label: "Back Thighs", group: "Legs" },
  { id: "rear_calves", label: "Back Lower Legs", group: "Legs" },
  { id: "shoulders", label: "Shoulders", group: "Upper" },
];

const MUSCLE_INTENSITY_BY_EXERCISE = {
  squat: { quads: 0.18, hamstrings: 0.13, rear_calves: 0.06, front_calves: 0.04, core: 0.12, lower_back: 0.05 },
  bicep_curl: { biceps: 0.25, shoulders: 0.07, core: 0.04 },
  lateral_raise: { shoulders: 0.25, triceps: 0.06, core: 0.05, upper_back: 0.04 },
};

const MUSCLE_DECAY_PER_DAY = 0.1;

const PLAN_MUSCLES = [
  "chest", "upper_back", "lower_back", "biceps", "triceps", "core", "quads", "hamstrings", "cardio", "shoulders",
];

const PLAN_PRESET = [
  { exercise: "Bodyweight Squat", sets: 3, targetReps: 10 },
  { exercise: "Lateral Raise", sets: 2, targetReps: 12 },
  { exercise: "Dumbbell Curl", sets: 2, targetReps: 12 },
];

function makeDefaultProfile(name) {
  return {
    name,
    sessionsCount: 0,
    averageForm: 0,
    streakDays: 0,
    lastExercise: null,
    updatedAt: Date.now(),
  };
}

function readAthleteProfile() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.name !== "string" || !parsed.name.trim()) return null;
    return {
      ...makeDefaultProfile(parsed.name.trim()),
      ...parsed,
      name: parsed.name.trim(),
      sessionsCount: Number(parsed.sessionsCount) || 0,
      averageForm: Number(parsed.averageForm) || 0,
      streakDays: Number(parsed.streakDays) || 0,
      updatedAt: Number(parsed.updatedAt) || Date.now(),
    };
  } catch (_) {
    return null;
  }
}

function writeAthleteProfile(profile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (_) {
    // Storage is a convenience only; the live training flow must keep working.
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function makeDefaultMuscleStatus(now = Date.now()) {
  const status = {
    updatedAt: now,
    lastTrainedAt: {},
    setCounts: {},
  };
  MUSCLE_DEFS.forEach(muscle => {
    status[muscle.id] = 0;
    status.lastTrainedAt[muscle.id] = null;
    status.setCounts[muscle.id] = 0;
  });
  return status;
}

function applyMuscleDecay(status, now = Date.now()) {
  const base = { ...makeDefaultMuscleStatus(now), ...(status ?? {}) };
  const elapsedDays = Math.max(0, (now - (Number(base.updatedAt) || now)) / 86400000);
  const decay = elapsedDays * MUSCLE_DECAY_PER_DAY;
  const next = {
    ...base,
    updatedAt: now,
    lastTrainedAt: { ...makeDefaultMuscleStatus(now).lastTrainedAt, ...(base.lastTrainedAt ?? {}) },
    setCounts: { ...makeDefaultMuscleStatus(now).setCounts, ...(base.setCounts ?? {}) },
  };
  MUSCLE_DEFS.forEach(muscle => {
    next[muscle.id] = clamp01((Number(base[muscle.id]) || 0) - decay);
    next.setCounts[muscle.id] = Number(next.setCounts[muscle.id]) || 0;
    next.lastTrainedAt[muscle.id] = Number(next.lastTrainedAt[muscle.id]) || null;
  });
  return next;
}

function readMuscleStatus() {
  if (typeof window === "undefined") return makeDefaultMuscleStatus();
  try {
    const raw = window.localStorage.getItem(MUSCLE_STORAGE_KEY);
    return applyMuscleDecay(raw ? JSON.parse(raw) : makeDefaultMuscleStatus());
  } catch (_) {
    return makeDefaultMuscleStatus();
  }
}

function writeMuscleStatus(status) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUSCLE_STORAGE_KEY, JSON.stringify(status));
  } catch (_) {
    // Local progress should enrich the UX, never block the workout flow.
  }
}

function nextMuscleStatusAfterSet(status, analysisResult, exerciseId) {
  const now = Date.now();
  const next = applyMuscleDecay(status, now);
  const intensityMap = MUSCLE_INTENSITY_BY_EXERCISE[exerciseId] ?? {};
  const accuracy = clamp01((Number(analysisResult?.accuracy) || 70) / 100);
  const repFactor = Math.min(1.35, Math.max(0.65, (Number(analysisResult?.reps) || 3) / 8));

  Object.entries(intensityMap).forEach(([muscleId, baseLoad]) => {
    const load = baseLoad * (0.65 + accuracy * 0.35) * repFactor;
    next[muscleId] = clamp01(next[muscleId] + load);
    next.lastTrainedAt[muscleId] = now;
    next.setCounts[muscleId] = (Number(next.setCounts[muscleId]) || 0) + 1;
  });

  next.updatedAt = now;
  return next;
}

function readDeviceSettings() {
  if (typeof window === "undefined") {
    return { camUrl: "http://fitcam-d37d7c.local", preferredSource: "ble" };
  }
  try {
    const raw = window.localStorage.getItem(DEVICE_SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      camUrl: typeof parsed.camUrl === "string" && parsed.camUrl.trim()
        ? parsed.camUrl.trim()
        : "http://fitcam-d37d7c.local",
      preferredSource: parsed.preferredSource === "wifi" ? "wifi" : "ble",
    };
  } catch (_) {
    return { camUrl: "http://fitcam-d37d7c.local", preferredSource: "ble" };
  }
}

function writeDeviceSettings(settings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEVICE_SETTINGS_KEY, JSON.stringify(settings));
  } catch (_) {
    // Settings persistence should never block the workout UI.
  }
}

function nextProfileAfterSet(profile, analysisResult, exerciseId) {
  const base = profile ?? makeDefaultProfile("Athlete");
  const sessionsCount = base.sessionsCount + 1;
  const score = Number(analysisResult?.accuracy) || 0;
  const averageForm = score > 0
    ? Math.round(((base.averageForm * base.sessionsCount) + score) / sessionsCount)
    : base.averageForm;

  return {
    ...base,
    sessionsCount,
    averageForm,
    streakDays: Math.max(1, base.streakDays || 0),
    lastExercise: exerciseId ?? base.lastExercise,
    updatedAt: Date.now(),
  };
}

function exerciseById(id) {
  return EXERCISES.find(ex => ex.id === id) ?? EXERCISES[0];
}

function recommendedExerciseForMode(mode) {
  if (mode === "plan") return exerciseById("lateral_raise");
  if (mode === "home") return exerciseById("squat");
  return exerciseById("squat");
}

const INITIAL_PROFILE = readAthleteProfile();
const INITIAL_DEVICE_SETTINGS = readDeviceSettings();
const INITIAL_MUSCLE_STATUS = readMuscleStatus();

// Fallback for AnalysisScreen when session data is unavailable
const MOCK_DTW = {
  correct: false, completeness: 0.74,
  dtw_distance: 2.81, dtw_threshold: 3.0,
  problem_joints: [
    { joint: "left_knee",  severity: 0.68, issue: "Squat lower on the left" },
    { joint: "right_knee", severity: 0.41, issue: "Uneven leg drive" },
  ],
  advice: "Your depth is improving — left knee needs to go a bit lower. Keep weight balanced across both legs on the way down.",
  accuracy: 74, reps: 8, elapsed: 42,
  keyAngleBuffer: [], exKey: "squat",
};

// ── Styles (unchanged from original) ────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --green: #7FFF00;
    --green-dim: #4a9400;
    --green-muted: #1a2e00;
    --black: #050905;
    --surface: #0d130d;
    --surface2: #141f14;
    --border: rgba(127,255,0,0.15);
    --border-bright: rgba(127,255,0,0.45);
    --text: #e8ffe8;
    --text-muted: rgba(200,230,180,0.55);
    --red: #ff4444;
    --font-display: 'Bebas Neue', sans-serif;
    --font-body: 'DM Sans', sans-serif;
  }

  body { background: var(--black); color: var(--text); font-family: var(--font-body); }

  .app {
    min-height: 100vh;
    background: var(--black);
    display: flex;
    flex-direction: column;
    position: relative;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .app.has-nav { padding-bottom: 76px; }

  .scanline {
    position: fixed; inset: 0;
    background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(127,255,0,0.012) 2px, rgba(127,255,0,0.012) 4px);
    pointer-events: none; z-index: 0;
  }

  .grid-bg {
    position: fixed; inset: 0;
    background-image:
      linear-gradient(rgba(127,255,0,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(127,255,0,0.04) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none; z-index: 0;
  }

  .screen {
    position: relative; z-index: 1;
    flex: 1; display: flex; flex-direction: column;
    padding: 0 1.5rem;
    max-width: 420px;
    margin: 0 auto;
    width: 100%;
  }

  .welcome-wrap {
    flex: 1; display: flex; flex-direction: column;
    gap: 1.5rem;
    padding: 2.5rem 0 2.5rem;
    overflow-y: auto;
  }

  .mode-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; }
  .mode-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 1.1rem;
    cursor: pointer; text-align: left;
    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .mode-card:hover { transform: translateY(-3px); border-color: var(--border-bright); box-shadow: 0 8px 32px rgba(127,255,0,0.08); }
  .mode-card:active { transform: translateY(0); }
  .mode-card-icon { width: 36px; height: 36px; border-radius: 9px; background: var(--surface2); display: flex; align-items: center; justify-content: center; margin-bottom: 0.65rem; }
  .mode-card-title { font-size: 0.88rem; font-weight: 700; color: var(--text); margin-bottom: 0.3rem; }
  .mode-card-sub { font-size: 0.72rem; color: var(--text-muted); line-height: 1.4; }
  .mode-card-cta { margin-top: 0.65rem; font-size: 0.72rem; color: var(--green); font-weight: 600; }

  .journey-section { display: flex; flex-direction: column; gap: 0.85rem; }
  .journey-header { display: flex; align-items: center; justify-content: space-between; }
  .journey-title { font-size: 0.88rem; font-weight: 700; color: var(--text); }
  .journey-badge { font-size: 0.68rem; color: var(--text-muted); background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 0.25rem 0.75rem; }
  .journey-line {
    position: absolute; left: 24px; transform: translateX(-50%);
    width: 3px;
    background: linear-gradient(to bottom, var(--green) 0%, rgba(127,255,0,0.15) 100%);
    z-index: 0;
  }
  .journey-node { transition: transform 0.2s ease; }
  .journey-node:hover { transform: scale(1.05); }
  .journey-node-active { box-shadow: 0 0 0 4px rgba(127,255,0,0.25), 0 0 24px rgba(127,255,0,0.2); cursor: pointer; }
  .journey-node-active:hover { transform: scale(1.07); box-shadow: 0 0 0 5px rgba(127,255,0,0.35), 0 0 32px rgba(127,255,0,0.3); }

  .logo-mark { display: flex; align-items: center; gap: 10px; margin-bottom: 0.5rem; width: 100%; }

  .logo-icon {
    width: 36px; height: 36px;
    border: 1.5px solid var(--green);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    position: relative;
  }
  .logo-icon::before {
    content: '';
    display: block; width: 12px; height: 18px;
    border-left: 2px solid var(--green);
    border-bottom: 2px solid var(--green);
    border-radius: 0 0 0 3px;
    margin-left: 4px;
  }

  .logo-text { font-family: var(--font-display); font-size: 1.6rem; letter-spacing: 0.08em; color: var(--green); }

  .welcome-hero { padding: 2rem 0; }
  .welcome-eyebrow { font-size: 0.72rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--green-dim); margin-bottom: 0.75rem; }
  .welcome-heading { font-family: var(--font-display); font-size: 4.2rem; line-height: 0.95; letter-spacing: 0.02em; color: var(--text); }
  .welcome-heading span { color: var(--green); }
  .welcome-sub { margin-top: 1.25rem; font-size: 0.9rem; line-height: 1.65; color: var(--text-muted); max-width: 300px; }

  .stat-row { display: flex; gap: 1rem; margin-top: 2rem; }
  .stat-pill { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem 1rem; font-size: 0.8rem; color: var(--text-muted); }
  .stat-pill strong { display: block; font-size: 1.1rem; font-weight: 500; color: var(--green); }

  .entry-grid { display: flex; flex-direction: column; gap: 0.65rem; }
  .entry-card {
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.9rem 1rem;
    color: var(--text);
    cursor: pointer;
    text-align: left;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.35rem 0.75rem;
    transition: border-color 0.15s, background 0.15s, transform 0.1s;
  }
  .entry-card:hover { border-color: var(--border-bright); background: rgba(127,255,0,0.05); }
  .entry-card:active { transform: scale(0.99); }
  .entry-kicker { font-size: 0.65rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--green-dim); }
  .entry-label { font-family: var(--font-display); font-size: 1.35rem; letter-spacing: 0.06em; color: var(--text); }
  .entry-detail { grid-column: 1 / -1; font-size: 0.78rem; line-height: 1.45; color: var(--text-muted); }
  .entry-arrow { grid-row: 1 / 3; grid-column: 2; align-self: center; color: var(--green); font-size: 1.25rem; }

  .btn-primary { width: 100%; background: var(--green); color: var(--black); border: none; border-radius: 10px; padding: 1rem 1.5rem; font-family: var(--font-display); font-size: 1.3rem; letter-spacing: 0.08em; cursor: pointer; transition: opacity 0.15s, transform 0.1s; }
  .btn-primary:hover { opacity: 0.88; }
  .btn-primary:active { transform: scale(0.98); }
  .btn-primary:disabled { opacity: 0.35; cursor: not-allowed; }

  .btn-ghost { background: transparent; color: var(--text-muted); border: 1px solid var(--border); border-radius: 10px; padding: 0.85rem 1.5rem; font-family: var(--font-body); font-size: 0.9rem; cursor: pointer; transition: border-color 0.15s, color 0.15s; width: 100%; }
  .btn-ghost:hover { border-color: var(--border-bright); color: var(--text); }

  .screen-header { display: flex; align-items: center; gap: 0.75rem; padding: 2rem 0 1.5rem; }
  .back-btn { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); cursor: pointer; font-size: 1.1rem; transition: border-color 0.15s; flex-shrink: 0; }
  .back-btn:hover { border-color: var(--border-bright); }
  .screen-title { font-family: var(--font-display); font-size: 1.8rem; letter-spacing: 0.05em; color: var(--text); }
  .header-spacer { flex: 1; }
  .settings-btn { margin-left: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: var(--green); cursor: pointer; font-size: 1rem; transition: border-color 0.15s, background 0.15s; flex-shrink: 0; }
  .settings-btn:hover { border-color: var(--border-bright); background: rgba(127,255,0,0.06); }

  .section-label { font-size: 0.7rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--green-dim); margin-bottom: 0.6rem; }

  .input-field { width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 0.85rem 1rem; color: var(--text); font-family: var(--font-body); font-size: 0.9rem; outline: none; transition: border-color 0.15s; }
  .input-field::placeholder { color: var(--text-muted); }
  .input-field:focus { border-color: var(--border-bright); }
  .input-hint { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; line-height: 1.5; }

  .exercise-grid { display: flex; flex-direction: column; gap: 0.6rem; }
  .exercise-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 1rem 1.1rem; display: flex; align-items: center; gap: 0.9rem; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
  .exercise-card:hover { border-color: var(--border-bright); }
  .exercise-card.selected { border-color: var(--green); background: rgba(127,255,0,0.06); }
  .ex-icon { font-size: 1.4rem; }
  .ex-label { font-size: 0.9rem; font-weight: 500; color: var(--text); }
  .ex-check { margin-left: auto; width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid var(--border-bright); display: flex; align-items: center; justify-content: center; font-size: 0.7rem; color: transparent; transition: all 0.15s; flex-shrink: 0; }
  .exercise-card.selected .ex-check { background: var(--green); border-color: var(--green); color: var(--black); }

  .connect-status { display: flex; align-items: center; gap: 0.5rem; font-size: 0.78rem; margin-top: 0.75rem; }
  .status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green-dim); flex-shrink: 0; }
  .status-dot.live { background: var(--green); animation: pulse 1.6s ease-in-out infinite; }
  .status-dot.error { background: var(--red); }
  .mode-note { border: 1px solid var(--border); border-radius: 10px; padding: 0.8rem 0.9rem; background: rgba(127,255,0,0.035); color: var(--text-muted); font-size: 0.78rem; line-height: 1.5; }
  .mode-note strong { color: var(--green); font-weight: 600; }
  .status-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 0.9rem 1rem; }
  .status-panel-title { font-size: 0.68rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--green-dim); margin-bottom: 0.45rem; }
  .status-panel-text { font-size: 0.82rem; color: var(--text-muted); line-height: 1.5; }
  .profile-stack { flex: 1; display: flex; flex-direction: column; gap: 1rem; padding-bottom: 1.5rem; overflow-y: auto; }
  .profile-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; }
  .profile-card-title { font-size: 0.7rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--green-dim); margin-bottom: 0.75rem; }
  .progress-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
  .progress-cell { background: rgba(127,255,0,0.04); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem 0.5rem; text-align: center; }
  .progress-value { font-family: var(--font-display); font-size: 1.65rem; color: var(--text); line-height: 1; }
  .progress-label { font-size: 0.62rem; color: var(--text-muted); letter-spacing: 0.08em; text-transform: uppercase; margin-top: 0.35rem; }
  .heatmap-card { overflow: hidden; }
  .heatmap-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 0.85rem; }
  .heatmap-caption { color: var(--text-muted); font-size: 0.72rem; line-height: 1.45; max-width: 230px; }
  .heatmap-summary { text-align: right; min-width: 72px; }
  .heatmap-summary-value { font-family: var(--font-display); font-size: 2rem; color: var(--green); line-height: 0.9; text-shadow: 0 0 14px rgba(127,255,0,0.28); }
  .heatmap-summary-label { margin-top: 0.25rem; color: var(--text-muted); font-size: 0.62rem; letter-spacing: 0.08em; text-transform: uppercase; }
  .body-view-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; margin-bottom: 0.85rem; border: 1px solid var(--border); border-radius: 8px; padding: 0.25rem; background: rgba(255,255,255,0.025); }
  .body-view-btn { border: 0; border-radius: 6px; background: transparent; color: var(--text-muted); padding: 0.48rem 0.5rem; font-family: var(--font-body); font-size: 0.68rem; letter-spacing: 0.11em; text-transform: uppercase; cursor: pointer; transition: background 0.16s ease, color 0.16s ease; }
  .body-view-btn.active { background: rgba(127,255,0,0.12); color: var(--green); }
  .body-map-wrap { position: relative; border: 1px solid var(--border); border-radius: 10px; background: radial-gradient(circle at 50% 28%, rgba(127,255,0,0.08), transparent 44%), rgba(0,0,0,0.18); overflow: hidden; padding: 0.55rem 0.35rem 0.35rem; }
  .body-map-wrap::before { content: ''; position: absolute; inset: 10px; border: 1px solid rgba(127,255,0,0.05); border-radius: 8px; pointer-events: none; }
  .body-map { position: relative; z-index: 1; width: 100%; height: auto; display: block; max-height: 380px; }
  .body-base { fill: rgba(255,255,255,0.055); stroke: rgba(200,230,180,0.14); stroke-width: 1.4; }
  .muscle-shape { cursor: pointer; transition: opacity 0.18s ease, stroke 0.18s ease, filter 0.18s ease, transform 0.18s ease; transform-origin: center; }
  .muscle-shape:hover,
  .muscle-shape.active { filter: drop-shadow(0 0 10px rgba(127,255,0,0.42)); opacity: 1; }
  .muscle-shape.active { stroke: var(--green); stroke-width: 2.4; }
  .muscle-shape:focus { outline: none; filter: drop-shadow(0 0 12px rgba(127,255,0,0.5)); }
  .muscle-node { fill: var(--green); filter: drop-shadow(0 0 8px rgba(127,255,0,0.6)); animation: pulse 1.6s ease-in-out infinite; pointer-events: none; }
  .body-map-label { fill: rgba(200,230,180,0.42); font: 700 9px system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; pointer-events: none; }
  .body-map-legend { display: flex; justify-content: space-between; gap: 0.75rem; margin-top: 0.55rem; color: var(--text-muted); font-size: 0.66rem; }
  .legend-track { flex: 1; height: 5px; align-self: center; border-radius: 999px; background: linear-gradient(90deg, rgba(127,255,0,0.08), rgba(127,255,0,0.72)); }
  .heatmap-detail { margin-top: 0.8rem; padding-top: 0.75rem; border-top: 1px solid var(--border); display: grid; grid-template-columns: 1fr auto; gap: 0.45rem 0.8rem; align-items: center; animation: fadeInUp 0.22s ease; }
  .heatmap-detail-title { color: var(--text); font-size: 0.84rem; font-weight: 700; }
  .heatmap-detail-value { font-family: var(--font-display); color: var(--green); font-size: 1.45rem; line-height: 1; }
  .heatmap-detail-copy { grid-column: 1 / -1; color: var(--text-muted); font-size: 0.74rem; line-height: 1.5; }
  .ai-copy { color: var(--text-muted); font-size: 0.84rem; line-height: 1.6; }
  .flow-stack { flex: 1; display: flex; flex-direction: column; gap: 1rem; padding-bottom: 1.5rem; overflow-y: auto; }
  .scan-card { background: var(--surface); border: 1px solid var(--border-bright); border-radius: 12px; padding: 1.1rem; position: relative; overflow: hidden; }
  .scan-card::before { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent, rgba(127,255,0,0.08), transparent); transform: translateY(-100%); animation: scanSweep 2.4s linear infinite; }
  .scan-title { position: relative; font-family: var(--font-display); font-size: 2.1rem; letter-spacing: 0.06em; color: var(--green); }
  .scan-copy { position: relative; margin-top: 0.6rem; color: var(--text-muted); font-size: 0.86rem; line-height: 1.55; }
  .confidence-bar { height: 8px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden; margin-top: 1rem; position: relative; }
  .confidence-fill { height: 100%; border-radius: inherit; background: var(--green); box-shadow: 0 0 14px rgba(127,255,0,0.4); transition: width 0.3s ease; }
  @keyframes scanSweep { to { transform: translateY(100%); } }
  .muscle-chip-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.55rem; }
  .muscle-chip { border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--text-muted); padding: 0.75rem 0.65rem; text-align: left; cursor: pointer; font-size: 0.8rem; text-transform: capitalize; }
  .muscle-chip.active { border-color: var(--green); color: var(--green); background: rgba(127,255,0,0.07); }
  .plan-row { display: grid; grid-template-columns: 1fr auto; gap: 0.35rem 0.75rem; align-items: center; padding: 0.72rem 0; border-bottom: 1px solid var(--border); }
  .plan-row:last-child { border-bottom: none; }
  .plan-name { color: var(--text); font-size: 0.88rem; }
  .plan-meta { color: var(--text-muted); font-size: 0.72rem; }
  .home-workout-screen { background: #efffdd; color: #13220f; }
  .home-workout-screen .screen { color: #13220f; }
  .home-workout-screen .screen-title,
  .home-workout-screen .profile-card-title,
  .home-workout-screen .section-label { color: #1d5c16; }
  .home-workout-screen .profile-card,
  .home-workout-screen .status-panel,
  .home-workout-screen .exercise-card { background: rgba(255,255,255,0.78); border-color: rgba(38,108,28,0.22); color: #13220f; }
  .home-workout-screen .status-panel-text,
  .home-workout-screen .ai-copy,
  .home-workout-screen .ex-label { color: #35532c; }
  .coach-face { width: 88px; height: 88px; border-radius: 22px; background: #7fff00; color: #13220f; display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-size: 2.4rem; box-shadow: 0 12px 30px rgba(29,92,22,0.22); animation: floaty 2.6s ease-in-out infinite; }
  @keyframes floaty { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
  .ai-agent-container { position: fixed; z-index: 4; right: max(16px, calc((100vw - 420px) / 2 + 16px)); bottom: calc(82px + env(safe-area-inset-bottom)); display: flex; align-items: flex-end; gap: 0.6rem; pointer-events: none; }
  .chat-bubble { max-width: 230px; background: rgba(13,19,13,0.94); border: 1px solid var(--border-bright); border-radius: 12px; padding: 0.75rem 0.85rem; color: var(--text-muted); font-size: 0.75rem; line-height: 1.45; box-shadow: 0 12px 28px rgba(0,0,0,0.28); }
  .ai-avatar { width: 42px; height: 42px; border-radius: 10px; background: var(--green); color: var(--black); display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-size: 1.2rem; box-shadow: 0 0 18px rgba(127,255,0,0.35); animation: floaty 2.8s ease-in-out infinite; }

  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

  .spacer { flex: 1; }

  .live-screen { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; background: #000; max-width: 480px; margin: 0 auto; width: 100%; }
  .cam-area { flex: 1; min-height: 0; background: #000; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; aspect-ratio: 3/4; width: 100%; }
  .cam-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; color: var(--text-muted); }
  .cam-placeholder-icon { font-size: 3rem; opacity: 0.4; }
  .cam-placeholder p { font-size: 0.85rem; }

  .cam-overlay { position: absolute; inset: 0; pointer-events: none; }
  .cam-corner { position: absolute; width: 22px; height: 22px; border-color: var(--green); border-style: solid; opacity: 0.7; }
  .cam-corner.tl { top: 12px; left: 12px; border-width: 2px 0 0 2px; }
  .cam-corner.tr { top: 12px; right: 12px; border-width: 2px 2px 0 0; }
  .cam-corner.bl { bottom: 12px; left: 12px; border-width: 0 0 2px 2px; }
  .cam-corner.br { bottom: 12px; right: 12px; border-width: 0 2px 2px 0; }

  .live-badge { position: absolute; top: 14px; left: 14px; background: rgba(0,0,0,0.7); border: 1px solid rgba(127,255,0,0.45); border-radius: 6px; padding: 4px 10px; font-size: 0.7rem; letter-spacing: 0.14em; color: var(--green); display: flex; align-items: center; gap: 5px; }
  .live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green); animation: pulse 1s ease-in-out infinite; }
  .source-badge { position: absolute; top: 14px; right: 14px; max-width: 42%; background: rgba(0,0,0,0.68); border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; font-size: 0.66rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .source-badge.wifi, .source-badge.dual { color: var(--green); border-color: var(--border-bright); }
  .source-badge.ble { color: #d7ff9c; border-color: rgba(215,255,156,0.35); }

  .rep-counter { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); text-align: center; }
  .rep-num { font-family: var(--font-display); font-size: 5rem; line-height: 1; color: var(--green); text-shadow: 0 0 20px rgba(127,255,0,0.4); }
  .rep-label { font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-muted); margin-top: 2px; }

  .form-hint { position: absolute; bottom: 90px; left: 0; right: 0; display: flex; justify-content: center; padding: 0 1rem; }
  .hint-pill { background: rgba(255,68,68,0.15); border: 1px solid rgba(255,68,68,0.4); border-radius: 20px; padding: 5px 12px; font-size: 0.78rem; color: #ff8888; max-width: 260px; text-align: center; animation: fadeInUp 0.3s ease; }

  @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

  .session-bar { background: var(--surface); border-top: 1px solid var(--border); padding: 1rem 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; }
  .session-meta { display: flex; justify-content: space-between; align-items: center; }
  .session-exercise { font-size: 0.8rem; font-weight: 500; color: var(--text-muted); }
  .session-timer { font-family: var(--font-display); font-size: 1.1rem; color: var(--green); letter-spacing: 0.05em; }

  .finish-btn { background: transparent; border: 1.5px solid var(--green); border-radius: 10px; padding: 0.85rem; font-family: var(--font-display); font-size: 1.25rem; letter-spacing: 0.1em; color: var(--green); cursor: pointer; transition: background 0.15s, color 0.15s; width: 100%; }
  .finish-btn:hover { background: rgba(127,255,0,0.1); }

  .analysis-wrap { flex: 1; display: flex; flex-direction: column; padding-bottom: 2rem; overflow-y: auto; }

  .score-hero { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 1.5rem; margin-bottom: 1rem; text-align: center; position: relative; overflow: hidden; }
  .score-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 0%, rgba(127,255,0,0.07) 0%, transparent 70%); pointer-events: none; }
  .score-label { font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--green-dim); margin-bottom: 0.5rem; }
  .score-ring-wrap { display: flex; align-items: center; justify-content: center; margin: 0.75rem 0; }
  .score-ring { position: relative; width: 110px; height: 110px; }
  .score-ring svg { transform: rotate(-90deg); }
  .score-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .score-pct { font-family: var(--font-display); font-size: 2.2rem; line-height: 1; color: var(--green); }
  .score-pct-label { font-size: 0.65rem; color: var(--text-muted); letter-spacing: 0.12em; text-transform: uppercase; }
  .score-verdict { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem; }
  .score-verdict strong { color: var(--text); }

  .stats-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.6rem; margin-bottom: 1rem; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem; text-align: center; }
  .stat-card-val { font-family: var(--font-display); font-size: 1.5rem; color: var(--text); }
  .stat-card-label { font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.12em; margin-top: 2px; }

  .section-block { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 1.1rem 1.25rem; margin-bottom: 1rem; }
  .section-block-title { font-size: 0.7rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--green-dim); margin-bottom: 0.9rem; }

  .joint-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.55rem 0; border-bottom: 1px solid var(--border); }
  .joint-row:last-child { border-bottom: none; }
  .joint-name { font-size: 0.85rem; font-weight: 500; color: var(--text); flex: 1; text-transform: capitalize; }
  .joint-issue { font-size: 0.75rem; color: var(--text-muted); flex: 1; }
  .severity-bar-wrap { width: 60px; height: 5px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; }
  .severity-bar { height: 100%; border-radius: 3px; background: var(--red); transition: width 0.6s ease; }

  .advice-block { background: rgba(127,255,0,0.05); border: 1px solid var(--border-bright); border-radius: 10px; padding: 1rem 1.1rem; font-size: 0.85rem; line-height: 1.65; color: var(--text-muted); margin-bottom: 1rem; }
  .advice-block strong { color: var(--green); }
  .dtw-note { font-size: 0.72rem; color: var(--text-muted); text-align: center; margin-bottom: 1rem; opacity: 0.6; }

  .auth-wrap { flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 3.5rem 0 2.5rem; }
  .auth-logo-block { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding-top: 1rem; }
  .auth-logo-icon { width: 52px; height: 52px; border: 2px solid var(--green); border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 0.25rem; position: relative; }
  .auth-logo-icon::before { content: ''; display: block; width: 18px; height: 26px; border-left: 2.5px solid var(--green); border-bottom: 2.5px solid var(--green); border-radius: 0 0 0 4px; margin-left: 5px; }
  .auth-logo-text { font-family: var(--font-display); font-size: 2rem; letter-spacing: 0.1em; color: var(--text); }
  .auth-logo-sub { font-size: 0.65rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--text-muted); }
  .auth-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 1.75rem 1.5rem; }
  .auth-card-title { font-family: var(--font-display); font-size: 1.9rem; letter-spacing: 0.04em; color: var(--text); margin-bottom: 0.3rem; }
  .auth-card-sub { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.5rem; }
  .auth-field-label { font-size: 0.68rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--green-dim); margin-bottom: 0.5rem; display: block; }
  .auth-footer-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; border-top: 1px solid var(--border); padding-top: 1.5rem; margin-top: 0.25rem; }
  .auth-stat { text-align: center; padding: 0 0.5rem; border-right: 1px solid var(--border); }
  .auth-stat:last-child { border-right: none; }
  .auth-stat-val { font-family: var(--font-display); font-size: 1.6rem; color: var(--text); letter-spacing: 0.04em; }
  .auth-stat-label { font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 1px; }
  .auth-powered { font-size: 0.65rem; color: var(--text-muted); text-align: center; opacity: 0.5; letter-spacing: 0.06em; }
  .input-field.auth-input { font-size: 1rem; font-weight: 500; padding: 0.95rem 1rem; margin-bottom: 1rem; color: var(--text); }

  /* Source toggle buttons */
  .source-toggle { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; }
  .source-btn {
    flex: 1; padding: 0.6rem 0.5rem;
    background: var(--surface); border-radius: 8px;
    font-size: 0.85rem; font-weight: 600; cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
    border: 1px solid var(--border); color: var(--text-muted);
  }
  .source-btn.active { border-color: var(--green); color: var(--green); background: rgba(127,255,0,0.08); }
  .source-btn small { display: block; margin-top: 0.2rem; font-size: 0.62rem; font-weight: 500; letter-spacing: 0.04em; color: var(--text-muted); }
  .source-btn.active small { color: rgba(232,255,232,0.7); }

  .bottom-nav {
    position: fixed;
    z-index: 5;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: min(420px, 100%);
    background: rgba(5,9,5,0.96);
    border-top: 1px solid var(--border);
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    padding: 0.55rem 0.65rem calc(0.55rem + env(safe-area-inset-bottom));
    gap: 0.35rem;
    backdrop-filter: blur(16px);
  }
  .nav-btn {
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: var(--text-muted);
    padding: 0.5rem 0.3rem;
    font-family: var(--font-body);
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .nav-btn small { display: block; margin-top: 0.15rem; font-size: 0.58rem; letter-spacing: 0.04em; text-transform: none; color: var(--text-muted); }
  .nav-btn.active { border-color: var(--border-bright); color: var(--green); background: rgba(127,255,0,0.06); }
`;

// ── AuthScreen ───────────────────────────────────────────────────────────────

function AuthScreen({ onEnter }) {
  const [name, setName] = useState("");
  const trimmed = name.trim();
  return (
    <div className="screen">
      <div className="auth-wrap">
        <div className="auth-logo-block">
          <div className="auth-logo-icon" />
          <span className="auth-logo-text">KineticLife</span>
          <span className="auth-logo-sub">Edge AI · Fitness Intelligence</span>
        </div>
        <div className="auth-card">
          <h2 className="auth-card-title">Welcome back</h2>
          <p className="auth-card-sub">Enter your athlete ID to begin</p>
          <label className="auth-field-label" htmlFor="athlete-id">Athlete ID</label>
          <input
            id="athlete-id" className="input-field auth-input" placeholder="Your name"
            value={name} autoFocus
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && trimmed && onEnter(trimmed)}
          />
          <button className="btn-primary" disabled={!trimmed} onClick={() => onEnter(trimmed)}>
            Enter Session →
          </button>
        </div>
        <div>
          <div className="auth-footer-stats">
            <div className="auth-stat"><div className="auth-stat-val">47</div><div className="auth-stat-label">Sessions</div></div>
            <div className="auth-stat"><div className="auth-stat-val">92%</div><div className="auth-stat-label">Avg Form</div></div>
            <div className="auth-stat"><div className="auth-stat-val">12</div><div className="auth-stat-label">Day Streak</div></div>
          </div>
          <div style={{ height: "1rem" }} />
          <p className="auth-powered">Powered by Seeed Grove Vision AI · On-Device Inference</p>
        </div>
      </div>
    </div>
  );
}

// ── WelcomeScreen ────────────────────────────────────────────────────────────

function WelcomeScreen({ onStart, athleteProfile }) {
  const name = athleteProfile?.name ?? "Athlete";
  const averageForm = athleteProfile?.averageForm || 0;
  const lastExercise = EXERCISES.find(ex => ex.id === athleteProfile?.lastExercise)?.label ?? "Ready";

  return (
    <div className="screen">
      <div className="welcome-wrap">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.5rem 0 0.5rem" }}>
          <div className="logo-mark" style={{ marginBottom: 0 }}>
            <div className="logo-icon" />
            <span className="logo-text">KineticLife</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Welcome back</div>
            <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--green)" }}>{name}</div>
          </div>
        </div>


        {/* Primary action cards */}
        <div className="mode-cards">
          <button className="mode-card" onClick={() => onStart("jump")}>
            <div className="mode-card-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2L11.5 7H6.5L9 2Z" fill="var(--green)" />
                <rect x="6.5" y="8" width="5" height="7" rx="1" fill="var(--green)" fillOpacity="0.55" />
              </svg>
            </div>
            <div className="mode-card-title">Jump-In</div>
            <div className="mode-card-sub">Start today's workout with live AI feedback.</div>
            <div className="mode-card-cta">Start now →</div>
          </button>
          <button className="mode-card" onClick={() => onStart("plan")}>
            <div className="mode-card-icon">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2C9 2 3.5 6.5 3.5 11C3.5 13.8 6 16 9 16C12 16 14.5 13.8 14.5 11C14.5 6.5 9 2 9 2Z" stroke="var(--green)" strokeWidth="1.4" fill="none" />
                <circle cx="9" cy="11" r="2.2" fill="var(--green)" />
              </svg>
            </div>
            <div className="mode-card-title">Plan</div>
            <div className="mode-card-sub">Structured program. Follow your daily path.</div>
            <div className="mode-card-cta">Continue →</div>
          </button>
        </div>

        {/* Home Workout — kept as standalone entry */}
        <button className="entry-card" onClick={() => onStart("home")}>
          <span className="entry-kicker">Low friction</span>
          <span className="entry-arrow">→</span>
          <span className="entry-label">Home Workout</span>
          <span className="entry-detail">Keep it light, bodyweight-first, and coach-led.</span>
        </button>

        {/* Journey timeline */}
        <div className="journey-section">
          <div className="journey-header">
            <span className="journey-title">Your Journey</span>
            <span className="journey-badge">Week 2 · Fitness Program</span>
          </div>
          <div style={{ position: "relative" }}>
            <div className="journey-line" style={{ top: "24px", bottom: "24px" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", position: "relative", zIndex: 1 }}>

              {/* Completed */}
              <div className="journey-node" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--surface)", border: "2px solid rgba(127,255,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative", zIndex: 1 }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" /></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", opacity: 0.7, fontWeight: 500 }}>Day 10 · Completed</div>
                  <div style={{ fontSize: "0.83rem", color: "var(--text-muted)" }}>Goblet Squat · Form: 88%</div>
                </div>
              </div>

              <div className="journey-node" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--surface)", border: "2px solid rgba(127,255,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative", zIndex: 1 }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" /></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", opacity: 0.7, fontWeight: 500 }}>Day 11 · Completed</div>
                  <div style={{ fontSize: "0.83rem", color: "var(--text-muted)" }}>Box Squat · Form: 91%</div>
                </div>
              </div>

              {/* Active — today */}
              <div className="journey-node journey-node-active" onClick={() => onStart("plan")} style={{ display: "flex", alignItems: "center", gap: "1rem", borderRadius: "12px", padding: "0.35rem 0" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative", zIndex: 1 }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 3v6l4 2" stroke="var(--black)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.68rem", color: "var(--green)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Day 12 · Today</div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text)" }}>Full-Body Circuit</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>3 exercises · AI form tracking</div>
                </div>
                <span style={{ color: "var(--text-muted)", fontSize: "1.1rem", paddingRight: "0.25rem" }}>›</span>
              </div>

              {/* Locked */}
              <div className="journey-node" style={{ display: "flex", alignItems: "center", gap: "1rem", opacity: 0.35 }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--surface2)", border: "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative", zIndex: 1 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2.5" y="6" width="9" height="6" rx="1.5" stroke="var(--text-muted)" strokeWidth="1.4" /><path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="var(--text-muted)" strokeWidth="1.4" strokeLinecap="round" /></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 500 }}>Day 13 · Locked</div>
                  <div style={{ fontSize: "0.83rem", color: "var(--text-muted)" }}>Pause Squat</div>
                </div>
              </div>

              <div className="journey-node" style={{ display: "flex", alignItems: "center", gap: "1rem", opacity: 0.2 }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--surface2)", border: "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative", zIndex: 1 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2.5" y="6" width="9" height="6" rx="1.5" stroke="var(--text-muted)" strokeWidth="1.4" /><path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="var(--text-muted)" strokeWidth="1.4" strokeLinecap="round" /></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 500 }}>Day 14 · Locked</div>
                  <div style={{ fontSize: "0.83rem", color: "var(--text-muted)" }}>1-Rep Max Test</div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textAlign: "center", paddingBottom: "0.5rem" }}>
          No account needed · data stays on your local network
        </p>
      </div>
    </div>
  );
}

function ConnectionStatusPanel({ connectionStatus, statusText, deviceSettings, showSavedSystem = false }) {
  const hasVideoLink = connectionStatus === "wifi_only" || connectionStatus === "dual_active" || connectionStatus === "ble_only";
  const dotClass = connectionStatus !== "disconnected" ? "live" : "";
  const text = hasVideoLink
    ? `${statusText} · workout ready`
    : "No workout video link. Use Setup to connect.";

  return (
    <div className="status-panel">
      <div className="status-panel-title">Device status</div>
      <div className="connect-status" style={{ marginTop: 0 }}>
        <div className={`status-dot ${dotClass}`} />
        <span className="status-panel-text">{text}</span>
      </div>
      {showSavedSystem && (
        <p className="status-panel-text" style={{ marginTop: "0.5rem" }}>
          Saved system: {deviceSettings.preferredSource === "wifi" ? "WiFi video" : "BLE camera"} · {deviceSettings.camUrl}
        </p>
      )}
    </div>
  );
}

// ── TrainScreen ──────────────────────────────────────────────────────────────

function TrainScreen({ onBegin, onBack, entryMode, connectionStatus, statusText, deviceSettings }) {
  const [exercise, setExercise] = useState("squat");
  const hasVideoLink = connectionStatus === "wifi_only" || connectionStatus === "dual_active" || connectionStatus === "ble_only";
  const entryLabel = ENTRY_MODES.find(entry => entry.id === entryMode)?.label ?? "Jump-in";

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <span className="screen-title">{entryLabel}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", flex: 1 }}>
        <ConnectionStatusPanel
          connectionStatus={connectionStatus}
          statusText={statusText}
          deviceSettings={deviceSettings}
        />

        <div>
          <p className="section-label">Exercise</p>
          <div className="exercise-grid">
            {EXERCISES.map(ex => (
              <div
                key={ex.id}
                className={`exercise-card${exercise === ex.id ? " selected" : ""}`}
                onClick={() => setExercise(ex.id)}
              >
                <span className="ex-icon">{ex.icon}</span>
                <span className="ex-label">{ex.label}</span>
                <div className="ex-check">✓</div>
              </div>
            ))}
          </div>
        </div>

        <div className="spacer" />
        {hasVideoLink ? (
          <button
            className="btn-primary"
            onClick={() => onBegin({
              ...deviceSettings,
              entryMode,
              exercise: EXERCISES.find(e => e.id === exercise),
            })}
          >
            Begin Set →
          </button>
        ) : (
          <button className="btn-primary" disabled>
            Setup Required
          </button>
        )}
      </div>
    </div>
  );
}

// ── SettingsScreen ───────────────────────────────────────────────────────────

function SettingsScreen({
  connectionStatus,
  statusText,
  deviceSettings,
  setDeviceSettings,
  connectWiFi,
  connectBLE,
  sendBLECommand,
  disconnectAll,
}) {
  const [draftUrl, setDraftUrl] = useState(deviceSettings.camUrl);
  const [source, setSource] = useState(deviceSettings.preferredSource);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState("");
  const hasVideoLink = connectionStatus === "wifi_only" || connectionStatus === "dual_active" || connectionStatus === "ble_only";
  const isConnected = connectionStatus !== "disconnected";

  useEffect(() => {
    setDraftUrl(deviceSettings.camUrl);
    setSource(deviceSettings.preferredSource);
  }, [deviceSettings.camUrl, deviceSettings.preferredSource]);

  function persist(next) {
    setDeviceSettings(next);
    writeDeviceSettings(next);
  }

  async function handleConnect() {
    const next = { camUrl: draftUrl.trim() || deviceSettings.camUrl, preferredSource: source };
    persist(next);
    setBusy(true); setLocalErr("");
    try {
      if (source === "wifi") await connectWiFi(next.camUrl);
      else                   await connectBLE();
    } catch (e) {
      setLocalErr(e?.message || "Connection failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSwitchToWiFi() {
    setBusy(true); setLocalErr("");
    try {
      await sendBLECommand("mode=wifi");
      const next = { camUrl: draftUrl.trim() || deviceSettings.camUrl, preferredSource: "wifi" };
      persist(next);
      setSource("wifi");
    } catch (e) {
      setLocalErr(e?.message || "Switch failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <span className="screen-title">Settings</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", flex: 1 }}>
        <ConnectionStatusPanel
          connectionStatus={connectionStatus}
          statusText={statusText}
          deviceSettings={deviceSettings}
          showSavedSystem
        />

        <div>
          <p className="section-label">Workout transport</p>
          <div className="source-toggle">
            {["wifi", "ble"].map(s => (
              <button
                key={s}
                className={`source-btn${source === s ? " active" : ""}`}
                onClick={() => { setSource(s); setLocalErr(""); }}
              >
                {s === "wifi" ? (
                  <>WiFi<small>video + MediaPipe</small></>
                ) : (
                  <>BLE<small>primary · camera stream</small></>
                )}
              </button>
            ))}
          </div>
          <div className="mode-note">
            {source === "wifi" ? (
              <>WiFi WebSocket — fallback / desktop debug path.</>
            ) : (
              <>BLE is the default link. Camera frames stream over GATT; MediaPipe runs in-browser. iOS Safari not supported.</>
            )}
          </div>
        </div>

        <div>
          <p className="section-label">WiFi device address</p>
          <input
            className="input-field"
            value={draftUrl}
            onChange={e => setDraftUrl(e.target.value)}
            placeholder="http://fitcam-xxxxxx.local or IP"
          />
        </div>

        {localErr && (
          <div className="mode-note" style={{ borderColor: "rgba(255,68,68,0.45)", color: "#ff8888" }}>
            {localErr}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          <button className="btn-primary" onClick={handleConnect} disabled={busy}>
            {busy ? "Connecting…" : source === "wifi" ? "Connect WiFi Video" : "Connect BLE"}
          </button>
          {source === "ble" && isConnected && !hasVideoLink && (
            <button className="btn-ghost" onClick={handleSwitchToWiFi} disabled={busy}>
              Fallback to WiFi Video
            </button>
          )}
          {isConnected && (
            <button className="btn-ghost" onClick={disconnectAll} disabled={busy}>
              Disconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── JumpIn / Plan / Home Workout Containers ─────────────────────────────────

function AutoClassifyScreen({ connectionStatus, statusText, deviceSettings, onCancel, onDetected }) {
  const [progress, setProgress] = useState(0);
  const hasVideoLink = connectionStatus === "wifi_only" || connectionStatus === "dual_active" || connectionStatus === "ble_only";

  useEffect(() => {
    if (!hasVideoLink) return;
    const started = performance.now();
    const timer = setInterval(() => {
      const pct = Math.min(100, Math.round(((performance.now() - started) / 3000) * 100));
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(timer);
        onDetected(exerciseById("squat"));
      }
    }, 120);
    return () => clearInterval(timer);
  }, [hasVideoLink, onDetected]);

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onCancel}>←</button>
        <span className="screen-title">Jump-in</span>
      </div>
      <div className="flow-stack">
        <ConnectionStatusPanel
          connectionStatus={connectionStatus}
          statusText={statusText}
          deviceSettings={deviceSettings}
        />
        <div className="scan-card">
          <div className="scan-title">Auto classify</div>
          <p className="scan-copy">
            Stand in frame and perform the first rep. KineTrak samples the opening seconds, then loads the matching workout.
          </p>
          <div className="confidence-bar">
            <div className="confidence-fill" style={{ width: `${hasVideoLink ? progress : 0}%` }} />
          </div>
        </div>
        {!hasVideoLink && (
          <div className="mode-note">No active camera stream. Use Setup to connect BLE or WiFi before Jump-in.</div>
        )}
      </div>
    </div>
  );
}

function PlanConfigScreen({ connectionStatus, statusText, deviceSettings, onBack, onBegin }) {
  const [selected, setSelected] = useState(["quads", "shoulders"]);
  const hasVideoLink = connectionStatus === "wifi_only" || connectionStatus === "dual_active" || connectionStatus === "ble_only";

  function toggleMuscle(muscle) {
    setSelected(prev => prev.includes(muscle)
      ? prev.filter(item => item !== muscle)
      : [...prev, muscle]);
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <span className="screen-title">Plan</span>
      </div>
      <div className="flow-stack">
        <ConnectionStatusPanel
          connectionStatus={connectionStatus}
          statusText={statusText}
          deviceSettings={deviceSettings}
        />
        <div className="profile-card">
          <p className="profile-card-title">AI recommended plan</p>
          {PLAN_PRESET.map(item => (
            <div className="plan-row" key={item.exercise}>
              <span className="plan-name">{item.exercise}</span>
              <span className="plan-meta">{item.sets} sets · {item.targetReps} reps</span>
            </div>
          ))}
        </div>
        <div>
          <p className="section-label">Customize focus</p>
          <div className="muscle-chip-grid">
            {PLAN_MUSCLES.map(muscle => (
              <button
                key={muscle}
                className={`muscle-chip${selected.includes(muscle) ? " active" : ""}`}
                onClick={() => toggleMuscle(muscle)}
              >
                {muscle}
              </button>
            ))}
          </div>
        </div>
        <div className="spacer" />
        <button
          className="btn-primary"
          disabled={!hasVideoLink}
          onClick={() => onBegin(recommendedExerciseForMode("plan"))}
        >
          One-Tap Start →
        </button>
      </div>
    </div>
  );
}

function HomeCoachScreen({ connectionStatus, statusText, deviceSettings, onBack, onBegin }) {
  const [focus, setFocus] = useState("quads");
  const hasVideoLink = connectionStatus === "wifi_only" || connectionStatus === "dual_active" || connectionStatus === "ble_only";

  return (
    <div className="home-workout-screen">
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={onBack}>←</button>
          <span className="screen-title">Home Workout</span>
        </div>
        <div className="flow-stack">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div className="coach-face">TK</div>
            <div>
              <p className="profile-card-title" style={{ marginBottom: "0.35rem" }}>Duo-style coach</p>
              <p className="ai-copy">Pick a body focus. Trakko keeps the set light, playful, and equipment-free.</p>
            </div>
          </div>
          <ConnectionStatusPanel
            connectionStatus={connectionStatus}
            statusText={statusText}
            deviceSettings={deviceSettings}
          />
          <div>
            <p className="section-label">Body focus</p>
            <div className="muscle-chip-grid">
              {["quads", "core", "shoulders", "cardio"].map(item => (
                <button
                  key={item}
                  className={`muscle-chip${focus === item ? " active" : ""}`}
                  onClick={() => setFocus(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="profile-card">
            <p className="profile-card-title">Today</p>
            <p className="ai-copy">No equipment. Short rounds, clean reps, friendly pressure. Default move: bodyweight squat.</p>
          </div>
          <div className="spacer" />
          <button
            className="btn-primary"
            disabled={!hasVideoLink}
            onClick={() => onBegin(recommendedExerciseForMode("home"))}
          >
            Start Coach Set →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ProfileScreen ────────────────────────────────────────────────────────────

function formatLastTrained(ts) {
  if (!ts) return "No set logged yet";
  const minutes = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function heatBand(value) {
  if (value >= 0.72) return "High load";
  if (value >= 0.42) return "Moderate";
  if (value > 0) return "Recovering";
  return "Rested";
}

function MuscleShape({ id, d, marker, row, selectedId, onSelect, recentCutoff }) {
  const value = row?.value ?? 0;
  const isActive = selectedId === id;
  const isRecent = row?.lastTrainedAt && row.lastTrainedAt > recentCutoff;
  const fill = `rgba(127,255,0,${0.12 + value * 0.72})`;
  const stroke = isActive ? "var(--green)" : `rgba(127,255,0,${0.16 + value * 0.32})`;

  function choose() {
    onSelect(id);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose();
    }
  }

  return (
    <g
      role="button"
      tabIndex="0"
      aria-label={`${row?.label ?? id} ${Math.round(value * 100)} percent load`}
      onClick={choose}
      onKeyDown={handleKeyDown}
    >
      <path
        className={`muscle-shape${isActive ? " active" : ""}`}
        d={d}
        fill={fill}
        stroke={stroke}
      />
      {isRecent && <circle className="muscle-node" cx={marker[0]} cy={marker[1]} r="3.2" />}
    </g>
  );
}

function MuscleBodyMap({ view, muscleRows, selectedId, onSelect, recentCutoff }) {
  const rows = Object.fromEntries(muscleRows.map(item => [item.id, item]));
  const front = view === "front";
  const shapes = front
    ? [
        { id: "shoulders", marker: [110, 82], d: "M62 78 C72 63 91 64 98 77 L92 97 C80 90 70 90 56 101 C54 92 55 84 62 78 Z M158 78 C148 63 129 64 122 77 L128 97 C140 90 150 90 164 101 C166 92 165 84 158 78 Z" },
        { id: "chest", marker: [110, 105], d: "M76 91 C88 82 101 83 108 94 L108 126 C92 126 80 120 72 110 C70 102 71 96 76 91 Z M144 91 C132 82 119 83 112 94 L112 126 C128 126 140 120 148 110 C150 102 149 96 144 91 Z" },
        { id: "biceps", marker: [52, 134], d: "M51 103 C62 105 69 115 68 130 L61 174 C59 185 48 184 45 174 L45 123 C45 114 47 108 51 103 Z M169 103 C158 105 151 115 152 130 L159 174 C161 185 172 184 175 174 L175 123 C175 114 173 108 169 103 Z" },
        { id: "core", marker: [110, 155], d: "M87 129 C96 134 124 134 133 129 L137 184 C128 194 92 194 83 184 Z" },
        { id: "quads", marker: [110, 225], d: "M82 191 C94 198 103 198 108 191 L107 259 C99 264 87 262 83 252 L78 218 C77 207 78 198 82 191 Z M138 191 C126 198 117 198 112 191 L113 259 C121 264 133 262 137 252 L142 218 C143 207 142 198 138 191 Z" },
        { id: "front_calves", marker: [110, 286], d: "M84 258 C94 264 101 264 107 259 L106 310 C98 318 88 315 86 303 Z M136 258 C126 264 119 264 113 259 L114 310 C122 318 132 315 134 303 Z" },
      ]
    : [
        { id: "shoulders", marker: [110, 83], d: "M61 78 C73 62 93 65 101 80 L94 101 C79 91 68 91 55 102 C53 92 54 84 61 78 Z M159 78 C147 62 127 65 119 80 L126 101 C141 91 152 91 165 102 C167 92 166 84 159 78 Z" },
        { id: "upper_back", marker: [110, 115], d: "M76 87 C91 77 129 77 144 87 C149 104 146 127 137 142 C124 136 96 136 83 142 C74 127 71 104 76 87 Z" },
        { id: "lower_back", marker: [110, 163], d: "M83 142 C97 136 123 136 137 142 C135 158 132 174 126 185 C118 191 102 191 94 185 C88 174 85 158 83 142 Z" },
        { id: "triceps", marker: [168, 137], d: "M52 105 C64 107 70 119 68 137 L60 181 C57 191 47 187 45 176 L45 125 C45 116 48 109 52 105 Z M168 105 C156 107 150 119 152 137 L160 181 C163 191 173 187 175 176 L175 125 C175 116 172 109 168 105 Z" },
        { id: "hamstrings", marker: [110, 225], d: "M82 191 C94 199 103 199 108 191 L107 259 C99 264 87 262 83 252 L78 218 C77 207 78 198 82 191 Z M138 191 C126 199 117 199 112 191 L113 259 C121 264 133 262 137 252 L142 218 C143 207 142 198 138 191 Z" },
        { id: "rear_calves", marker: [110, 286], d: "M84 258 C94 264 101 264 107 259 L106 310 C98 318 88 315 86 303 Z M136 258 C126 264 119 264 113 259 L114 310 C122 318 132 315 134 303 Z" },
      ];

  return (
    <div className="body-map-wrap">
      <svg className="body-map" viewBox="0 0 220 340" aria-label={`${view} muscle load map`}>
        <circle className="body-base" cx="110" cy="34" r="21" />
        <path className="body-base" d="M99 54 C104 61 116 61 121 54 L123 72 L97 72 Z" />
        <path className="body-base" d="M75 76 C91 64 129 64 145 76 C159 99 159 151 140 190 C128 202 92 202 80 190 C61 151 61 99 75 76 Z" />
        <path className="body-base" d="M55 100 C42 112 39 143 45 178 C47 190 59 191 63 179 L70 133 C73 115 66 104 55 100 Z M165 100 C178 112 181 143 175 178 C173 190 161 191 157 179 L150 133 C147 115 154 104 165 100 Z" />
        <path className="body-base" d="M82 190 C94 200 103 199 110 190 C117 199 126 200 138 190 L142 219 L134 303 C132 318 120 322 112 311 L110 221 L108 311 C100 322 88 318 86 303 L78 219 Z" />
        {shapes.map(shape => (
          <MuscleShape
            key={shape.id}
            id={shape.id}
            d={shape.d}
            marker={shape.marker}
            row={rows[shape.id]}
            selectedId={selectedId}
            onSelect={onSelect}
            recentCutoff={recentCutoff}
          />
        ))}
        <text className="body-map-label" x="110" y="330" textAnchor="middle">{front ? "Front chain" : "Back chain"}</text>
      </svg>
      <div className="body-map-legend">
        <span>Rested</span>
        <div className="legend-track" />
        <span>Loaded</span>
      </div>
    </div>
  );
}

function ProfileScreen({ athleteProfile, muscleStatus }) {
  const name = athleteProfile?.name ?? "Athlete";
  const sessions = athleteProfile?.sessionsCount ?? 0;
  const averageForm = athleteProfile?.averageForm || 0;
  const streakDays = athleteProfile?.streakDays || 0;
  const lastExercise = EXERCISES.find(ex => ex.id === athleteProfile?.lastExercise)?.label ?? "No set yet";
  const muscleRows = MUSCLE_DEFS.map(muscle => ({
    ...muscle,
    value: clamp01(muscleStatus?.[muscle.id]),
    lastTrainedAt: muscleStatus?.lastTrainedAt?.[muscle.id] ?? null,
    setCount: Number(muscleStatus?.setCounts?.[muscle.id]) || 0,
  }));
  const freshestMuscle = muscleRows.reduce((best, item) => item.value > best.value ? item : best, muscleRows[0]);
  const initialView = ["upper_back", "lower_back", "triceps", "hamstrings", "rear_calves"].includes(freshestMuscle.id) ? "back" : "front";
  const [bodyView, setBodyView] = useState(initialView);
  const [selectedMuscle, setSelectedMuscle] = useState(freshestMuscle.id);
  const selected = muscleRows.find(item => item.id === selectedMuscle) ?? freshestMuscle;
  const todayLoad = Math.round(muscleRows.reduce((sum, item) => sum + item.value, 0) / muscleRows.length * 100);
  const recentCutoff = Date.now() - 1000 * 60 * 60 * 6;

  return (
    <div className="screen">
      <div className="screen-header">
        <span className="screen-title">Profile</span>
      </div>
      <div className="profile-stack">
        <div className="profile-card">
          <p className="profile-card-title">Current progress</p>
          <div className="progress-grid">
            <div className="progress-cell">
              <div className="progress-value">{sessions}</div>
              <div className="progress-label">Sessions</div>
            </div>
            <div className="progress-cell">
              <div className="progress-value">{averageForm ? `${averageForm}%` : "--"}</div>
              <div className="progress-label">Avg form</div>
            </div>
            <div className="progress-cell">
              <div className="progress-value">{streakDays}</div>
              <div className="progress-label">Streak</div>
            </div>
          </div>
          <p className="status-panel-text" style={{ marginTop: "0.8rem" }}>
            {name} · last set: {lastExercise}
          </p>
        </div>

        <div className="profile-card heatmap-card">
          <div className="heatmap-head">
            <div>
              <p className="profile-card-title" style={{ marginBottom: "0.35rem" }}>Muscle heatmap</p>
              <p className="heatmap-caption">Training load by muscle group. It cools down by 10% per day without new work.</p>
            </div>
            <div className="heatmap-summary">
              <div className="heatmap-summary-value">{todayLoad}%</div>
              <div className="heatmap-summary-label">Load avg</div>
            </div>
          </div>
          <div className="body-view-toggle" aria-label="Muscle map view">
            <button
              className={`body-view-btn${bodyView === "front" ? " active" : ""}`}
              onClick={() => setBodyView("front")}
            >
              Front
            </button>
            <button
              className={`body-view-btn${bodyView === "back" ? " active" : ""}`}
              onClick={() => setBodyView("back")}
            >
              Back
            </button>
          </div>
          <MuscleBodyMap
            view={bodyView}
            muscleRows={muscleRows}
            selectedId={selected.id}
            onSelect={setSelectedMuscle}
            recentCutoff={recentCutoff}
          />
          <div className="heatmap-detail">
            <div>
              <div className="heatmap-detail-title">{selected.label} · {heatBand(selected.value)}</div>
              <div className="heatmap-detail-copy">
                {formatLastTrained(selected.lastTrainedAt)} · {selected.setCount} logged set{selected.setCount === 1 ? "" : "s"}.
                {selected.value >= 0.72
                  ? " Treat this as loaded; keep volume controlled."
                  : selected.value >= 0.42
                    ? " Solid recent work; pair it with a lighter accessory block."
                    : " Good recovery window for a focused set."}
              </div>
            </div>
            <div className="heatmap-detail-value">{Math.round(selected.value * 100)}%</div>
          </div>
        </div>

        <div className="profile-card">
          <p className="profile-card-title">AI zone</p>
          <p className="ai-copy">
            Trakko sees {freshestMuscle.label.toLowerCase()} carrying the most recent load at {Math.round(freshestMuscle.value * 100)}%.
            Keep today controlled: warm up with Jump-in, then use Plan if your form score stays above 80%.
          </p>
        </div>
      </div>
    </div>
  );
}

function AIAgentOverlay({ currentScreen, athleteProfile, muscleStatus }) {
  if (currentScreen === "live" || currentScreen === "auth") return null;
  const name = athleteProfile?.name ?? "Athlete";
  const hottest = MUSCLE_DEFS.reduce((best, muscle) => (
    (muscleStatus?.[muscle.id] ?? 0) > (muscleStatus?.[best.id] ?? 0) ? muscle : best
  ), MUSCLE_DEFS[0]);
  const messages = {
    welcome: `${name}, ${hottest.label.toLowerCase()} has the highest recent load. Jump-in is ready when you are.`,
    profile: "Muscle heat decays over time. Green bars mean recent training stress, not permanent fatigue.",
    settings: "Setup owns every device decision, so training screens stay clean.",
    plan: "Plan mode uses cached recommendations first, keeping AI calls quiet and deliberate.",
    homeWorkout: "Home Workout keeps the vibe light: bodyweight, clean reps, no equipment.",
    autoClassify: "Hold one clean rep in frame. I will classify the movement from the opening sample.",
  };
  const message = messages[currentScreen] ?? "I will stay out of Live mode and keep notes here.";

  return (
    <div className="ai-agent-container">
      <div className="chat-bubble">{message}</div>
      <div className="ai-avatar">TK</div>
    </div>
  );
}

// ── LiveScreen ───────────────────────────────────────────────────────────────
// Replaced <img /stream> with <canvas ref={liveCanvasRef}>.
// All rep/elapsed/hint data comes from sensorData (real MediaPipe pipeline).

function LiveScreen({ config, onFinish, sensorData, liveCanvasRef, repNumElRef, stopSession, connectionStatus, statusText }) {
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const activeHint = sensorData.hints[0] ?? null;
  const previousRepRef = useRef(sensorData.repCount);
  const sourceClass = connectionStatus === "dual_active"
    ? "dual"
    : connectionStatus === "wifi_only"
      ? "wifi"
      : connectionStatus === "ble_only"
        ? "ble"
        : "";
  const sourceLabel = connectionStatus === "dual_active"
    ? "WiFi + BLE"
    : connectionStatus === "wifi_only"
      ? "WiFi video"
      : connectionStatus === "ble_only"
        ? "BLE camera"
        : statusText;

  useEffect(() => {
    if (sensorData.repCount > previousRepRef.current && typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(35);
    }
    previousRepRef.current = sensorData.repCount;
  }, [sensorData.repCount]);

  function handleFinish() {
    stopSession();
    onFinish();
  }

  return (
    <div className="live-screen">
      <div className="cam-area">
        {/* Dark canvas with real-time skeleton overlay */}
        <canvas
          ref={liveCanvasRef}
          style={{ width: "100%", height: "100%", display: "block", background: "#000" }}
        />

        {/* Loading placeholder — shown until first frame arrives */}
        {!sensorData.mpReady && (
          <div className="cam-placeholder" style={{ position: "absolute", inset: 0 }}>
            <div className="cam-placeholder-icon">🤸</div>
            <p>Loading MediaPipe…</p>
          </div>
        )}

        <div className="cam-overlay">
          <div className="cam-corner tl" /><div className="cam-corner tr" />
          <div className="cam-corner bl" /><div className="cam-corner br" />
          <div className="live-badge"><div className="live-dot" />TRAINING</div>
          <div className={`source-badge ${sourceClass}`}>{sourceLabel}</div>
          {activeHint && (
            <div className="form-hint">
              <div className="hint-pill">{activeHint}</div>
            </div>
          )}
          <div className="rep-counter">
            <div className="rep-num" ref={repNumElRef}>{sensorData.repCount}</div>
            <div className="rep-label">Reps</div>
          </div>
        </div>
      </div>

      <div className="session-bar">
        <div className="session-meta">
          <span className="session-exercise">{config.exercise.label}</span>
          <span className="session-timer">{fmt(sensorData.elapsed)}</span>
        </div>
        <button className="finish-btn" onClick={handleFinish}>FINISH SET</button>
      </div>
    </div>
  );
}

// ── DtwChart ─────────────────────────────────────────────────────────────────

const EX_ANGLE_RANGE_CHART = {
  squat:         { restVal: 165, workVal: 95 },
  bicep_curl:    { restVal: 160, workVal: 40 },
  lateral_raise: { restVal: 18,  workVal: 78 },
};

function DtwChart({ keyAngleBuffer, exKey }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.offsetWidth || 320;
    const H = 140;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const N = 60;
    const r = EX_ANGLE_RANGE_CHART[exKey] ?? EX_ANGLE_RANGE_CHART.squat;
    const count = keyAngleBuffer?.length ?? 0;
    const repsEst = Math.max(1, Math.round(count / 30));

    const golden = Array.from({ length: N }, (_, i) => {
      const frac = 0.5 - 0.5 * Math.cos((i / N) * repsEst * 2 * Math.PI);
      return r.restVal + (r.workVal - r.restVal) * frac;
    });

    const userCurve = count >= 4
      ? Array.from({ length: N }, (_, i) => keyAngleBuffer[Math.round(i / (N - 1) * (count - 1))])
      : null;

    const allVals = userCurve ? [...golden, ...userCurve] : golden;
    const minVal = Math.min(...allVals) - 5;
    const maxVal = Math.max(...allVals) + 5;
    const pad = { t: 8, r: 6, b: 8, l: 30 };
    const cW = W - pad.l - pad.r;
    const cH = H - pad.t - pad.b;
    const toX = i => pad.l + (i / (N - 1)) * cW;
    const toY = v => pad.t + (1 - (v - minVal) / (maxVal - minVal)) * cH;

    function ease(t) {
      return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
    }

    function drawStatic() {
      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      [0, 0.25, 0.5, 0.75, 1].forEach(t => {
        const y = pad.t + t * cH;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      });
      // Y labels
      ctx.fillStyle = 'rgba(200,230,180,0.35)';
      ctx.font = '9px system-ui, sans-serif';
      ctx.textAlign = 'right';
      [0, 0.5, 1].forEach(t => {
        ctx.fillText(Math.round(maxVal - t * (maxVal - minVal)) + '°', pad.l - 2, pad.t + t * cH + 3);
      });
    }

    const DURATION = 1000;
    const USER_DELAY = 120; // ms after golden starts
    let startTs = null;
    let rafId;

    function frame(ts) {
      if (!startTs) startTs = ts;
      const elapsed = ts - startTs;

      ctx.clearRect(0, 0, W, H);
      drawStatic();

      // Golden curve — draw up to current progress
      const gProg = ease(Math.min(elapsed / DURATION, 1));
      const gEnd = Math.max(1, Math.round(gProg * (N - 1)));
      ctx.save();
      ctx.setLineDash([5, 3]);
      ctx.strokeStyle = 'rgba(127,255,0,0.65)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= gEnd; i++) {
        i === 0 ? ctx.moveTo(toX(i), toY(golden[i])) : ctx.lineTo(toX(i), toY(golden[i]));
      }
      ctx.stroke();
      ctx.restore();

      // User curve — starts USER_DELAY ms later
      if (userCurve) {
        const uProg = ease(Math.max(0, Math.min((elapsed - USER_DELAY) / DURATION, 1)));
        const uEnd = Math.max(1, Math.round(uProg * (N - 1)));
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= uEnd; i++) {
          i === 0 ? ctx.moveTo(toX(i), toY(userCurve[i])) : ctx.lineTo(toX(i), toY(userCurve[i]));
        }
        ctx.stroke();
      } else if (elapsed > DURATION) {
        ctx.fillStyle = 'rgba(200,230,180,0.28)';
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No movement data recorded', W / 2, H / 2 + 4);
      }

      if (elapsed < DURATION + USER_DELAY) {
        rafId = requestAnimationFrame(frame);
      }
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [keyAngleBuffer, exKey]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '140px', display: 'block' }} />;
}

// ── AnalysisScreen ───────────────────────────────────────────────────────────
// analysisResult: real AnalysisResult from hook, or null (falls back to MOCK_DTW)

function AnalysisScreen({ analysisResult, onReset }) {
  const dtw          = analysisResult ?? MOCK_DTW;
  const completeness = Math.round(dtw.completeness * 100);
  const dtwOk        = dtw.dtw_distance <= dtw.dtw_threshold;
  const radius       = 46;
  const circ         = 2 * Math.PI * radius;
  const dash         = (completeness / 100) * circ;
  const elapsed      = dtw.elapsed ?? 0;

  return (
    <div className="screen">
      <div className="screen-header">
        <span className="screen-title">Set Analysis</span>
      </div>
      <div className="analysis-wrap">

        {/* Score ring */}
        <div className="score-hero">
          <p className="score-label">Form completeness</p>
          <div className="score-ring-wrap">
            <div className="score-ring">
              <svg width="110" height="110" viewBox="0 0 110 110">
                <circle cx="55" cy="55" r={radius} fill="none" stroke="rgba(127,255,0,0.1)" strokeWidth="8" />
                <circle
                  cx="55" cy="55" r={radius}
                  fill="none"
                  stroke={dtwOk ? "#7FFF00" : "#ff4444"}
                  strokeWidth="8"
                  strokeDasharray={`${dash} ${circ}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="score-center">
                <span className="score-pct">{completeness}%</span>
                <span className="score-pct-label">complete</span>
              </div>
            </div>
          </div>
          <p className="score-verdict">
            <strong>{dtw.correct ? "Good form" : "Needs work"}</strong>
            {" · DTW "}
            <strong style={{ color: dtwOk ? "var(--green)" : "var(--red)" }}>
              {dtw.dtw_distance.toFixed(2)}
            </strong>
            {" / "}{dtw.dtw_threshold.toFixed(2)}
          </p>
        </div>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-card-val">{dtw.reps}</div>
            <div className="stat-card-label">Reps</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-val">{dtw.accuracy}%</div>
            <div className="stat-card-label">Accuracy</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-val">
              {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
            </div>
            <div className="stat-card-label">Duration</div>
          </div>
        </div>

        {/* DTW chart */}
        <div className="section-block">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <p className="section-block-title" style={{ marginBottom: 0 }}>DTW Rhythm Analysis</p>
            <span style={{ fontSize: "0.7rem", fontWeight: 600, color: dtwOk ? "var(--green)" : "var(--red)" }}>
              Match: {Math.max(0, Math.round(100 - dtw.dtw_distance * 10 / 0.9))}%
            </span>
          </div>
          <DtwChart keyAngleBuffer={dtw.keyAngleBuffer ?? []} exKey={dtw.exKey ?? "squat"} />
          <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.65rem", paddingTop: "0.6rem", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.7rem", color: "var(--text-muted)" }}>
              <div style={{ width: "14px", borderTop: "1.5px dashed rgba(127,255,0,0.65)" }} />
              Reference
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.7rem", color: "var(--text-muted)" }}>
              <div style={{ width: "14px", borderTop: "2px solid rgba(255,255,255,0.7)" }} />
              Your reps
            </div>
            <div style={{ marginLeft: "auto", fontSize: "0.68rem", color: "var(--text-muted)", opacity: 0.6 }}>
              {analysisResult?.source === "server" ? "Cloud DTW" : "Local DTW"}
            </div>
          </div>
        </div>

        {/* Problem joints */}
        {dtw.problem_joints.length > 0 && (
          <div className="section-block">
            <p className="section-block-title">Problem areas</p>
            {dtw.problem_joints.map((pj, i) => (
              <div className="joint-row" key={i}>
                <span className="joint-name">{pj.joint.replace(/_/g, " ")}</span>
                <span className="joint-issue">{pj.issue}</span>
                <div className="severity-bar-wrap">
                  <div className="severity-bar" style={{ width: `${Math.round(pj.severity * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Coach advice */}
        <div className="advice-block">
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--green-dim)", marginBottom: "0.5rem" }}>
            Coach feedback
          </p>
          {dtw.advice}
        </div>

        <button className="btn-primary" onClick={onReset}>New Set →</button>
      </div>
    </div>
  );
}

function BottomNav({ active, onNavigate }) {
  const items = [
    { id: "home", label: "Home", sub: "Entries" },
    { id: "profile", label: "Profile", sub: "Progress" },
    { id: "setup", label: "Setup", sub: "Device" },
  ];

  return (
    <nav className="bottom-nav">
      {items.map(item => (
        <button
          key={item.id}
          className={`nav-btn${active === item.id ? " active" : ""}`}
          onClick={() => onNavigate(item.id)}
        >
          {item.label}
          <small>{item.sub}</small>
        </button>
      ))}
    </nav>
  );
}

// ── App (root) ───────────────────────────────────────────────────────────────

export default function App() {
  const [screen,         setScreen]         = useState(INITIAL_PROFILE ? "welcome" : "auth");
  const [athleteProfile, setAthleteProfile] = useState(INITIAL_PROFILE);
  const [muscleStatus,   setMuscleStatus]   = useState(INITIAL_MUSCLE_STATUS);
  const [entryMode,      setEntryMode]      = useState("jump");
  const [deviceSettings, setDeviceSettings] = useState(INITIAL_DEVICE_SETTINGS);
  const [config,         setConfig]         = useState(null);
  const savedAnalysisRef = useRef(null);

  const {
    connectionStatus, statusText, sensorData,
    liveCanvasRef, repNumElRef, connectWiFi, connectBLE,
    disconnectAll, startSession, stopSession, sendBLECommand,
  } = useIoTConnection({
    onAutoEnd: () => setScreen("analysis"),
  });

  // Navigate to analysis when rep target is auto-completed
  useEffect(() => {
    if (screen === "live" && sensorData.analysisResult !== null) {
      setScreen("analysis");
    }
  }, [sensorData.analysisResult, screen]);

  useEffect(() => {
    if (screen !== "analysis" || !sensorData.analysisResult) return;
    if (savedAnalysisRef.current === sensorData.analysisResult) return;
    savedAnalysisRef.current = sensorData.analysisResult;

    setAthleteProfile(prev => {
      const next = nextProfileAfterSet(prev, sensorData.analysisResult, config?.exercise?.id);
      writeAthleteProfile(next);
      return next;
    });
    setMuscleStatus(prev => {
      const next = nextMuscleStatusAfterSet(prev, sensorData.analysisResult, config?.exercise?.id);
      writeMuscleStatus(next);
      return next;
    });
  }, [config?.exercise?.id, screen, sensorData.analysisResult]);

  function handleAthleteEnter(name) {
    const sameAthlete = athleteProfile?.name?.toLowerCase() === name.toLowerCase();
    const existing = sameAthlete ? athleteProfile : makeDefaultProfile(name);
    writeAthleteProfile(existing);
    setAthleteProfile(existing);
    if (!sameAthlete) {
      const freshMuscles = makeDefaultMuscleStatus();
      writeMuscleStatus(freshMuscles);
      setMuscleStatus(freshMuscles);
    }
    setScreen("welcome");
  }

  function beginExercise(exercise, mode = entryMode) {
    const cfg = {
      ...deviceSettings,
      entryMode: mode,
      exercise,
    };
    setConfig(cfg);
    startSession(exercise.id, 3);
    setScreen("live");
  }

  function handleEntryStart(mode) {
    setEntryMode(mode);
    if (mode === "jump") {
      setScreen("autoClassify");
    } else if (mode === "plan") {
      setScreen("plan");
    } else {
      setScreen("homeWorkout");
    }
  }

  const showNav = screen !== "auth" && screen !== "live";
  const navActive = screen === "profile"
    ? "profile"
    : screen === "settings"
      ? "setup"
      : "home";

  function handleNavigate(next) {
    if (next === "profile") {
      setScreen("profile");
    } else if (next === "setup") {
      setScreen("settings");
    } else {
      setScreen("welcome");
    }
  }

  return (
    <>
      <style>{css}</style>
      <div className={`app${showNav ? " has-nav" : ""}`}>
        <div className="grid-bg" />
        <div className="scanline" />

        {screen === "auth" && (
          <AuthScreen onEnter={handleAthleteEnter} />
        )}

        {screen === "welcome" && (
          <WelcomeScreen
            athleteProfile={athleteProfile}
            onStart={handleEntryStart}
          />
        )}

        {screen === "train" && (
          <TrainScreen
            onBack={() => setScreen("welcome")}
            onBegin={cfg => beginExercise(cfg.exercise, cfg.entryMode)}
            entryMode={entryMode}
            connectionStatus={connectionStatus}
            statusText={statusText}
            deviceSettings={deviceSettings}
          />
        )}

        {screen === "autoClassify" && (
          <AutoClassifyScreen
            connectionStatus={connectionStatus}
            statusText={statusText}
            deviceSettings={deviceSettings}
            onCancel={() => setScreen("welcome")}
            onDetected={exercise => beginExercise(exercise, "jump")}
          />
        )}

        {screen === "plan" && (
          <PlanConfigScreen
            connectionStatus={connectionStatus}
            statusText={statusText}
            deviceSettings={deviceSettings}
            onBack={() => setScreen("welcome")}
            onBegin={exercise => beginExercise(exercise, "plan")}
          />
        )}

        {screen === "homeWorkout" && (
          <HomeCoachScreen
            connectionStatus={connectionStatus}
            statusText={statusText}
            deviceSettings={deviceSettings}
            onBack={() => setScreen("welcome")}
            onBegin={exercise => beginExercise(exercise, "home")}
          />
        )}

        {screen === "settings" && (
          <SettingsScreen
            connectionStatus={connectionStatus}
            statusText={statusText}
            deviceSettings={deviceSettings}
            setDeviceSettings={setDeviceSettings}
            connectWiFi={connectWiFi}
            connectBLE={connectBLE}
            sendBLECommand={sendBLECommand}
            disconnectAll={disconnectAll}
          />
        )}

        {screen === "profile" && (
          <ProfileScreen athleteProfile={athleteProfile} muscleStatus={muscleStatus} />
        )}

        {screen === "live" && config && (
          <LiveScreen
            config={config}
            sensorData={sensorData}
            liveCanvasRef={liveCanvasRef}
            repNumElRef={repNumElRef}
            stopSession={stopSession}
            connectionStatus={connectionStatus}
            statusText={statusText}
            onFinish={() => setScreen("analysis")}
          />
        )}

        {screen === "analysis" && (
          <AnalysisScreen
            analysisResult={sensorData.analysisResult}
            onReset={() => {
              setConfig(null);
              setScreen("welcome");
            }}
          />
        )}

        {showNav && (
          <AIAgentOverlay currentScreen={screen} athleteProfile={athleteProfile} muscleStatus={muscleStatus} />
        )}

        {showNav && (
          <BottomNav active={navActive} onNavigate={handleNavigate} />
        )}
      </div>
    </>
  );
}
