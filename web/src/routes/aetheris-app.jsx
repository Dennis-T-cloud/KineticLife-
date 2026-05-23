import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Constants ────────────────────────────────────────────────────────────────

const MUSCLE_GROUPS = [
  { id: "shoulders", label: "Shoulders", view: "front", group: "Upper" },
  { id: "chest", label: "Chest", view: "front", group: "Upper" },
  { id: "biceps", label: "Biceps", view: "front", group: "Arms" },
  { id: "triceps", label: "Triceps", view: "back", group: "Arms" },
  { id: "core", label: "Core", view: "front", group: "Core" },
  { id: "upper_back", label: "Upper Back", view: "back", group: "Back" },
  { id: "lower_back", label: "Lower Back", view: "back", group: "Back" },
  { id: "quads", label: "Front Thighs", view: "front", group: "Legs" },
  { id: "front_calves", label: "Front Calves", view: "front", group: "Legs" },
  { id: "hamstrings", label: "Rear Thighs", view: "back", group: "Legs" },
  { id: "rear_calves", label: "Rear Calves", view: "back", group: "Legs" },
];

const MUSCLE_BY_ID = Object.fromEntries(MUSCLE_GROUPS.map((group) => [group.id, group]));

const MUSCLE_INTENSITY_BY_EXERCISE = {
  squat: { quads: 1, hamstrings: 0.72, core: 0.55, lower_back: 0.38, front_calves: 0.45, rear_calves: 0.45 },
  bicep_curl: { biceps: 1, shoulders: 0.35, core: 0.22 },
  right_bicep_curl: { biceps: 1, shoulders: 0.35, core: 0.22 },
  lateral_raise: { shoulders: 1, triceps: 0.34, upper_back: 0.42, core: 0.22 },
  squat_side: { quads: 1, hamstrings: 0.74, core: 0.56, lower_back: 0.4, front_calves: 0.44, rear_calves: 0.44 },
  barbell_squat_side: { quads: 1, hamstrings: 0.78, core: 0.58, lower_back: 0.46, front_calves: 0.42, rear_calves: 0.42 },
  deadlift_side: { hamstrings: 1, lower_back: 0.9, core: 0.72, quads: 0.38, rear_calves: 0.28, upper_back: 0.46 },
  push_up_side: { chest: 1, triceps: 0.86, shoulders: 0.62, core: 0.55 },
};

const EXERCISES = [
  {
    id: "squat",
    label: "Bodyweight Squat",
    short: "SQ",
    muscles: Object.keys(MUSCLE_INTENSITY_BY_EXERCISE.squat),
    joints: ["left_knee", "right_knee"],
  },
  {
    id: "bicep_curl",
    label: "Left Dumbbell Curl",
    short: "LC",
    muscles: Object.keys(MUSCLE_INTENSITY_BY_EXERCISE.bicep_curl),
    joints: ["left_elbow"],
  },
  {
    id: "right_bicep_curl",
    label: "Right Dumbbell Curl",
    short: "RC",
    muscles: Object.keys(MUSCLE_INTENSITY_BY_EXERCISE.right_bicep_curl),
    joints: ["right_elbow"],
  },
  {
    id: "lateral_raise",
    label: "Lateral Raise",
    short: "LR",
    muscles: Object.keys(MUSCLE_INTENSITY_BY_EXERCISE.lateral_raise),
    joints: ["left_shoulder", "right_shoulder"],
  },
  {
    id: "squat_side",
    label: "Bodyweight Squat Side",
    short: "SQS",
    muscles: Object.keys(MUSCLE_INTENSITY_BY_EXERCISE.squat_side),
    joints: ["visible_knee", "visible_hip"],
  },
  {
    id: "barbell_squat_side",
    label: "Barbell Squat Side",
    short: "BSS",
    muscles: Object.keys(MUSCLE_INTENSITY_BY_EXERCISE.barbell_squat_side),
    joints: ["visible_knee", "visible_hip"],
  },
  {
    id: "deadlift_side",
    label: "Traditional Deadlift",
    short: "DL",
    muscles: Object.keys(MUSCLE_INTENSITY_BY_EXERCISE.deadlift_side),
    joints: ["visible_hip", "visible_knee"],
  },
  {
    id: "push_up_side",
    label: "Push-up Side",
    short: "PU",
    muscles: Object.keys(MUSCLE_INTENSITY_BY_EXERCISE.push_up_side),
    joints: ["visible_elbow", "plank_line"],
  },
];

const AI_PLAN = [
  { exerciseId: "squat", sets: 4, targetReps: 12 },
  { exerciseId: "bicep_curl", sets: 3, targetReps: 15 },
  { exerciseId: "lateral_raise", sets: 3, targetReps: 12 },
];

const AI_CORE_PROFILE_KEY = "ath_ai_core_profile";
const AI_MESSAGES_KEY = "ath_ai_messages";
const AI_UNREAD_KEY = "ath_ai_unread";

const AI_CORE_INJURY_OPTIONS = [
  { id: "lower_back", label: "Lower Back" },
  { id: "knee", label: "Knee" },
  { id: "shoulder", label: "Shoulder" },
  { id: "elbow", label: "Elbow" },
  { id: "wrist", label: "Wrist" },
];

const AI_CORE_EXERCISE_RULES = {
  squat: { group: "Lower Body", baseSets: 4, reps: 12, risk: { knee: 70 } },
  squat_side: { group: "Lower Body", baseSets: 3, reps: 10, risk: { knee: 70 } },
  barbell_squat_side: { group: "Lower Body", baseSets: 3, reps: 8, risk: { knee: 65, lower_back: 25 } },
  deadlift_side: { group: "Posterior Chain", baseSets: 3, reps: 8, risk: { lower_back: 100, knee: 20 } },
  push_up_side: { group: "Upper Body", baseSets: 3, reps: 10, risk: { shoulder: 25, elbow: 45, wrist: 35 } },
  lateral_raise: { group: "Upper Body", baseSets: 3, reps: 12, risk: { shoulder: 70 } },
  bicep_curl: { group: "Arms", baseSets: 3, reps: 12, risk: { elbow: 60, wrist: 25 } },
  right_bicep_curl: { group: "Arms", baseSets: 3, reps: 12, risk: { elbow: 60, wrist: 25 } },
};

const ISSUE_LABELS = {
  valgus: "Inward collapse",
  varus: "Outward bow",
  rounded: "Rounded back",
  hyperextended: "Over-extended",
  insufficient_depth: "Not deep enough",
  excessive_lean: "Leaning too far forward",
  asymmetric: "Left-right asymmetry",
};

const MOCK_DTW = {
  correct: false,
  completeness: 0.74,
  dtw_distance: 2.81,
  dtw_threshold: 2.1,
  problem_joints: [
    { joint: "left_knee", severity: 0.68, issue: "insufficient_depth" },
    { joint: "right_knee", severity: 0.41, issue: "asymmetric" },
  ],
  advice: "Your depth is improving — left knee needs to go lower. Keep your weight balanced across both legs on the way down.",
};

const TRAKKO_LINES = {
  auth: "Identity matrix ready. Your kinematic neural link awaits initialization.",
  dashboard: (name) => `Welcome back, ${name}. Optimal training window detected in your circadian profile.`,
  connect: "Scanning for edge nodes — ensure your sensor array is powered and within 10m.",
  plan: "Analyzing your muscle recovery vectors. Optimal session configuration computed.",
  home_coach: "Home protocol engaged. No equipment required — pure body mechanics.",
  profile: "Reviewing your performance genome. Consistency is the primary variable.",
  settings: "Device topology interface. Configure your neural bridge parameters.",
};

// ─── Utilities ───────────────────────────────────────────────────────────────

function loadProfile() {
  try {
    const raw = localStorage.getItem("ath_profile");
    return raw ? JSON.parse(raw) : { name: "", sessionsCount: 0, averageForm: 0, streakDays: 0 };
  } catch { return { name: "", sessionsCount: 0, averageForm: 0, streakDays: 0 }; }
}

function saveProfile(p) {
  try { localStorage.setItem("ath_profile", JSON.stringify(p)); } catch {}
}

function makeDefaultMuscleStatus() {
  return Object.fromEntries(MUSCLE_GROUPS.map((group) => [group.id, 0]));
}

function loadMuscleStatus() {
  const defaults = makeDefaultMuscleStatus();
  try {
    const raw = localStorage.getItem("ath_muscles");
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return defaults;
}

function saveMuscleStatus(s) {
  try { localStorage.setItem("ath_muscles", JSON.stringify(s)); } catch {}
}

function makeDefaultAiCoreProfile() {
  return {
    heightCm: "",
    weightKg: "",
    trainingDaysPerWeek: 3,
    injuryTags: [],
    focusTags: [],
    updatedAt: 0,
  };
}

function normalizeTags(tags) {
  return Array.isArray(tags) ? [...new Set(tags.filter(Boolean))] : [];
}

function loadAiCoreProfile() {
  const defaults = makeDefaultAiCoreProfile();
  try {
    const raw = localStorage.getItem(AI_CORE_PROFILE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
      injuryTags: normalizeTags(parsed.injuryTags),
      focusTags: normalizeTags(parsed.focusTags),
    };
  } catch {
    return defaults;
  }
}

function saveAiCoreProfile(profile) {
  try { localStorage.setItem(AI_CORE_PROFILE_KEY, JSON.stringify(profile)); } catch {}
}

function loadAiMessages() {
  try {
    const raw = localStorage.getItem(AI_MESSAGES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAiMessages(messages) {
  try { localStorage.setItem(AI_MESSAGES_KEY, JSON.stringify(messages.slice(-60))); } catch {}
}

function loadAiUnread() {
  try { return localStorage.getItem(AI_UNREAD_KEY) === "true"; } catch { return false; }
}

function saveAiUnread(value) {
  try { localStorage.setItem(AI_UNREAD_KEY, value ? "true" : "false"); } catch {}
}

function makeAiMessage({ role = "ai", type = "text", content = "", payload = null }) {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    type,
    timestamp: Date.now(),
    content,
    payload,
  };
}

function inferInjuryTagsFromText(text) {
  const value = String(text || "").toLowerCase();
  const tags = [];
  if (value.includes("腰") || value.includes("lower back") || value.includes("back pain")) tags.push("lower_back");
  if (value.includes("膝") || value.includes("knee")) tags.push("knee");
  if (value.includes("肩") || value.includes("shoulder")) tags.push("shoulder");
  if (value.includes("肘") || value.includes("elbow")) tags.push("elbow");
  if (value.includes("腕") || value.includes("手腕") || value.includes("wrist")) tags.push("wrist");
  return normalizeTags(tags);
}

function isAiCoreProfileReady(profile) {
  return Number(profile?.heightCm) > 0
    && Number(profile?.weightKg) > 0
    && Number(profile?.trainingDaysPerWeek) > 0;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function groupLabelForMuscle(muscleId) {
  return MUSCLE_BY_ID[muscleId]?.group ?? "Training";
}

function generateAiCorePlan({ profile, muscleStatus, focusTags }) {
  const injuries = normalizeTags(profile?.injuryTags);
  const focus = normalizeTags(focusTags?.length ? focusTags : profile?.focusTags);
  const highFatigue = MUSCLE_GROUPS
    .filter((muscle) => (muscleStatus?.[muscle.id] ?? 0) > 0.75)
    .map((muscle) => muscle.id);

  const scored = EXERCISES
    .map((exercise) => {
      const rule = AI_CORE_EXERCISE_RULES[exercise.id] ?? { group: "Training", baseSets: 3, reps: 10, risk: {} };
      const targets = Object.keys(getExerciseTargets(exercise.id));
      const loads = targets.map((muscle) => muscleStatus?.[muscle] ?? 0);
      const avgLoad = loads.length ? loads.reduce((sum, load) => sum + load, 0) / loads.length : 0;
      const maxLoad = loads.length ? Math.max(...loads) : 0;
      const focusHits = targets.filter((muscle) => focus.includes(muscle));
      const injuryPenalty = injuries.reduce((sum, tag) => sum + (rule.risk?.[tag] ?? 0), 0);
      const fatiguePenalty = maxLoad > 0.75 ? 55 : maxLoad > 0.55 ? 20 : 0;
      const focusBonus = focusHits.length ? 34 : 0;
      const score = (1 - avgLoad) * 100 + focusBonus - injuryPenalty - fatiguePenalty;
      const setDrop = maxLoad > 0.65 || injuryPenalty >= 25 ? 1 : 0;
      const reason = injuryPenalty >= 70
        ? "Constrained by injury profile"
        : maxLoad > 0.75
        ? "Reduced by recovery load"
        : focusHits.length
        ? `Focus accessory: ${focusHits.map((id) => MUSCLE_BY_ID[id]?.label ?? id).join(", ")}`
        : avgLoad < 0.35
        ? "Low recent load"
        : "Balanced readiness";
      return {
        exerciseId: exercise.id,
        sets: clamp((rule.baseSets ?? 3) - setDrop, 2, 4),
        targetReps: rule.reps ?? 10,
        group: rule.group,
        score,
        reason,
        focusHits,
        injuryPenalty,
        fatiguePenalty,
      };
    })
    .filter((item) => item.injuryPenalty < 100)
    .sort((a, b) => b.score - a.score);

  const selected = [];
  const seenGroups = new Set();
  for (const item of scored) {
    if (selected.length >= 3) break;
    if (seenGroups.has(item.group) && selected.length < 2) continue;
    selected.push(item);
    seenGroups.add(item.group);
  }
  for (const item of scored) {
    if (selected.length >= 3) break;
    if (!selected.some((chosen) => chosen.exerciseId === item.exerciseId)) selected.push(item);
  }

  const primaryFocus = focus[0];
  const targetGroup = highFatigue.length
    ? "Recovery Bias"
    : primaryFocus
    ? groupLabelForMuscle(primaryFocus)
    : (selected[0]?.group ?? "Training");
  const fatigueNames = highFatigue.map((id) => MUSCLE_BY_ID[id]?.label ?? id);
  const reason = highFatigue.length
    ? `${fatigueNames.join(", ")} above 75% load; plan shifts away from overloaded tissue.`
    : injuries.length
    ? `Injury constraints active: ${injuries.map((id) => AI_CORE_INJURY_OPTIONS.find((item) => item.id === id)?.label ?? id).join(", ")}.`
    : focus.length
    ? `Focus tags prioritized: ${focus.map((id) => MUSCLE_BY_ID[id]?.label ?? id).join(", ")}.`
    : "No elevated fatigue detected; balanced readiness plan selected.";

  return {
    dialogue: reason,
    action_keyword: "DAILY_WORKOUT_INIT",
    payload: {
      target_muscle_group: targetGroup,
      exercises: selected.length ? selected : AI_PLAN,
      intensity_adjustment_reason: reason,
      decisionTags: [
        ...highFatigue.map((id) => ({ type: "fatigue", label: `${MUSCLE_BY_ID[id]?.label ?? id} high load` })),
        ...injuries.map((id) => ({ type: "injury", label: AI_CORE_INJURY_OPTIONS.find((item) => item.id === id)?.label ?? id })),
        ...focus.map((id) => ({ type: "focus", label: MUSCLE_BY_ID[id]?.label ?? id })),
      ],
    },
  };
}

function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function movementProgress(exerciseId, keyAngle) {
  if (!Number.isFinite(keyAngle)) return 0;
  if (exerciseId === "bicep_curl" || exerciseId === "right_bicep_curl") return Math.max(0, Math.min(1, (155 - keyAngle) / 100));
  if (exerciseId === "lateral_raise") return Math.max(0, Math.min(1, (keyAngle - 30) / 55));
  if (exerciseId === "deadlift_side") return Math.max(0, Math.min(1, (165 - keyAngle) / 55));
  if (exerciseId === "push_up_side") return Math.max(0, Math.min(1, (155 - keyAngle) / 70));
  return Math.max(0, Math.min(1, (160 - keyAngle) / 55));
}

const AUTO_CLASSIFIER_IDS = ["squat", "bicep_curl", "right_bicep_curl", "lateral_raise", "squat_side", "barbell_squat_side", "deadlift_side", "push_up_side"];
const AUTO_REP_CONFIRMATIONS_REQUIRED = 2;

function classifierAngle(a, b, c) {
  if (!a || !b || !c) return null;
  const rad = Math.atan2(c.y - b.y, c.x - b.x)
    - Math.atan2(a.y - b.y, a.x - b.x);
  let deg = Math.abs(rad * 180 / Math.PI);
  if (deg > 180) deg = 360 - deg;
  return Number.isFinite(deg) ? Math.round(deg) : null;
}

function avgFinite(...values) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

const AUTO_CLASSIFIER_SPECS = {
  squat: {
    minAmp: 24,
    strongAmp: 62,
    rest: 152,
    work: 124,
    direction: "down",
    features: [
      { id: "left_knee", type: "active", weight: 0.26, minAmp: 20, strongAmp: 56, rest: 150, work: 128, direction: "down", fn: (lm) => classifierAngle(lm[23], lm[25], lm[27]) },
      { id: "right_knee", type: "active", weight: 0.26, minAmp: 20, strongAmp: 56, rest: 150, work: 128, direction: "down", fn: (lm) => classifierAngle(lm[24], lm[26], lm[28]) },
      { id: "left_hip", type: "active", weight: 0.16, minAmp: 18, strongAmp: 50, rest: 150, work: 112, direction: "down", fn: (lm) => classifierAngle(lm[11], lm[23], lm[25]) },
      { id: "right_hip", type: "active", weight: 0.16, minAmp: 18, strongAmp: 50, rest: 150, work: 112, direction: "down", fn: (lm) => classifierAngle(lm[12], lm[24], lm[26]) },
    ],
  },
  bicep_curl: {
    minAmp: 32,
    strongAmp: 92,
    rest: 145,
    work: 70,
    direction: "down",
    features: [
      { id: "left_elbow", type: "active", weight: 0.38, minAmp: 32, strongAmp: 92, rest: 145, work: 70, direction: "down", fn: (lm) => classifierAngle(lm[11], lm[13], lm[15]) },
      { id: "left_shoulder_quiet", type: "quiet", weight: 0.22, maxAmp: 26, fn: (lm) => classifierAngle(lm[23], lm[11], lm[13]) },
      { id: "right_elbow_quiet", type: "quiet", weight: 0.12, maxAmp: 28, minAvg: 120, fn: (lm) => classifierAngle(lm[12], lm[14], lm[16]) },
      { id: "right_shoulder_quiet", type: "quiet", weight: 0.10, maxAmp: 28, fn: (lm) => classifierAngle(lm[24], lm[12], lm[14]) },
      { id: "knees_quiet", type: "quiet", weight: 0.10, maxAmp: 24, fn: (lm) => avgFinite(classifierAngle(lm[23], lm[25], lm[27]), classifierAngle(lm[24], lm[26], lm[28])) },
    ],
  },
  right_bicep_curl: {
    minAmp: 32,
    strongAmp: 92,
    rest: 145,
    work: 70,
    direction: "down",
    features: [
      { id: "right_elbow", type: "active", weight: 0.38, minAmp: 32, strongAmp: 92, rest: 145, work: 70, direction: "down", fn: (lm) => classifierAngle(lm[12], lm[14], lm[16]) },
      { id: "right_shoulder_quiet", type: "quiet", weight: 0.22, maxAmp: 26, fn: (lm) => classifierAngle(lm[24], lm[12], lm[14]) },
      { id: "left_elbow_quiet", type: "quiet", weight: 0.12, maxAmp: 28, minAvg: 120, fn: (lm) => classifierAngle(lm[11], lm[13], lm[15]) },
      { id: "left_shoulder_quiet", type: "quiet", weight: 0.10, maxAmp: 28, fn: (lm) => classifierAngle(lm[23], lm[11], lm[13]) },
      { id: "knees_quiet", type: "quiet", weight: 0.10, maxAmp: 24, fn: (lm) => avgFinite(classifierAngle(lm[23], lm[25], lm[27]), classifierAngle(lm[24], lm[26], lm[28])) },
    ],
  },
  lateral_raise: {
    minAmp: 24,
    strongAmp: 62,
    rest: 34,
    work: 64,
    direction: "up",
    features: [
      { id: "left_shoulder", type: "active", weight: 0.30, minAmp: 18, strongAmp: 58, rest: 36, work: 64, direction: "up", fn: (lm) => classifierAngle(lm[23], lm[11], lm[13]) },
      { id: "right_shoulder", type: "active", weight: 0.30, minAmp: 18, strongAmp: 58, rest: 36, work: 64, direction: "up", fn: (lm) => classifierAngle(lm[24], lm[12], lm[14]) },
      { id: "right_elbow_quiet", type: "quiet", weight: 0.14, maxAmp: 44, minAvg: 105, fn: (lm) => classifierAngle(lm[12], lm[14], lm[16]) },
      { id: "left_elbow_quiet", type: "quiet", weight: 0.10, maxAmp: 44, minAvg: 105, fn: (lm) => classifierAngle(lm[11], lm[13], lm[15]) },
      { id: "knees_quiet", type: "quiet", weight: 0.08, maxAmp: 28, fn: (lm) => avgFinite(classifierAngle(lm[23], lm[25], lm[27]), classifierAngle(lm[24], lm[26], lm[28])) },
    ],
  },
  squat_side: {
    minAmp: 24,
    strongAmp: 62,
    rest: 152,
    work: 120,
    direction: "down",
    features: [
      { id: "visible_knee", type: "active", weight: 0.36, minAmp: 22, strongAmp: 58, rest: 150, work: 124, direction: "down", fn: (lm) => avgFinite(classifierAngle(lm[23], lm[25], lm[27]), classifierAngle(lm[24], lm[26], lm[28])) },
      { id: "visible_hip", type: "active", weight: 0.30, minAmp: 18, strongAmp: 52, rest: 150, work: 118, direction: "down", fn: (lm) => avgFinite(classifierAngle(lm[11], lm[23], lm[25]), classifierAngle(lm[12], lm[24], lm[26])) },
      { id: "arms_quiet", type: "quiet", weight: 0.12, maxAmp: 30, fn: (lm) => avgFinite(classifierAngle(lm[11], lm[13], lm[15]), classifierAngle(lm[12], lm[14], lm[16])) },
    ],
  },
  barbell_squat_side: {
    minAmp: 24,
    strongAmp: 62,
    rest: 152,
    work: 120,
    direction: "down",
    features: [
      { id: "visible_knee", type: "active", weight: 0.34, minAmp: 22, strongAmp: 58, rest: 150, work: 124, direction: "down", fn: (lm) => avgFinite(classifierAngle(lm[23], lm[25], lm[27]), classifierAngle(lm[24], lm[26], lm[28])) },
      { id: "visible_hip", type: "active", weight: 0.30, minAmp: 18, strongAmp: 52, rest: 150, work: 118, direction: "down", fn: (lm) => avgFinite(classifierAngle(lm[11], lm[23], lm[25]), classifierAngle(lm[12], lm[24], lm[26])) },
      { id: "arms_quiet", type: "quiet", weight: 0.10, maxAmp: 34, fn: (lm) => avgFinite(classifierAngle(lm[11], lm[13], lm[15]), classifierAngle(lm[12], lm[14], lm[16])) },
    ],
  },
  deadlift_side: {
    minAmp: 28,
    strongAmp: 70,
    rest: 158,
    work: 118,
    direction: "down",
    features: [
      { id: "hip_hinge", type: "active", weight: 0.42, minAmp: 28, strongAmp: 70, rest: 158, work: 118, direction: "down", fn: (lm) => avgFinite(classifierAngle(lm[11], lm[23], lm[25]), classifierAngle(lm[12], lm[24], lm[26])) },
      { id: "knee_quiet", type: "quiet", weight: 0.24, maxAmp: 34, minAvg: 116, fn: (lm) => avgFinite(classifierAngle(lm[23], lm[25], lm[27]), classifierAngle(lm[24], lm[26], lm[28])) },
      { id: "shoulders_quiet", type: "quiet", weight: 0.10, maxAmp: 30, fn: (lm) => avgFinite(classifierAngle(lm[23], lm[11], lm[13]), classifierAngle(lm[24], lm[12], lm[14])) },
    ],
  },
  push_up_side: {
    minAmp: 30,
    strongAmp: 82,
    rest: 148,
    work: 96,
    direction: "down",
    features: [
      { id: "visible_elbow", type: "active", weight: 0.38, minAmp: 30, strongAmp: 82, rest: 148, work: 96, direction: "down", fn: (lm) => avgFinite(classifierAngle(lm[11], lm[13], lm[15]), classifierAngle(lm[12], lm[14], lm[16])) },
      { id: "plank_quiet", type: "quiet", weight: 0.20, maxAmp: 24, minAvg: 142, fn: (lm) => avgFinite(classifierAngle(lm[11], lm[23], lm[25]), classifierAngle(lm[12], lm[24], lm[26])) },
      { id: "knees_quiet", type: "quiet", weight: 0.10, maxAmp: 22, minAvg: 140, fn: (lm) => avgFinite(classifierAngle(lm[23], lm[25], lm[27]), classifierAngle(lm[24], lm[26], lm[28])) },
    ],
  },
};

function makeAutoClassifierState() {
  return {
    samples: [],
    candidateId: null,
    candidateFrames: 0,
    activeId: null,
    activeConfidence: 0,
    unknownFrames: 0,
    switches: 0,
    totalFrames: 0,
    classifiedFrames: 0,
    unknownFramesTotal: 0,
  };
}

function countAngleTurns(values) {
  let prevSign = 0;
  let turns = 0;
  for (let i = 1; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    if (Math.abs(delta) < 4) continue;
    const sign = Math.sign(delta);
    if (prevSign && sign !== prevSign) turns += 1;
    prevSign = sign;
  }
  return turns;
}

function scoreAnglePattern(values, spec, maxAmp = 1) {
  if (!spec || values.length < 10) return { score: 0, amp: 0, matched: false };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const amp = max - min;
  const ampScore = Math.max(0, Math.min(1, (amp - spec.minAmp) / (spec.strongAmp - spec.minAmp)));
  const sawRest = spec.direction === "down" ? max >= spec.rest : min <= spec.rest;
  const sawWork = spec.direction === "down" ? min <= spec.work : max >= spec.work;
  const rangeScore = (sawRest ? 0.5 : 0) + (sawWork ? 0.5 : 0);
  const rhythmScore = Math.max(0, Math.min(1, countAngleTurns(values) / 2));
  const dominanceScore = maxAmp > 0 ? Math.max(0, Math.min(1, (amp - maxAmp * 0.45) / Math.max(1, maxAmp * 0.55))) : 0;
  const score = ampScore * 0.48 + rangeScore * 0.28 + rhythmScore * 0.12 + dominanceScore * 0.12;
  return { score, amp, matched: score >= 0.58 };
}

function scoreQuietFeature(values, feature) {
  if (!feature || values.length < 10) return { score: 0, amp: 0, matched: false };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const amp = max - min;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const maxAmp = feature.maxAmp ?? 30;
  const quietScore = Math.max(0, Math.min(1, 1 - Math.max(0, amp - maxAmp) / Math.max(1, maxAmp)));
  const postureScore = feature.minAvg == null ? 1 : Math.max(0, Math.min(1, (avg - feature.minAvg) / 28));
  const score = quietScore * 0.72 + postureScore * 0.28;
  return { score, amp, matched: score >= 0.58 };
}

function scoreAutoExercise(id, values, maxAmp, featureValues = {}) {
  const spec = AUTO_CLASSIFIER_SPECS[id];
  if (!spec || values.length < 10) return { score: 0, confidence: 0, amp: 0, jointMatches: 0 };
  const primary = scoreAnglePattern(values, spec, maxAmp);
  let featureWeightTotal = 0;
  let featureScoreTotal = 0;
  let jointMatches = primary.matched ? 1 : 0;

  for (const feature of spec.features ?? []) {
    const fValues = featureValues[feature.id] ?? [];
    const result = feature.type === "quiet"
      ? scoreQuietFeature(fValues, feature)
      : scoreAnglePattern(fValues, feature, maxAmp);
    const weight = feature.weight ?? 0.1;
    featureWeightTotal += weight;
    featureScoreTotal += result.score * weight;
    if (result.matched) jointMatches += 1;
  }

  const featureScore = featureWeightTotal ? featureScoreTotal / featureWeightTotal : 0;
  const multiJointScore = Math.max(0, Math.min(1, jointMatches / Math.max(2, (spec.features?.length ?? 0) + 1)));
  const score = primary.score * 0.50 + featureScore * 0.38 + multiJointScore * 0.12;
  return {
    score,
    confidence: Math.round(score * 100),
    amp: primary.amp,
    jointMatches,
  };
}

function classifyMotionWindow(classifier, rawLm, exMap, now) {
  const angles = {};
  const features = {};
  for (const id of AUTO_CLASSIFIER_IDS) {
    const rules = exMap?.[id];
    if (!rules) continue;
    const angle = rules.getKeyAngle(rawLm);
    if (Number.isFinite(angle)) angles[id] = angle;
    const spec = AUTO_CLASSIFIER_SPECS[id];
    features[id] = {};
    for (const feature of spec?.features ?? []) {
      const value = feature.fn?.(rawLm);
      if (Number.isFinite(value)) features[id][feature.id] = value;
    }
  }

  classifier.samples.push({ t: now, angles, features });
  classifier.samples = classifier.samples.filter((sample) => now - sample.t <= 2800);
  classifier.totalFrames += 1;

  const valuesById = Object.fromEntries(AUTO_CLASSIFIER_IDS.map((id) => [
    id,
    classifier.samples.map((sample) => sample.angles[id]).filter(Number.isFinite),
  ]));
  const maxAmp = Math.max(1, ...AUTO_CLASSIFIER_IDS.map((id) => {
    const values = valuesById[id];
    return values.length ? Math.max(...values) - Math.min(...values) : 0;
  }));
  const featureValuesById = Object.fromEntries(AUTO_CLASSIFIER_IDS.map((id) => [
    id,
    Object.fromEntries((AUTO_CLASSIFIER_SPECS[id]?.features ?? []).map((feature) => [
      feature.id,
      classifier.samples
        .map((sample) => sample.features?.[id]?.[feature.id])
        .filter(Number.isFinite),
    ])),
  ]));

  const ranked = AUTO_CLASSIFIER_IDS
    .map((id) => ({ id, ...scoreAutoExercise(id, valuesById[id], maxAmp, featureValuesById[id]) }))
    .sort((a, b) => b.score - a.score);
  const top = ranked[0] ?? { id: null, score: 0, confidence: 0 };
  const runnerUp = ranked[1] ?? { score: 0 };

  if (!top.id || top.score < 0.58 || top.jointMatches < 2 || top.score - runnerUp.score < 0.06) {
    classifier.unknownFrames += 1;
    classifier.unknownFramesTotal += 1;
    if (classifier.unknownFrames >= 18) {
      classifier.activeId = null;
      classifier.activeConfidence = 0;
    }
    return { id: classifier.activeId, confidence: classifier.activeConfidence, status: classifier.activeId ? "hold" : "unassigned" };
  }

  classifier.unknownFrames = 0;
  if (classifier.candidateId === top.id) classifier.candidateFrames += 1;
  else {
    classifier.candidateId = top.id;
    classifier.candidateFrames = 1;
  }

  if (classifier.candidateFrames >= 5 && classifier.activeId !== top.id) {
    if (classifier.activeId) classifier.switches += 1;
    classifier.activeId = top.id;
  }
  classifier.activeConfidence = top.confidence;
  if (classifier.activeId) classifier.classifiedFrames += 1;
  return { id: classifier.activeId, confidence: classifier.activeConfidence, status: classifier.activeId ? "matched" : "scanning" };
}

// ─── IoT Constants ───────────────────────────────────────────────────────────

const BLE_SERVICE_UUID = "9b8f0001-6f4d-4d4f-9c9a-4b4c49464501";
const BLE_TX_UUID      = "9b8f0002-6f4d-4d4f-9c9a-4b4c49464501";
const BLE_RX_UUID      = "9b8f0003-6f4d-4d4f-9c9a-4b4c49464501";

// ─── Device History ───────────────────────────────────────────────────────────

function loadLastDevice() {
  try {
    const raw = localStorage.getItem("ath_last_device");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveLastDevice(info) {
  try { localStorage.setItem("ath_last_device", JSON.stringify({ ...info, connectedAt: Date.now() })); } catch {}
}

function exerciseById(id) {
  return EXERCISES.find((exercise) => exercise.id === id) ?? EXERCISES[0];
}

function getExerciseTargets(exerciseId) {
  return MUSCLE_INTENSITY_BY_EXERCISE[exerciseId] ?? {};
}

function defaultBodyViewForMuscles(muscles = []) {
  const ids = Array.isArray(muscles) ? muscles : Object.keys(muscles);
  const backCount = ids.filter((id) => MUSCLE_BY_ID[id]?.view === "back").length;
  return backCount > ids.length / 2 ? "back" : "front";
}

function muscleHeatColor(load, target = 0, selected = false, theme = "deep_space") {
  const m = (THEME_COLORS[theme] ?? THEME_COLORS.deep_space).muscle;
  if (selected) return m.sel;
  if (target >= 0.8) return m.hi;
  if (target > 0) return m.mid;
  if (load >= 0.68) return m.load;
  if (load >= 0.3) return m.dim;
  return m.off;
}

// ─── Theme Color Tokens ───────────────────────────────────────────────────────
const THEME_COLORS = {
  deep_space: {
    particle: { live_good: [0,255,157], connected: [0,255,157], live_warning: [255,60,50], signal_lost: [80,90,115], analysis: [255,184,0], idle: [0,219,233] },
    sphere: { near: [0,255,157], far: [0,219,233] },
    skeleton: { bg: "#030508", bgCombo: "rgba(10,12,16,0.30)" },
    chart: { ref: "#FFB800", user: "#00FF9D", glow: "#00FF9D", grid: "rgba(255,255,255,0.05)" },
    muscle: { sel: "#00FF9D", hi: "#00DBE9", mid: "#49F2C2", load: "#FFB800", dim: "#00DBE9", off: "rgba(255,255,255,0.2)" },
    renderer: { ok_a: "#00DBE9", ok_b: "#00FF9D", white: "rgba(245,252,255,0.96)", dim: "rgba(255,255,255,0.28)", warn: "#FFB800", err: "#FF3366", labelBg: "rgba(3,5,8,0.58)", warningTxt: "#030508", blendMode: "lighter" },
  },
  sunset: {
    particle: { live_good: [232,40,94], connected: [232,40,94], live_warning: [180,0,30], signal_lost: [180,140,120], analysis: [232,82,10], idle: [255,95,31] },
    sphere: { near: [232,40,94], far: [255,95,31] },
    skeleton: { bg: "#06060E", bgCombo: "rgba(6,6,18,0.30)" },
    chart: { ref: "#E06200", user: "#E8285E", glow: "#FF5F1F", grid: "rgba(0,0,0,0.06)" },
    muscle: { sel: "#E8285E", hi: "#FF5F1F", mid: "#FFA07A", load: "#E06200", dim: "#FF5F1F", off: "rgba(40,14,6,0.15)" },
    renderer: { ok_a: "#1C2AD2", ok_b: "#5D6EF0", white: "rgba(200,210,255,0.96)", dim: "rgba(100,120,220,0.32)", warn: "#FF9500", err: "#E8285E", labelBg: "rgba(6,6,24,0.62)", warningTxt: "rgba(220,230,255,0.92)", blendMode: "lighter" },
  },
};

// ─── Design Tokens CSS ───────────────────────────────────────────────────────

const css = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@200;300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --base: #030508;
  --em-a: #00DBE9;
  --em-b: #00FF9D;
  --am-a: #FFB800;
  --am-b: #FF8A00;
  --cy: #007AFF;
  --rd-a: #FF453A;
  --rd-b: #FF2D55;
  --glass-bg: rgba(15,16,20,0.52);
  --glass-blur: 24px;
  --gb: rgba(255,255,255,0.07);
  --gb-hi: rgba(255,255,255,0.16);
  --text: rgba(240,245,255,0.92);
  --text-m: rgba(180,195,220,0.55);
  --text-d: rgba(140,160,190,0.38);
  --font: 'Sora', ui-rounded, system-ui, sans-serif;
  --mono: 'Space Mono', 'SF Mono', 'Courier New', monospace;
  --max-w: 430px;
  --spring-heavy: cubic-bezier(0.2, 0, 0, 1);
  --spring-micro: cubic-bezier(0.34, 1.56, 0.64, 1);
  /* RGB channels for rgba() usage — override these in theme blocks */
  --em-a-rgb: 0,219,233;
  --em-b-rgb: 0,255,157;
  --am-a-rgb: 255,184,0;
  --cy-rgb: 0,122,255;
  --accent-txt: #030508;
}

/* ── Sunset Theme ── */
[data-theme="sunset"] {
  --base: #FFF7F0;
  --em-a: #FF5F1F;
  --em-b: #E8285E;
  --am-a: #FF9500;
  --am-b: #E06200;
  --cy: #9B59B6;
  --rd-a: #C0000A;
  --rd-b: #A00020;
  --glass-bg: rgba(255,232,208,0.50);
  --gb: rgba(160,64,16,0.10);
  --gb-hi: rgba(160,64,16,0.22);
  --text: rgba(32,14,6,0.88);
  --text-m: rgba(100,48,18,0.58);
  --text-d: rgba(80,38,14,0.42);
  --em-a-rgb: 255,95,31;
  --em-b-rgb: 232,40,94;
  --am-a-rgb: 255,149,0;
  --cy-rgb: 155,89,182;
  --accent-txt: rgba(255,247,240,0.95);
  --nav-bg: rgba(255,240,225,0.88);
  /* dusk-blue — deep indigo for the "cool sky" counterpart to the warm sunset */
  --su-blue-rgb: 28,42,210;
}

[data-theme="sunset"] .body-silhouette {
  fill: rgba(32,14,6,0.04);
  stroke: rgba(32,14,6,0.14);
}

[data-theme="sunset"] .muscle-shape {
  stroke: rgba(255,247,240,0.55);
}

/* ── Sunset: Live Screen overrides (fix hardcoded dark backgrounds) ── */
[data-theme="sunset"] .cam-area {
  background: #0a0608;   /* keep dark so camera feed / skeleton canvas reads clearly */
}
[data-theme="sunset"] .rep-hud {
  background: rgba(255,246,238,0.92);
  border-top-color: rgba(160,70,15,0.10);
  border-bottom-color: rgba(160,70,15,0.08);
}
[data-theme="sunset"] .rep-hud::before {
  background:
    radial-gradient(circle at 16% 28%, rgba(255,95,31,0.14), transparent 38%),
    radial-gradient(circle at 88% 50%, rgba(232,40,94,0.09), transparent 34%);
}
[data-theme="sunset"] .rep-hud.near::before {
  background:
    radial-gradient(circle at 20% 32%, rgba(255,149,0,0.14), transparent 38%),
    radial-gradient(circle at 88% 50%, rgba(232,40,94,0.09), transparent 34%);
}
[data-theme="sunset"] .rep-progress-track {
  background: rgba(155,65,12,0.07);
  border-color: rgba(155,65,12,0.14);
  box-shadow: inset 0 0 8px rgba(155,65,12,0.06);
}
[data-theme="sunset"] .session-bar {
  background: rgba(255,246,238,0.90);
  border-top-color: rgba(160,70,15,0.10);
}
[data-theme="sunset"] .live-badge {
  background: rgba(255,250,244,0.90);
  border-color: rgba(255,95,31,0.38);
  color: var(--em-a);
}
[data-theme="sunset"] .live-dot {
  background: var(--em-a);
  box-shadow: 0 0 6px 2px rgba(255,95,31,0.55);
  animation: live-breathe-sunset 2.4s ease-in-out infinite;
}
@keyframes live-breathe-sunset {
  0%, 100% { opacity: 1; box-shadow: 0 0 7px 3px rgba(255,95,31,0.60); }
  50%       { opacity: 0.3; box-shadow: 0 0 2px 0px rgba(255,95,31,0.15); }
}
[data-theme="sunset"] .dtw-badge {
  background: rgba(255,248,240,0.84);
  border-color: rgba(155,65,12,0.14);
}
[data-theme="sunset"] .classify-badge {
  background: rgba(255,248,240,0.86);
  border-color: rgba(255,95,31,0.24);
  color: rgba(32,14,6,0.82);
}
[data-theme="sunset"] .classify-badge.unassigned {
  border-color: rgba(255,149,0,0.38);
  color: var(--am-b);
}

html, body { background: var(--base); overflow: hidden; height: 100svh; }

body {
  font-family: var(--font);
  color: var(--text);
  height: 100svh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ── World Layer ── */
.ath-root {
  height: 100svh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  background: var(--base);
}

.ath-nebula {
  position: fixed; inset: 0;
  z-index: 0; pointer-events: none;
  transition: opacity 1.2s ease, filter 1.2s ease;
}

.ath-nebula-idle {
  background:
    radial-gradient(ellipse 70% 50% at 50% 40%, rgba(var(--em-a-rgb),0.09) 0%, transparent 65%),
    radial-gradient(ellipse 50% 40% at 20% 80%, rgba(var(--em-b-rgb),0.06) 0%, transparent 60%),
    radial-gradient(ellipse 40% 30% at 80% 15%, rgba(var(--cy-rgb),0.05) 0%, transparent 55%);
}

.ath-nebula-connected {
  background:
    radial-gradient(ellipse 80% 60% at 50% 45%, rgba(var(--em-b-rgb),0.18) 0%, transparent 65%),
    radial-gradient(ellipse 60% 50% at 25% 70%, rgba(var(--em-a-rgb),0.12) 0%, transparent 60%);
}

.ath-nebula-live_good {
  background:
    radial-gradient(ellipse 110% 70% at 50% 50%, rgba(var(--em-b-rgb),0.22) 0%, transparent 65%),
    radial-gradient(ellipse 80% 80% at 15% 30%, rgba(var(--em-a-rgb),0.16) 0%, transparent 60%),
    radial-gradient(ellipse 60% 60% at 85% 70%, rgba(var(--em-a-rgb),0.1) 0%, transparent 55%);
  animation: aurora-pulse 3s ease-in-out infinite;
}

.ath-nebula-live_warning {
  background:
    radial-gradient(ellipse 100% 70% at 50% 50%, rgba(255,45,85,0.28) 0%, transparent 65%),
    radial-gradient(ellipse 80% 60% at 80% 20%, rgba(255,59,48,0.18) 0%, transparent 60%),
    radial-gradient(ellipse 60% 60% at 20% 80%, rgba(255,69,58,0.14) 0%, transparent 55%);
  animation: turbulence-pulse 0.5s ease-in-out infinite;
}

.ath-nebula-signal_lost {
  background:
    radial-gradient(ellipse 70% 50% at 50% 40%, rgba(80,90,110,0.15) 0%, transparent 65%),
    radial-gradient(ellipse 50% 40% at 30% 70%, rgba(60,70,90,0.10) 0%, transparent 60%);
  filter: saturate(0.3);
}

.ath-nebula-analysis {
  background:
    radial-gradient(ellipse 70% 50% at 50% 40%, rgba(255,184,0,0.12) 0%, transparent 65%),
    radial-gradient(ellipse 50% 40% at 80% 70%, rgba(var(--em-a-rgb),0.08) 0%, transparent 60%);
}

.ath-nebula-auth {
  background:
    radial-gradient(ellipse 60% 50% at 50% 45%, rgba(var(--em-a-rgb),0.14) 0%, transparent 60%);
  animation: nebula-breathe 4s ease-in-out infinite;
}

@keyframes nebula-breathe {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.08); }
}

/* ── Deep Space Breathing Nebula Clouds (emerald + rose, non-live background) ── */
.ds-blob-wrap {
  display: none;
  position: absolute;
  top: 50%; left: 50%;
  width: 0; height: 0;
  pointer-events: none;
}
[data-theme="deep_space"] .ds-blob-wrap { display: block; }

.ds-blob-wrap-1 { animation: ds-orbit-1 78s linear infinite; }
.ds-blob-wrap-2 { animation: ds-orbit-2 55s linear infinite; }
.ds-blob-wrap-3 { animation: ds-orbit-3 65s linear infinite; }
.ds-blob-wrap-4 { animation: ds-orbit-4 92s linear infinite; }

.ds-blob {
  position: absolute;
  border-radius: 50%;
  will-change: transform, filter;
}
.ds-blob-1 {
  width: 46vmin; height: 46vmin;
  top: -23vmin; left: -23vmin;
  background: radial-gradient(circle, rgba(0,219,233,0.26) 0%, rgba(0,219,233,0.07) 55%, transparent 80%);
  animation: ds-breathe-1 32s ease-in-out infinite;
  animation-delay: -6s;
}
.ds-blob-2 {
  width: 38vmin; height: 38vmin;
  top: -19vmin; left: -19vmin;
  background: radial-gradient(circle, rgba(0,255,157,0.22) 0%, rgba(0,255,157,0.06) 55%, transparent 80%);
  animation: ds-breathe-2 44s ease-in-out infinite;
  animation-delay: -18s;
}
.ds-blob-3 {
  width: 42vmin; height: 42vmin;
  top: -21vmin; left: -21vmin;
  background: radial-gradient(circle, rgba(255,45,85,0.20) 0%, rgba(255,45,85,0.05) 55%, transparent 80%);
  animation: ds-breathe-3 26s ease-in-out infinite;
  animation-delay: -11s;
}
.ds-blob-4 {
  width: 50vmin; height: 50vmin;
  top: -25vmin; left: -25vmin;
  background: radial-gradient(circle, rgba(0,219,233,0.16) 0%, rgba(0,219,233,0.04) 55%, transparent 80%);
  animation: ds-breathe-4 58s ease-in-out infinite;
  animation-delay: -28s;
}

@keyframes ds-orbit-1 {
  from { transform: rotate(45deg)  translateX(36vmin); }
  to   { transform: rotate(405deg) translateX(36vmin); }
}
@keyframes ds-orbit-2 {
  from { transform: rotate(200deg) translateX(28vmin); }
  to   { transform: rotate(560deg) translateX(28vmin); }
}
@keyframes ds-orbit-3 {
  from { transform: rotate(300deg) translateX(40vmin); }
  to   { transform: rotate(660deg) translateX(40vmin); }
}
@keyframes ds-orbit-4 {
  from { transform: rotate(130deg) translateX(44vmin); }
  to   { transform: rotate(490deg) translateX(44vmin); }
}

@keyframes ds-breathe-1 {
  0%, 22%   { transform: scale(1);   filter: blur(22px) brightness(1);    }
  50%, 60%  { transform: scale(2);   filter: blur(22px) brightness(1.55); }
  82%, 100% { transform: scale(1);   filter: blur(22px) brightness(1);    }
}
@keyframes ds-breathe-2 {
  0%, 35%   { transform: scale(1);   filter: blur(18px) brightness(1);    }
  62%, 72%  { transform: scale(1.9); filter: blur(18px) brightness(1.45); }
  90%, 100% { transform: scale(1);   filter: blur(18px) brightness(1);    }
}
@keyframes ds-breathe-3 {
  0%, 14%   { transform: scale(1);   filter: blur(20px) brightness(1);    }
  42%, 55%  { transform: scale(2.2); filter: blur(20px) brightness(1.6);  }
  76%, 100% { transform: scale(1);   filter: blur(20px) brightness(1);    }
}
@keyframes ds-breathe-4 {
  0%, 45%   { transform: scale(1);   filter: blur(26px) brightness(1);    }
  68%, 76%  { transform: scale(1.7); filter: blur(26px) brightness(1.38); }
  92%, 100% { transform: scale(1);   filter: blur(26px) brightness(1);    }
}

/* ── Sunset Blob Orbit + Breathe System ──
   Two-layer: wrapper = orbit transform, blob = scale+brightness transform.
   Keeps both animations independent (single element can't run two transforms). ── */
.su-blob-wrap {
  display: none;
  position: absolute;
  top: 50%; left: 50%;
  width: 0; height: 0;
  pointer-events: none;
}
[data-theme="sunset"] .su-blob-wrap { display: block; }

.su-blob-wrap-1 { animation: su-orbit-1 52s linear infinite; }
.su-blob-wrap-2 { animation: su-orbit-2 43s linear infinite; }
.su-blob-wrap-3 { animation: su-orbit-3 67s linear infinite; }
.su-blob-wrap-4 { animation: su-orbit-4 38s linear infinite; }

.su-blob {
  position: absolute;
  border-radius: 50%;
  will-change: transform, filter;
}
.su-blob-1 {
  width: 78vmin; height: 78vmin;
  top: -39vmin; left: -39vmin;
  background: radial-gradient(circle, rgba(var(--su-blue-rgb),0.78) 0%, rgba(var(--su-blue-rgb),0.26) 52%, transparent 78%);
  animation: su-breathe-1 28s ease-in-out infinite;
  animation-delay: -4s;
}
.su-blob-2 {
  width: 70vmin; height: 70vmin;
  top: -35vmin; left: -35vmin;
  background: radial-gradient(circle, rgba(255,88,22,0.38) 0%, rgba(255,88,22,0.10) 52%, transparent 78%);
  animation: su-breathe-2 35s ease-in-out infinite;
  animation-delay: -14s;
}
.su-blob-3 {
  width: 56vmin; height: 56vmin;
  top: -28vmin; left: -28vmin;
  background: radial-gradient(circle, rgba(255,155,65,0.28) 0%, rgba(255,155,65,0.07) 52%, transparent 78%);
  animation: su-breathe-3 22s ease-in-out infinite;
  animation-delay: -8s;
}
.su-blob-4 {
  width: 64vmin; height: 64vmin;
  top: -32vmin; left: -32vmin;
  background: radial-gradient(circle, rgba(225,35,90,0.72) 0%, rgba(225,35,90,0.20) 52%, transparent 78%);
  animation: su-breathe-4 42s ease-in-out infinite;
  animation-delay: -22s;
}

/* Orbit keyframes — on wrappers */
@keyframes su-orbit-1 {
  from { transform: rotate(0deg)   translateX(46vmin); }
  to   { transform: rotate(360deg) translateX(46vmin); }
}
@keyframes su-orbit-2 {
  from { transform: rotate(90deg)  translateX(34vmin); }
  to   { transform: rotate(450deg) translateX(34vmin); }
}
@keyframes su-orbit-3 {
  from { transform: rotate(180deg) translateX(24vmin); }
  to   { transform: rotate(540deg) translateX(24vmin); }
}
@keyframes su-orbit-4 {
  from { transform: rotate(270deg) translateX(42vmin); }
  to   { transform: rotate(630deg) translateX(42vmin); }
}

/* Breathe keyframes — on blobs. Asymmetric pause positions give random feel. */
@keyframes su-breathe-1 {
  0%, 20%   { transform: scale(1);   filter: blur(34px) brightness(1);   }
  50%, 62%  { transform: scale(2.5); filter: blur(34px) brightness(1.6); }
  82%, 100% { transform: scale(1);   filter: blur(34px) brightness(1);   }
}
@keyframes su-breathe-2 {
  0%, 30%   { transform: scale(1);   filter: blur(28px) brightness(1);    }
  58%, 68%  { transform: scale(2.8); filter: blur(28px) brightness(1.25); }
  88%, 100% { transform: scale(1);   filter: blur(28px) brightness(1);    }
}
@keyframes su-breathe-3 {
  0%, 10%   { transform: scale(1);   filter: blur(22px) brightness(1);    }
  38%, 54%  { transform: scale(3);   filter: blur(22px) brightness(1.25); }
  78%, 100% { transform: scale(1);   filter: blur(22px) brightness(1);    }
}
@keyframes su-breathe-4 {
  0%, 42%   { transform: scale(1);   filter: blur(27px) brightness(1);   }
  65%, 74%  { transform: scale(2.2); filter: blur(27px) brightness(1.45); }
  92%, 100% { transform: scale(1);   filter: blur(27px) brightness(1);   }
}

/* Sunset static base backgrounds (blobs provide the dynamic color on top) */
[data-theme="sunset"] .ath-nebula-idle {
  background: radial-gradient(ellipse 80% 80% at 50% 50%, rgba(18,8,4,0.55) 0%, transparent 80%);
}
[data-theme="sunset"] .ath-nebula-connected {
  background: radial-gradient(ellipse 80% 80% at 50% 50%, rgba(12,6,18,0.50) 0%, transparent 80%);
}
[data-theme="sunset"] .ath-nebula-live_good {
  background: radial-gradient(ellipse 80% 80% at 50% 50%, rgba(8,14,6,0.48) 0%, transparent 80%);
  animation: aurora-pulse 3s ease-in-out infinite;
}
[data-theme="sunset"] .ath-nebula-live_warning {
  background:
    radial-gradient(ellipse 100% 70% at 50% 50%, rgba(160,0,22,0.40) 0%, transparent 65%),
    radial-gradient(ellipse 70% 55% at 80% 18%, rgba(185,15,40,0.28) 0%, transparent 58%);
  animation: turbulence-pulse 0.5s ease-in-out infinite;
}
[data-theme="sunset"] .ath-nebula-signal_lost {
  background: radial-gradient(ellipse 80% 70% at 50% 50%, rgba(30,28,36,0.55) 0%, transparent 75%);
  filter: saturate(0.35) brightness(0.95);
}
[data-theme="sunset"] .ath-nebula-analysis {
  background: radial-gradient(ellipse 80% 80% at 50% 50%, rgba(14,8,2,0.52) 0%, transparent 80%);
}
[data-theme="sunset"] .ath-nebula-auth {
  background: radial-gradient(ellipse 80% 80% at 50% 50%, rgba(10,6,20,0.50) 0%, transparent 80%);
  animation: nebula-breathe 4s ease-in-out infinite;
}

@keyframes aurora-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.75; }
}

@keyframes turbulence-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.ath-world-canvas {
  position: fixed; inset: 0;
  z-index: 0; pointer-events: none;
  width: 100%; height: 100%;
}
[data-theme="sunset"] .ath-world-canvas { display: none; }

/* sunset: chat bubbles use dark glass → force light text */
[data-theme="sunset"] .core-bubble {
  background: rgba(14,7,3,0.62);
  border-color: rgba(220,140,60,0.2);
}
[data-theme="sunset"] .core-msg-text { color: rgba(250,240,228,0.9); }
[data-theme="sunset"] .core-msg-meta { color: rgba(220,190,155,0.62); }
[data-theme="sunset"] .core-message.user .core-bubble {
  border-color: rgba(255,184,0,0.3);
  background: rgba(180,80,10,0.12);
}
[data-theme="sunset"] .core-message.user .core-msg-text { color: rgba(255,230,180,0.92); }
[data-theme="sunset"] .core-plan-name { color: rgba(250,240,228,0.92); }
[data-theme="sunset"] .core-input-shell {
  background: rgba(18,8,3,0.72);
  border-color: rgba(220,140,60,0.22);
}
[data-theme="sunset"] .core-quick {
  color: rgba(250,230,200,0.88);
  border-color: rgba(220,140,60,0.3);
  background: rgba(180,80,10,0.1);
}
[data-theme="sunset"] .core-input {
  color: rgba(250,240,228,0.9);
  border-color: rgba(220,140,60,0.2);
  background: rgba(255,255,255,0.05);
}
[data-theme="sunset"] .core-input::placeholder { color: rgba(220,190,155,0.45); }

/* ── Screen Layer ── */
.ath-screen-layer {
  position: relative; z-index: 2;
  flex: 1; min-height: 0; display: flex; flex-direction: column;
  will-change: transform, opacity, filter;
}

.screen-pad {
  flex: 1; display: flex; flex-direction: column;
  padding: 0 1.25rem;
  max-width: var(--max-w);
  margin: 0 auto;
  width: 100%;
  min-height: 0;
}

/* ── Glass Panels ── */
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(160%);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(160%);
  border: 1px solid var(--gb);
  border-radius: 16px;
  position: relative;
  overflow: hidden;
}

.glass::before {
  content: '';
  position: absolute; inset: 0;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%);
  pointer-events: none;
}

.glass-hi {
  border-color: var(--gb-hi);
}

/* ── Typography ── */
.sys-label {
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--text-d);
}

.sys-label-em {
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  background: linear-gradient(90deg, var(--em-a), var(--em-b));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.data-value {
  font-family: var(--mono);
  font-size: 0.85rem;
  color: var(--em-b);
}

h1.ath-headline {
  font-size: clamp(2.8rem, 9vw, 4.2rem);
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  line-height: 0.92;
  color: var(--text);
}

h2.ath-title {
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text);
}

/* ── Buttons ── */
.btn-init {
  width: 100%;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, var(--em-a) 0%, var(--em-b) 100%);
  color: var(--accent-txt);
  border: none;
  border-radius: 12px;
  font-family: var(--font);
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: opacity 0.15s, transform 0.12s;
}

.btn-init::after {
  content: '';
  position: absolute;
  top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
  animation: scanline-shimmer 2.4s ease-in-out infinite;
}

.btn-init:hover { opacity: 0.9; }
.btn-init:active { transform: scale(0.98); }
.btn-init:disabled { opacity: 0.3; cursor: not-allowed; }
.btn-init:disabled::after { display: none; }

@keyframes scanline-shimmer {
  0% { left: -100%; }
  100% { left: 200%; }
}

.btn-ghost {
  width: 100%;
  padding: 0.85rem 1.5rem;
  background: transparent;
  color: var(--text-m);
  border: 1px solid var(--gb);
  border-radius: 12px;
  font-family: var(--font);
  font-size: 0.85rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.btn-ghost:hover { border-color: var(--gb-hi); color: var(--text); }

.btn-amber {
  background: linear-gradient(135deg, var(--am-a) 0%, var(--am-b) 100%);
  color: var(--accent-txt);
  border: none;
  border-radius: 12px;
  padding: 0.85rem 1.25rem;
  font-family: var(--font);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-amber:hover { opacity: 0.85; }

/* ── Auth Screen ── */
.auth-wrap {
  flex: 1; min-height: 0; display: flex; flex-direction: column;
  justify-content: space-between;
  padding: 3.5rem 0 2.5rem;
  gap: 2rem;
  overflow-y: auto;
}
.auth-wrap > * { flex-shrink: 0; }

.auth-logo-block {
  display: flex; flex-direction: column;
  align-items: center; gap: 0.5rem;
}

.auth-logo-icon {
  width: 56px; height: 56px;
  border-radius: 16px;
  border: 1.5px solid rgba(var(--em-a-rgb),0.5);
  display: flex; align-items: center; justify-content: center;
  background: rgba(var(--em-a-rgb),0.06);
  margin-bottom: 0.25rem;
  box-shadow: 0 0 32px rgba(var(--em-a-rgb),0.15), inset 0 1px 0 rgba(255,255,255,0.08);
}

.auth-logo-mark {
  width: 22px; height: 28px;
  border-left: 2.5px solid var(--em-a);
  border-bottom: 2.5px solid var(--em-b);
  border-radius: 0 0 0 5px;
  margin-left: 4px;
}

.auth-logo-text {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  background: linear-gradient(90deg, var(--em-a), var(--em-b));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.auth-logo-sub {
  font-size: 0.62rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--text-d);
}

.auth-card {
  padding: 1.75rem;
}

.auth-card-title {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text);
  margin-bottom: 0.4rem;
}

.auth-card-sub {
  font-size: 0.8rem;
  color: var(--text-m);
  margin-bottom: 1.6rem;
  line-height: 1.5;
}

.ath-field-label {
  display: block;
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-d);
  margin-bottom: 0.45rem;
}

.ath-input {
  width: 100%;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--gb);
  border-radius: 10px;
  padding: 0.9rem 1rem;
  color: var(--text);
  font-family: var(--font);
  font-size: 0.95rem;
  font-weight: 500;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.3s;
  margin-bottom: 1.1rem;
}

.ath-input::placeholder { color: var(--text-d); }

.ath-input:focus {
  border-color: rgba(var(--em-a-rgb),0.5);
  box-shadow: 0 0 0 3px rgba(var(--em-a-rgb),0.08), 0 0 20px rgba(var(--em-a-rgb),0.06);
}

.auth-stats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  border-top: 1px solid var(--gb);
  padding-top: 1.5rem;
}

.auth-stat {
  text-align: center;
  padding: 0 0.75rem;
  border-right: 1px solid var(--gb);
}

.auth-stat:last-child { border-right: none; }

.auth-stat-val {
  font-family: var(--mono);
  font-size: 1.6rem;
  font-weight: 700;
  background: linear-gradient(180deg, var(--text) 0%, var(--text-m) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.auth-stat-label {
  font-size: 0.6rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-d);
  margin-top: 2px;
}

/* ── Dashboard / Bento ── */
.dash-wrap {
  flex: 1; min-height: 0; display: flex; flex-direction: column;
  padding: 1.25rem 0 6.5rem;
  gap: 1rem;
  overflow-y: auto;
}
.dash-wrap > * { flex-shrink: 0; }

.dash-header {
  display: flex; align-items: flex-start;
  justify-content: space-between;
  padding-top: 0.5rem;
}

.dash-greeting {
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-d);
  margin-bottom: 0.25rem;
}

.dash-name {
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text);
}

.readiness-chip {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  border-radius: 20px;
  border: 1px solid rgba(var(--em-b-rgb),0.25);
  background: rgba(var(--em-b-rgb),0.06);
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--em-b);
  white-space: nowrap;
}

.readiness-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--em-b);
  box-shadow: 0 0 6px rgba(var(--em-b-rgb),0.6);
  animation: pulse-glow 1.8s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { opacity: 1; box-shadow: 0 0 6px rgba(var(--em-b-rgb),0.6); }
  50% { opacity: 0.5; box-shadow: 0 0 2px rgba(var(--em-b-rgb),0.3); }
}

.bento-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto auto auto;
  gap: 10px;
}

.bento-hero {
  grid-column: 1 / -1;
  padding: 1.25rem;
  cursor: pointer;
  transition: transform 0.2s var(--spring-heavy);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-height: 112px;
  position: relative;
  overflow: hidden;
}

.bento-hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(var(--em-a-rgb),0.08) 0%, rgba(var(--em-b-rgb),0.04) 100%);
  pointer-events: none;
}

.bento-hero:hover { transform: scale(1.015); }
.bento-hero:active { transform: scale(0.99); }

.bento-card {
  padding: 1.1rem;
  cursor: pointer;
  transition: transform 0.2s var(--spring-heavy), border-color 0.2s;
  display: flex;
  flex-direction: column;
  gap: 0.38rem;
  min-height: 96px;
}

.bento-card:hover { transform: scale(1.03); border-color: var(--gb-hi); }
.bento-card:active { transform: scale(0.98); }

.bento-icon {
  align-self: flex-start;
  width: 34px; height: 34px;
  border-radius: 11px;
  border: 1px solid rgba(var(--em-a-rgb),0.28);
  background: rgba(var(--em-a-rgb),0.07);
  display: flex; align-items: center; justify-content: center;
  color: var(--em-b);
  font-family: var(--mono);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 16px rgba(var(--em-a-rgb),0.08);
}

.bento-tag {
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--text-d);
}

.bento-label {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text);
  margin-top: auto;
}

.bento-hero .bento-label {
  font-size: 1.45rem;
}

.stats-strip {
  display: flex;
  gap: 0.6rem;
}

.stat-chip {
  flex: 1;
  padding: 0.6rem 0.75rem;
  text-align: center;
}

.stat-chip-val {
  font-family: var(--mono);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--em-b);
  display: block;
}

.stat-chip-label {
  font-size: 0.6rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-d);
  display: block;
  margin-top: 2px;
}

.journey-card {
  padding: 1rem;
  overflow: hidden;
  position: relative;
}

.journey-card::before {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(circle at 12% 10%, rgba(var(--em-a-rgb),0.12), transparent 38%);
  pointer-events: none;
}

.journey-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 0.8rem;
  position: relative;
  z-index: 1;
}

.journey-title {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text);
}

.journey-sub {
  font-size: 0.68rem;
  color: var(--text-d);
  margin-top: 0.2rem;
}

.journey-score {
  font-family: var(--mono);
  font-size: 0.86rem;
  color: var(--em-b);
  border: 1px solid rgba(var(--em-b-rgb),0.22);
  border-radius: 999px;
  padding: 0.28rem 0.55rem;
  background: rgba(var(--em-b-rgb),0.05);
}

.journey-stream {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.58rem;
  margin-top: 0.9rem;
  max-height: 238px;
  overflow-y: auto;
  padding: 0.1rem 0.15rem 0.1rem 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--em-a-rgb),0.28) transparent;
  z-index: 1;
}

.journey-stream::-webkit-scrollbar { width: 3px; }
.journey-stream::-webkit-scrollbar-thumb {
  background: rgba(var(--em-a-rgb),0.28);
  border-radius: 999px;
}

.journey-stream::before {
  content: '';
  position: absolute;
  left: 15px; top: 8px; bottom: 8px;
  width: 1px;
  background: linear-gradient(180deg, rgba(var(--em-a-rgb),0.14), rgba(var(--em-b-rgb),0.34), rgba(255,255,255,0.06));
}

.journey-node {
  position: relative;
  display: grid;
  grid-template-columns: 32px 1fr auto;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
  padding: 0.65rem 0.7rem 0.65rem 0;
  border: 1px solid transparent;
  border-radius: 12px;
}

.journey-dot {
  width: 20px; height: 20px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.18);
  background: rgba(255,255,255,0.04);
  position: relative;
  z-index: 1;
  justify-self: center;
}

.journey-node.done .journey-dot,
.journey-node.active .journey-dot {
  border-color: rgba(var(--em-b-rgb),0.5);
  background: radial-gradient(circle, var(--em-b), var(--em-a));
  box-shadow: 0 0 16px rgba(var(--em-b-rgb),0.28);
}

.journey-node.active .journey-dot {
  animation: pulse-glow 1.8s ease-in-out infinite;
}

.journey-label {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-d);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.journey-copy {
  font-size: 0.66rem;
  color: var(--text-d);
  margin-top: 0.18rem;
  line-height: 1.35;
}

.journey-mile {
  font-family: var(--mono);
  font-size: 0.64rem;
  color: var(--text-d);
}

.journey-node.done .journey-label,
.journey-node.active .journey-label { color: var(--em-a); }

.journey-node.active {
  border-color: rgba(var(--em-a-rgb),0.18);
  background: rgba(var(--em-a-rgb),0.045);
}

/* ── Bottom Nav ── */
.bottom-nav {
  position: fixed; bottom: 0; left: 0; right: 0;
  z-index: 10;
  background: var(--nav-bg, rgba(5,6,10,0.85));
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border-top: 1px solid var(--gb);
  display: flex;
  padding: 0.5rem 0 calc(0.5rem + env(safe-area-inset-bottom, 0px));
}

.nav-item {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center; gap: 4px;
  padding: 0.4rem 0.5rem;
  background: none; border: none;
  cursor: pointer;
  transition: opacity 0.15s;
  color: var(--text-d);
  position: relative;
}

.nav-item.active { color: var(--em-b); }

.nav-item.unread {
  color: var(--em-b);
  text-shadow: 0 0 12px rgba(var(--em-b-rgb),0.38);
}

.nav-icon {
  width: 22px; height: 18px;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--mono);
  font-size: 0.62rem;
  line-height: 1;
  letter-spacing: 0.04em;
  position: relative;
}

.nav-unread-dot {
  position: absolute;
  top: -4px;
  right: -8px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--em-b);
  box-shadow: 0 0 10px rgba(var(--em-b-rgb),0.85);
  animation: nav-unread-pulse 1.45s ease-in-out infinite;
}

@keyframes nav-unread-pulse {
  0%, 100% { transform: scale(0.82); opacity: 0.58; }
  50% { transform: scale(1.25); opacity: 1; }
}

.nav-label {
  font-size: 0.58rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* ── Connect Screen / Particle Sphere ── */
.connect-wrap {
  flex: 1; min-height: 0; display: flex; flex-direction: column;
  align-items: center;
  padding: 2rem 0 4rem;
  gap: 0;
  overflow-y: auto;
}
.connect-wrap > * { flex-shrink: 0; }

.connect-header {
  width: 100%;
  display: flex; align-items: center; gap: 0.75rem;
  padding-bottom: 2rem;
}

.back-btn {
  width: 36px; height: 36px;
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--gb);
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-m);
  cursor: pointer;
  font-size: 1rem;
  transition: border-color 0.15s, color 0.15s;
  flex-shrink: 0;
}

.back-btn:hover { border-color: var(--gb-hi); color: var(--text); }

.sphere-zone {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 1.5rem;
}

.sphere-canvas {
  display: block;
}

.sphere-state-label {
  text-align: center;
}

.sphere-state-title {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--text-d);
  margin-bottom: 0.3rem;
}

.sphere-state-sub {
  font-size: 0.8rem;
  color: var(--text-m);
}

.sphere-state-sub.em {
  background: linear-gradient(90deg, var(--em-a), var(--em-b));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: 600;
}

.connect-bottom {
  width: 100%;
  display: flex; flex-direction: column; gap: 0.75rem;
}

.conn-status-row {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.85rem 1rem;
}

.conn-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background 0.4s, box-shadow 0.4s;
}

.conn-dot.searching {
  background: rgba(var(--em-a-rgb),0.6);
  animation: searching-pulse 1.2s ease-in-out infinite;
}

.conn-dot.connected {
  background: var(--em-b);
  box-shadow: 0 0 10px rgba(var(--em-b-rgb),0.7);
}

.conn-dot.error { background: var(--rd-a); }
.conn-dot.idle { background: rgba(255,255,255,0.2); }

@keyframes searching-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.conn-status-text {
  font-size: 0.8rem;
  color: var(--text-m);
  flex: 1;
}

.signal-freeze-overlay {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(3,5,8,0.7);
  backdrop-filter: blur(2px) saturate(0.3);
  -webkit-backdrop-filter: blur(2px) saturate(0.3);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 1rem;
}

.freeze-border-pulse {
  position: fixed; inset: 0; z-index: 49;
  pointer-events: none;
  border: 1px solid rgba(80,90,110,0.4);
  animation: freeze-border 2s ease-in-out infinite;
}

@keyframes freeze-border {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.1; }
}

/* ── Exercise Grid ── */
.ex-grid { display: flex; flex-direction: column; gap: 0.5rem; }

.ex-row {
  display: flex; align-items: center; gap: 0.85rem;
  padding: 0.85rem 1rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  border-radius: 14px;
  border: 1px solid var(--gb);
  background: rgba(255,255,255,0.02);
}

.ex-row:hover { border-color: var(--gb-hi); }

.ex-row.sel {
  border-color: rgba(var(--em-a-rgb),0.45);
  background: rgba(var(--em-a-rgb),0.06);
}

.ex-code {
  width: 30px; height: 30px;
  border-radius: 9px;
  border: 1px solid rgba(var(--em-a-rgb),0.24);
  background: rgba(var(--em-a-rgb),0.06);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--mono);
  font-size: 0.66rem;
  font-weight: 700;
  color: var(--em-a);
  flex-shrink: 0;
}

.ex-label {
  flex: 1;
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--text);
}

.ex-check {
  width: 20px; height: 20px;
  border-radius: 50%;
  border: 1.5px solid var(--gb-hi);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.65rem;
  color: transparent;
  transition: all 0.2s;
  flex-shrink: 0;
}

.ex-row.sel .ex-check {
  background: linear-gradient(135deg, var(--em-a), var(--em-b));
  border-color: transparent;
  color: var(--accent-txt);
}

/* ── Live Screen ── */
.live-root {
  flex: 1; display: flex; flex-direction: column;
  background: var(--base);
  max-width: var(--max-w);
  margin: 0 auto;
  width: 100%;
  position: relative;
  z-index: 5;
}

.cam-area {
  aspect-ratio: 3/4;
  background: #000;
  position: relative;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  width: 100%;
}

.cam-aurora {
  position: absolute; inset: 0;
  pointer-events: none;
  transition: background 1.2s ease;
  z-index: 0;
}

.cam-aurora.good {
  background:
    radial-gradient(ellipse 80% 50% at 50% 100%, rgba(var(--em-b-rgb),0.12) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 10% 50%, rgba(var(--em-a-rgb),0.08) 0%, transparent 50%);
}

.cam-aurora.warn {
  background:
    radial-gradient(ellipse 80% 50% at 50% 100%, rgba(255,45,85,0.18) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 90% 50%, rgba(255,59,48,0.12) 0%, transparent 50%);
  animation: aurora-shake 0.15s ease-in-out infinite;
}

@keyframes aurora-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-1px); }
  75% { transform: translateX(1px); }
}

.cam-placeholder {
  position: relative; z-index: 2;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 0.75rem; color: var(--text-m);
}

.cam-placeholder-icon {
  width: 64px; height: 64px;
  border-radius: 20px;
  border: 1px solid rgba(var(--em-a-rgb),0.24);
  background: rgba(var(--em-a-rgb),0.04);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--mono);
  font-size: 0.78rem;
  font-weight: 700;
  color: rgba(var(--em-a-rgb),0.55);
  letter-spacing: 0.12em;
  opacity: 0.9;
}
.cam-placeholder p { font-size: 0.82rem; }

.cam-canvas {
  position: absolute; inset: 0; z-index: 3;
  width: 100%; height: 100%;
  pointer-events: none;
  mix-blend-mode: screen;
}

.cam-overlay {
  position: absolute; inset: 0; z-index: 4;
  pointer-events: none;
}

.cam-corner {
  position: absolute;
  width: 20px; height: 20px;
  border-style: solid;
  opacity: 0.7;
}

.cam-corner.tl { top: 10px; left: 10px; border-color: var(--em-a) transparent transparent var(--em-a); border-width: 1.5px 0 0 1.5px; }
.cam-corner.tr { top: 10px; right: 10px; border-color: var(--em-a) var(--em-a) transparent transparent; border-width: 1.5px 1.5px 0 0; }
.cam-corner.bl { bottom: 10px; left: 10px; border-color: transparent transparent var(--em-a) var(--em-a); border-width: 0 0 1.5px 1.5px; }
.cam-corner.br { bottom: 10px; right: 10px; border-color: transparent var(--em-a) var(--em-a) transparent; border-width: 0 1.5px 1.5px 0; }

.live-badge {
  position: absolute; top: 14px; left: 14px;
  display: flex; align-items: center; gap: 5px;
  background: rgba(3,5,8,0.72);
  border: 1px solid rgba(0,122,255,0.35);
  border-radius: 6px;
  padding: 3px 9px;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: #007AFF;
}

.live-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #007AFF;
  box-shadow: 0 0 6px 2px rgba(0,122,255,0.55);
  animation: live-breathe 2.4s ease-in-out infinite;
}

@keyframes live-breathe {
  0%, 100% { opacity: 1; box-shadow: 0 0 7px 3px rgba(0,122,255,0.6); }
  50%       { opacity: 0.3; box-shadow: 0 0 2px 0px rgba(0,122,255,0.15); }
}

.rep-hud {
  position: relative;
  padding: 0.85rem 1.15rem 0.95rem;
  background: rgba(5,6,10,0.92);
  border-top: 1px solid rgba(255,255,255,0.07);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  overflow: hidden;
}

.rep-hud::before {
  content: '';
  position: absolute; inset: 0;
  background:
    radial-gradient(circle at 16% 28%, rgba(var(--em-a-rgb),0.11), transparent 38%),
    radial-gradient(circle at 88% 50%, rgba(var(--em-b-rgb),0.07), transparent 34%);
  pointer-events: none;
}

.rep-hud.near::before {
  background:
    radial-gradient(circle at 20% 32%, rgba(255,184,0,0.12), transparent 38%),
    radial-gradient(circle at 88% 50%, rgba(var(--em-b-rgb),0.08), transparent 34%);
}

.rep-hud-top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.rep-counter {
  display: flex;
  align-items: flex-end;
  gap: 0.55rem;
}

.rep-num {
  font-family: var(--mono);
  font-size: 3rem;
  line-height: 0.88;
  font-weight: 700;
  background: linear-gradient(180deg, var(--em-b) 0%, var(--em-a) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 18px rgba(var(--em-b-rgb),0.35));
}

.rep-hud.near .rep-num {
  background: linear-gradient(180deg, var(--am-a) 0%, var(--em-b) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  filter: drop-shadow(0 0 20px rgba(255,184,0,0.34));
}

.rep-label {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-d);
  padding-bottom: 0.15rem;
}

.rep-gate-label {
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--am-a);
  padding-bottom: 0.18rem;
  white-space: nowrap;
}

.rep-progress-readout {
  font-family: var(--mono);
  font-size: 0.82rem;
  color: var(--text-m);
  border: 1px solid rgba(var(--em-a-rgb),0.18);
  border-radius: 999px;
  padding: 0.28rem 0.58rem;
  background: rgba(var(--em-a-rgb),0.04);
}

.rep-hud.near .rep-progress-readout {
  color: var(--am-a);
  border-color: rgba(255,184,0,0.28);
  background: rgba(255,184,0,0.06);
}

.rep-progress-track {
  position: relative;
  z-index: 1;
  height: 12px;
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.08);
  background:
    linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.07)),
    rgba(255,255,255,0.035);
  box-shadow: inset 0 0 12px rgba(0,0,0,0.45);
}

.rep-progress-fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: 0%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--em-a), var(--em-b));
  box-shadow: 0 0 18px rgba(var(--em-b-rgb),0.28);
  transition: width 0.18s linear, background 0.25s ease, box-shadow 0.25s ease;
}

.rep-hud.resetting .rep-progress-fill {
  opacity: 0;
  transition: none;
}

.rep-hud.near .rep-progress-fill {
  background: linear-gradient(90deg, var(--em-b), var(--am-a), var(--am-b));
  box-shadow: 0 0 24px rgba(255,184,0,0.42);
}

.rep-hud.locked .rep-progress-fill {
  box-shadow: 0 0 30px rgba(255,184,0,0.62);
}

.action-rep-stack {
  display: flex;
  flex-direction: column;
  max-height: min(34svh, 280px);
  overflow-y: auto;
  overscroll-behavior: contain;
  background: rgba(5,6,10,0.92);
  border-top: 1px solid rgba(255,255,255,0.07);
}

.action-rep-stack .rep-hud {
  background: transparent;
  border-top: 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  padding: 0.72rem 1rem 0.82rem;
}

.action-rep-stack .rep-hud:not(.active) {
  opacity: 0.72;
}

.action-rep-stack .rep-hud:not(.active)::before {
  opacity: 0.42;
}

.action-rep-stack .rep-num {
  min-width: 2.3rem;
  font-size: 2.18rem;
}

.action-title {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text);
}

.action-sub {
  margin-top: 0.15rem;
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-d);
}

.action-empty {
  padding: 0.9rem 1rem;
  color: var(--text-d);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.rep-particle {
  position: absolute;
  top: 50%;
  left: var(--x);
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--em-b);
  opacity: 0;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 14px rgba(var(--em-b-rgb),0.95), 0 0 2px rgba(255,255,255,0.9);
  animation: rep-spark 1.35s ease-in-out infinite;
  animation-delay: var(--delay);
}

.rep-hud.near .rep-particle {
  background: var(--am-a);
  box-shadow: 0 0 16px rgba(255,184,0,0.95), 0 0 2px rgba(255,255,255,0.9);
  animation-duration: 0.86s;
}

.rep-hud.locked .rep-particle {
  opacity: 0.95;
  animation-duration: 0.5s;
}

.rep-hud.resetting .rep-particle {
  opacity: 0;
  animation: none;
}

@keyframes rep-spark {
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
  42% { opacity: 0.85; transform: translate(calc(-50% + 8px), -50%) scale(1); }
  70% { opacity: 0.25; transform: translate(calc(-50% + 18px), -50%) scale(0.65); }
}

.dtw-badge {
  position: absolute; top: 12px; right: 12px;
  font-family: var(--mono);
  font-size: 0.7rem;
  padding: 3px 8px;
  background: rgba(3,5,8,0.7);
  border: 1px solid var(--gb);
  border-radius: 6px;
  color: var(--text-m);
}

.classify-badge {
  position: absolute;
  top: 42px;
  right: 12px;
  max-width: min(58%, 210px);
  display: flex;
  align-items: center;
  gap: 0.42rem;
  padding: 5px 8px;
  background: rgba(3,5,8,0.72);
  border: 1px solid rgba(var(--em-a-rgb),0.24);
  border-radius: 7px;
  color: rgba(240,245,255,0.82);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.classify-badge.unassigned {
  border-color: rgba(255,184,0,0.34);
  color: var(--am-a);
}

.classify-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--em-b);
  box-shadow: 0 0 8px rgba(var(--em-b-rgb),0.7);
  flex: 0 0 auto;
}

.classify-badge.unassigned .classify-dot {
  background: var(--am-a);
  box-shadow: 0 0 8px rgba(255,184,0,0.7);
}

.classify-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.form-hint {
  position: absolute; top: 58px; left: 0; right: 0;
  display: flex; justify-content: center;
  pointer-events: none;
}

.hint-pill {
  background: rgba(255,45,85,0.12);
  border: 1px solid rgba(255,45,85,0.35);
  border-radius: 20px;
  padding: 5px 14px;
  font-size: 0.78rem;
  color: rgba(255,120,130,0.9);
  text-align: center;
  animation: hint-in 0.25s ease;
}

@keyframes hint-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.session-bar {
  padding: 0.85rem 1.25rem;
  border-top: 1px solid var(--gb);
  background: rgba(5,6,10,0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex; flex-direction: column; gap: 0.65rem;
}

.session-meta {
  display: flex; justify-content: space-between; align-items: center;
}

.session-ex-label {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-m);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.session-timer {
  font-family: var(--mono);
  font-size: 1rem;
  color: var(--em-b);
}

.finish-btn {
  width: 100%;
  background: transparent;
  border: 1.5px solid rgba(var(--em-a-rgb),0.45);
  border-radius: 12px;
  padding: 0.85rem;
  font-family: var(--font);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--em-a);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.finish-btn:hover {
  background: rgba(var(--em-a-rgb),0.08);
  border-color: rgba(var(--em-a-rgb),0.7);
}

.classification-panel {
  padding: 0.95rem 1rem;
  display: grid;
  gap: 0.65rem;
}

.classification-title {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-d);
}

.classification-main {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  align-items: center;
}

.classification-name {
  min-width: 0;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text);
}

.classification-confidence {
  font-family: var(--mono);
  font-size: 0.82rem;
  color: var(--em-b);
  white-space: nowrap;
}

.classification-mini {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.55rem;
}

.classification-mini div {
  border: 1px solid var(--gb);
  border-radius: 8px;
  padding: 0.5rem;
  background: rgba(255,255,255,0.025);
}

.classification-mini strong {
  display: block;
  font-family: var(--mono);
  font-size: 0.85rem;
  color: var(--text);
}

.classification-mini span {
  display: block;
  margin-top: 0.2rem;
  font-size: 0.58rem;
  color: var(--text-d);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.classification-actions {
  display: grid;
  gap: 0.45rem;
}

.classification-action-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.55rem;
  padding: 0.52rem 0.6rem;
  border: 1px solid var(--gb);
  border-radius: 8px;
  background: rgba(255,255,255,0.025);
}

.classification-action-code {
  font-family: var(--mono);
  font-size: 0.7rem;
  color: var(--em-b);
}

.classification-action-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.classification-action-reps {
  font-family: var(--mono);
  color: var(--text);
  font-size: 0.78rem;
}

/* ── Analysis Screen ── */
.analysis-wrap {
  flex: 1; min-height: 0; display: flex; flex-direction: column;
  padding: 1.5rem 0 2rem;
  gap: 0.85rem;
  overflow-y: auto;
}
.analysis-wrap > * { flex-shrink: 0; }

.analysis-header {
  text-align: center;
  padding: 1rem 0 0.5rem;
}

.analysis-settle-zone {
  position: relative;
  height: 80px;
  overflow: hidden;
  pointer-events: none;
}

.settle-particle {
  position: absolute;
  border-radius: 50%;
  animation: settle-fall linear forwards;
  opacity: 0;
}

@keyframes settle-fall {
  0% { opacity: 0.8; transform: translateY(-20px) scale(1); }
  80% { opacity: 0.3; }
  100% { opacity: 0; transform: translateY(80px) scale(0.3); }
}

.score-glass {
  padding: 1.5rem;
  text-align: center;
}

.score-ring-wrap {
  display: flex; align-items: center; justify-content: center;
  margin: 0.75rem 0;
}

.score-ring {
  position: relative;
  width: 100px; height: 100px;
}

.score-ring svg { transform: rotate(-90deg); display: block; }

.score-center {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
}

.score-pct {
  font-family: var(--mono);
  font-size: 2rem;
  font-weight: 700;
  background: linear-gradient(180deg, var(--em-b), var(--em-a));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.score-pct-label {
  font-size: 0.58rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-d);
}

.score-verdict {
  font-size: 0.82rem;
  color: var(--text-m);
  line-height: 1.6;
}

.stats-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.5rem;
}

.stat-glass {
  padding: 0.85rem 0.6rem;
  text-align: center;
}

.stat-glass-val {
  font-family: var(--mono);
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text);
}

.stat-glass-label {
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-d);
  margin-top: 3px;
}

.joint-panel { padding: 1.1rem; }

.joint-panel-title {
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-d);
  margin-bottom: 0.85rem;
}

.joint-row {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--gb);
}

.joint-row:last-child { border-bottom: none; }

.joint-name {
  flex: 1;
  font-size: 0.82rem;
  font-weight: 500;
  text-transform: capitalize;
  color: var(--text);
}

.joint-issue {
  flex: 1;
  font-size: 0.75rem;
  color: var(--text-m);
}

.sev-bar-wrap {
  width: 56px; height: 4px;
  background: rgba(255,255,255,0.06);
  border-radius: 3px; overflow: hidden;
}

.sev-bar {
  height: 100%; border-radius: 3px;
  background: linear-gradient(90deg, var(--rd-b), var(--rd-a));
  transition: width 0.8s ease;
}

.advice-glass {
  padding: 1rem 1.25rem;
  border-color: rgba(var(--em-a-rgb),0.18);
}

.advice-label {
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--em-a);
  margin-bottom: 0.5rem;
  opacity: 0.8;
}

.advice-text {
  font-size: 0.85rem;
  line-height: 1.65;
  color: var(--text-m);
}

/* ── Profile Screen ── */
.profile-wrap {
  flex: 1; min-height: 0; display: flex; flex-direction: column;
  padding: 1.5rem 0 6.5rem;
  gap: 0.85rem;
  overflow-y: auto;
}
.profile-wrap > * { flex-shrink: 0; }

.profile-hero {
  padding: 1.5rem;
  display: flex; align-items: center; gap: 1rem;
}

.profile-avatar {
  width: 56px; height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--em-a), var(--em-b));
  display: flex; align-items: center; justify-content: center;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--accent-txt);
  flex-shrink: 0;
}

.profile-name {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text);
}

.profile-meta {
  font-size: 0.72rem;
  color: var(--text-m);
  margin-top: 2px;
}

.muscle-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.muscle-chip {
  padding: 0.65rem 0.85rem;
  display: flex; align-items: center; gap: 0.6rem;
}

.muscle-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.muscle-name {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-m);
  flex: 1;
}

.muscle-bar-wrap {
  width: 48px; height: 3px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px; overflow: hidden;
}

.muscle-bar {
  height: 100%; border-radius: 2px;
  transition: width 0.8s ease;
}

.body-map-card {
  padding: 1rem;
  overflow: hidden;
  position: relative;
}

.body-map-card::after {
  content: '';
  position: absolute; inset: 0;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.03), transparent 35%),
    radial-gradient(circle at 50% 20%, rgba(var(--em-a-rgb),0.1), transparent 45%);
  pointer-events: none;
}

.body-map-head {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 1rem;
  position: relative; z-index: 1;
}

.body-map-title {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text);
}

.body-map-sub {
  font-size: 0.68rem;
  color: var(--text-d);
  margin-top: 0.24rem;
  line-height: 1.45;
}

.body-view-toggle {
  display: flex;
  border: 1px solid var(--gb);
  border-radius: 9px;
  overflow: hidden;
  background: rgba(255,255,255,0.03);
  flex-shrink: 0;
}

.body-view-btn {
  background: transparent;
  border: none;
  color: var(--text-d);
  font-family: var(--font);
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 0.42rem 0.55rem;
  cursor: pointer;
}

.body-view-btn.active {
  color: var(--accent-txt);
  background: linear-gradient(135deg, var(--em-a), var(--em-b));
}

.body-map-stage {
  position: relative;
  z-index: 1;
  margin: 0.65rem auto 0;
  width: min(100%, 300px);
}

.body-map-svg {
  width: 100%;
  height: auto;
  display: block;
  overflow: visible;
}

.body-silhouette {
  fill: rgba(255,255,255,0.035);
  stroke: rgba(255,255,255,0.08);
  stroke-width: 1.2;
}

.muscle-shape {
  stroke: rgba(3,5,8,0.72);
  stroke-width: 2;
  cursor: pointer;
  transition: fill 0.22s ease, opacity 0.22s ease, stroke 0.22s ease, filter 0.22s ease;
}

.muscle-shape:hover {
  stroke: rgba(255,255,255,0.5);
  filter: drop-shadow(0 0 10px rgba(var(--em-a-rgb),0.28));
}

.muscle-shape.target {
  animation: muscle-breathe 2.6s ease-in-out infinite;
}

.muscle-shape.selected {
  stroke: rgba(var(--em-b-rgb),0.9);
  filter: drop-shadow(0 0 12px rgba(var(--em-b-rgb),0.35));
}

@keyframes muscle-breathe {
  0%, 100% { filter: drop-shadow(0 0 6px rgba(var(--em-a-rgb),0.2)); }
  50% { filter: drop-shadow(0 0 16px rgba(var(--em-b-rgb),0.38)); }
}

.body-map-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.7rem;
  position: relative;
  z-index: 1;
}

.focus-pill {
  border: 1px solid rgba(var(--em-a-rgb),0.22);
  background: rgba(var(--em-a-rgb),0.05);
  color: var(--text-m);
  border-radius: 999px;
  padding: 0.34rem 0.55rem;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.focus-pill.hot {
  border-color: rgba(255,184,0,0.35);
  background: rgba(255,184,0,0.08);
  color: var(--am-a);
}

.focus-pill.active {
  border-color: rgba(var(--em-b-rgb),0.38);
  background: rgba(var(--em-b-rgb),0.08);
  color: var(--em-b);
}

.recovery-detail {
  padding: 0.9rem 1rem;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.45rem 1rem;
  align-items: center;
}

.recovery-name {
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text);
}

.recovery-value {
  font-family: var(--mono);
  font-size: 1.15rem;
  color: var(--em-b);
}

.recovery-copy {
  grid-column: 1 / -1;
  font-size: 0.72rem;
  line-height: 1.5;
  color: var(--text-m);
}

/* ── Settings Screen ── */
.settings-wrap {
  flex: 1; min-height: 0; display: flex; flex-direction: column;
  padding: 1.5rem 0 6.5rem;
  gap: 0.85rem;
  overflow-y: auto;
}
.settings-wrap > * { flex-shrink: 0; }

.settings-section {
  padding: 1.25rem;
  display: flex; flex-direction: column; gap: 1rem;
}

.settings-section-title {
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-d);
}

.settings-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 1rem;
}

.settings-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text);
}

.settings-sub {
  font-size: 0.72rem;
  color: var(--text-d);
  margin-top: 2px;
}

.mode-toggle {
  display: flex;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--gb);
  border-radius: 8px;
  overflow: hidden;
}

.mode-btn {
  padding: 0.4rem 0.75rem;
  font-family: var(--font);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: none; border: none; cursor: pointer;
  color: var(--text-m);
  transition: all 0.15s;
}

.mode-btn.active {
  background: linear-gradient(135deg, var(--em-a), var(--em-b));
  color: var(--accent-txt);
}

/* ── Plan Config ── */
.plan-wrap {
  flex: 1; min-height: 0; display: flex; flex-direction: column;
  padding: 1rem 0 2rem;
  gap: 1rem;
  overflow-y: auto;
}
.plan-wrap > * { flex-shrink: 0; }

.plan-ai-card {
  padding: 1.1rem;
  border-color: rgba(var(--em-a-rgb),0.2);
  display: flex; flex-direction: column; gap: 0.75rem;
}

.plan-ai-header {
  display: flex; align-items: center; gap: 0.6rem;
}

.plan-ai-icon {
  width: 28px; height: 28px;
  border-radius: 9px;
  border: 1px solid rgba(var(--em-a-rgb),0.25);
  background: rgba(var(--em-a-rgb),0.06);
  color: var(--em-a);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--mono);
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.plan-ai-title {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--em-a);
}

.ai-core-status {
  margin-top: 0.2rem;
  font-family: var(--mono);
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  color: var(--text-d);
}

.ai-core-dialogue {
  font-size: 0.82rem;
  line-height: 1.55;
  color: var(--text-m);
}

.ai-core-form {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.ai-core-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
}

.ai-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.42rem;
}

.ai-chip {
  border: 1px solid rgba(var(--em-a-rgb),0.22);
  background: rgba(var(--em-a-rgb),0.05);
  color: var(--text-m);
  border-radius: 999px;
  padding: 0.38rem 0.58rem;
  font-family: var(--font);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}

.ai-chip.active {
  border-color: rgba(var(--em-b-rgb),0.42);
  background: rgba(var(--em-b-rgb),0.09);
  color: var(--em-b);
}

.ai-chip.warn {
  border-color: rgba(255,184,0,0.38);
  background: rgba(255,184,0,0.08);
  color: var(--am-a);
}

.ai-chip.readonly {
  cursor: default;
}

.ai-core-decision {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--gb);
  border-radius: 10px;
  background: rgba(255,255,255,0.025);
}

.ai-core-route {
  margin-top: 0.25rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text);
}

.ai-core-reset {
  border: 1px solid rgba(var(--em-a-rgb),0.24);
  background: rgba(var(--em-a-rgb),0.04);
  color: var(--em-a);
  border-radius: 8px;
  padding: 0.48rem 0.65rem;
  font-family: var(--font);
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  white-space: nowrap;
}

.ai-core-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.15rem;
}

.ai-core-save {
  width: auto;
  min-width: 190px;
}

.plan-list {
  display: flex; flex-direction: column; gap: 0.4rem;
}

.plan-item {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--gb);
  cursor: pointer;
  transition: opacity 0.15s;
}

.plan-item:last-child { border-bottom: none; }
.plan-item:hover { opacity: 0.8; }

.plan-item.sel {
  opacity: 1;
  border-bottom-color: rgba(var(--em-a-rgb),0.22);
}

.plan-item.sel .plan-item-dot {
  box-shadow: 0 0 12px rgba(var(--em-b-rgb),0.42);
}

.plan-item-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--em-a), var(--em-b));
  flex-shrink: 0;
}

.plan-item-name {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text);
}

.plan-item-main {
  flex: 1;
  min-width: 0;
}

.plan-item-reason {
  margin-top: 0.16rem;
  font-size: 0.64rem;
  line-height: 1.35;
  color: var(--text-d);
}

.plan-item-meta {
  font-size: 0.72rem;
  color: var(--text-d);
  font-family: var(--mono);
}

/* ── Home Coach Screen ── */
.coach-wrap {
  flex: 1; display: flex; flex-direction: column;
  padding: 1rem 0 2rem;
  gap: 1rem;
  align-items: center;
}

.coach-avatar {
  width: 88px; height: 88px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--em-a), var(--em-b));
  display: flex; align-items: center; justify-content: center;
  font-family: var(--mono);
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--accent-txt);
  box-shadow: 0 0 40px rgba(var(--em-a-rgb),0.3);
  animation: coach-float 3s ease-in-out infinite;
  margin-top: 1rem;
}

@keyframes coach-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.coach-bubble {
  max-width: 300px;
  text-align: center;
}

.coach-text {
  font-size: 0.85rem;
  line-height: 1.65;
  color: var(--text-m);
  margin-top: 0.5rem;
}

.body-focus-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  width: 100%;
}

.body-focus-btn {
  padding: 0.85rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--gb);
  border-radius: 12px;
  font-family: var(--font);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-m);
  cursor: pointer;
  text-align: center;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.body-focus-btn.sel {
  border-color: rgba(var(--em-a-rgb),0.45);
  background: rgba(var(--em-a-rgb),0.06);
  color: var(--em-a);
}

/* ── Trakko Overlay ── */
.trakko-wrap {
  position: fixed;
  bottom: calc(70px + env(safe-area-inset-bottom, 0px));
  right: 1rem;
  z-index: 20;
  display: flex; flex-direction: column;
  align-items: flex-end; gap: 0.5rem;
  pointer-events: none;
}

.trakko-bubble {
  max-width: 220px;
  padding: 0.65rem 0.85rem;
  background: rgba(10,12,18,0.92);
  border: 1px solid rgba(var(--em-a-rgb),0.2);
  border-radius: 12px 4px 12px 12px;
  font-size: 0.73rem;
  line-height: 1.55;
  color: var(--text-m);
  pointer-events: auto;
}

.trakko-avatar {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(var(--em-a-rgb),0.3), rgba(var(--em-b-rgb),0.2));
  border: 1.5px solid rgba(var(--em-a-rgb),0.35);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--mono);
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--em-b);
  box-shadow: 0 0 16px rgba(var(--em-a-rgb),0.2);
  animation: trakko-float 4s ease-in-out infinite;
  pointer-events: auto;
}

@keyframes trakko-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

/* ── Core Timeline ── */
.core-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.5rem 0 0;
  min-height: 0;
  overflow: hidden;
}

.core-header {
  padding: 0.5rem 0 0.9rem;
  flex-shrink: 0;
}

.core-timeline {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 0.25rem 0 0.75rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--em-a-rgb),0.25) transparent;
}
.core-timeline::-webkit-scrollbar { width: 3px; }
.core-timeline::-webkit-scrollbar-track { background: transparent; }
.core-timeline::-webkit-scrollbar-thumb {
  background: rgba(var(--em-a-rgb),0.28);
  border-radius: 999px;
}

.core-message {
  display: flex;
  width: 100%;
}

.core-message.user {
  justify-content: flex-end;
}

.core-bubble {
  max-width: 92%;
  padding: 0.9rem 1rem;
  border-radius: 14px;
  border: 1px solid var(--gb);
  background: rgba(10,12,16,0.42);
  backdrop-filter: blur(22px) saturate(160%);
  box-shadow: 0 12px 36px rgba(0,0,0,0.22);
}

.core-message.user .core-bubble {
  max-width: 82%;
  border-color: rgba(var(--em-a-rgb),0.24);
  background: rgba(var(--em-a-rgb),0.07);
}

.core-msg-meta {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 0.42rem;
  font-family: var(--mono);
  font-size: 0.56rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-d);
}

.core-msg-text {
  font-size: 0.82rem;
  line-height: 1.55;
  color: var(--text-m);
}

.core-mini-card {
  margin-top: 0.7rem;
  padding: 0.75rem;
  border-radius: 10px;
  border: 1px solid rgba(var(--em-a-rgb),0.18);
  background: rgba(255,255,255,0.025);
}

.core-plan-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.42rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.core-plan-row:last-child { border-bottom: none; }

.core-plan-code {
  width: 34px;
  height: 24px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--mono);
  font-size: 0.58rem;
  font-weight: 700;
  color: var(--accent-txt);
  background: linear-gradient(135deg, var(--em-a), var(--em-b));
  flex-shrink: 0;
}

.core-plan-name {
  flex: 1;
  min-width: 0;
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--text);
}

.core-plan-meta {
  font-family: var(--mono);
  font-size: 0.64rem;
  color: var(--text-d);
}

.core-plan-cta {
  margin-top: 0.65rem;
  padding: 0.4rem 0.6rem;
  text-align: center;
  font-size: 0.64rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--em-b);
  border: 1px solid rgba(var(--em-b-rgb),0.22);
  border-radius: 8px;
  background: rgba(var(--em-b-rgb),0.05);
}

.core-score-bar {
  margin-top: 0.72rem;
  height: 5px;
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
  overflow: hidden;
}

.core-score-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--em-a), var(--em-b));
  box-shadow: 0 0 14px rgba(var(--em-b-rgb),0.35);
}

.core-input-zone {
  flex-shrink: 0;
  padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px) + 0.5rem);
  padding-top: 0.4rem;
}

.core-input-shell {
  max-width: 720px;
  margin: 0 auto;
  padding: 0.55rem;
  border-radius: 15px;
  border: 1px solid var(--gb);
  background: rgba(10,12,16,0.68);
  backdrop-filter: blur(24px) saturate(160%);
  box-shadow: 0 18px 45px rgba(0,0,0,0.38);
}

.core-quick-row {
  display: flex;
  gap: 0.45rem;
  overflow-x: auto;
  padding: 0 0.1rem 0.45rem;
}

.core-quick {
  white-space: nowrap;
  border: 1px solid rgba(var(--em-a-rgb),0.2);
  background: rgba(var(--em-a-rgb),0.05);
  color: var(--text-m);
  border-radius: 999px;
  padding: 0.38rem 0.58rem;
  font-family: var(--font);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}

.core-input-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.core-input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--gb);
  background: rgba(255,255,255,0.04);
  border-radius: 10px;
  color: var(--text);
  font-family: var(--font);
  font-size: 0.84rem;
  padding: 0.72rem 0.8rem;
  outline: none;
}

.core-send {
  border: none;
  border-radius: 10px;
  padding: 0.74rem 0.82rem;
  font-family: var(--mono);
  font-size: 0.62rem;
  font-weight: 700;
  color: var(--accent-txt);
  background: linear-gradient(135deg, var(--em-a), var(--em-b));
  cursor: pointer;
}

/* ── Auto Classify Screen ── */
.classify-wrap {
  flex: 1; min-height: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 1.5rem;
  padding: 2rem 0;
  overflow-y: auto;
}
.classify-wrap > * { flex-shrink: 0; }

.classify-ring {
  width: 120px; height: 120px;
  border-radius: 50%;
  border: 2px solid rgba(var(--em-a-rgb),0.2);
  display: flex; align-items: center; justify-content: center;
  position: relative;
}

.classify-ring::before {
  content: '';
  position: absolute; inset: -6px;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: var(--em-a);
  animation: classify-spin 1.4s linear infinite;
}

.classify-ring::after {
  content: '';
  position: absolute; inset: -12px;
  border-radius: 50%;
  border: 1px solid transparent;
  border-top-color: rgba(var(--em-b-rgb),0.4);
  animation: classify-spin 2.2s linear infinite reverse;
}

@keyframes classify-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.classify-inner {
  text-align: center;
}

.classify-pct {
  font-family: var(--mono);
  font-size: 1.8rem;
  font-weight: 700;
  background: linear-gradient(180deg, var(--em-b), var(--em-a));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.classify-label {
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-d);
}

/* ── Shared Utils ── */
.spacer { flex: 1; }
.row-gap { height: 0.75rem; }
.mt1 { margin-top: 1rem; }

.section-divider {
  height: 1px;
  background: var(--gb);
  margin: 0.5rem 0;
}
`;

// ─── Screen Transition Variants ──────────────────────────────────────────────

const pageVariants = {
  initial: { scale: 0.88, opacity: 0, filter: "blur(10px)" },
  animate: {
    scale: 1, opacity: 1, filter: "blur(0px)",
    transition: { type: "spring", stiffness: 100, damping: 25, mass: 1.2 },
  },
  exit: {
    scale: 1.12, opacity: 0, filter: "blur(14px)",
    transition: { duration: 0.28, ease: [0.4, 0, 1, 1] },
  },
};

const panelVariants = {
  hidden: { scale: 0.94, opacity: 0, filter: "blur(6px)", y: 12 },
  visible: (i) => ({
    scale: 1, opacity: 1, filter: "blur(0px)", y: 0,
    transition: { type: "spring", stiffness: 120, damping: 20, delay: i * 0.05 },
  }),
};

// ─── AetherisWorld (persistent background) ───────────────────────────────────

function AetherisWorld({ visualState, theme }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef(visualState);
  const themeRef = useRef(theme);
  const particlesRef = useRef([]);

  useEffect(() => { stateRef.current = visualState; }, [visualState]);
  useEffect(() => { themeRef.current = theme; }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    const N = 130;
    particlesRef.current = Array.from({ length: N }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      r: Math.random() * 1.5 + 0.25,
      depth: Math.random() * 0.6 + 0.2,
    }));

    // Supernova slots: up to 3 simultaneous cross-star events
    const GROW = 4.5, PEAK = 0.9, FADE = 6.0;
    const novas = [0, 1, 2].map((i) => ({
      active: false,
      idx: 0,
      phase: "growing",
      t: 0,
      nextAt: 8 + i * 16 + Math.random() * 12,
    }));
    let lastTime = performance.now();

    function tick(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.1); // seconds, capped
      lastTime = now;

      const state = stateRef.current;
      const W = canvas.width, H = canvas.height;
      const frozen = state === "signal_lost";
      const turbulent = state === "live_warning";

      ctx.clearRect(0, 0, W, H);

      const tColors = THEME_COLORS[themeRef.current] ?? THEME_COLORS.deep_space;
      const pc = tColors.particle;
      const [pr, pg, pb] = pc[state] ?? pc.idle;

      // ── Supernova timing (3 independent slots) ───────────────────────────
      const nowSec = now / 1000;
      const activeIdxs = novas.filter(n => n.active).map(n => n.idx);
      novas.forEach((sn) => {
        if (!sn.active && nowSec >= sn.nextAt) {
          let candidate;
          let tries = 0;
          do { candidate = Math.floor(Math.random() * N); tries++; }
          while (activeIdxs.includes(candidate) && tries < 20);
          sn.active = true; sn.idx = candidate;
          sn.phase = "growing"; sn.t = 0;
          activeIdxs.push(candidate);
        }
        if (sn.active && !frozen) {
          sn.t += dt;
          if (sn.phase === "growing" && sn.t >= GROW) { sn.phase = "peak"; sn.t = 0; }
          else if (sn.phase === "peak" && sn.t >= PEAK) { sn.phase = "fading"; sn.t = 0; }
          else if (sn.phase === "fading" && sn.t >= FADE) {
            sn.active = false;
            sn.nextAt = nowSec + 10 + Math.random() * 16;
          }
        }
      });

      particlesRef.current.forEach((p, i) => {
        if (!frozen) {
          if (turbulent) {
            p.vx += (Math.random() - 0.5) * 0.04;
            p.vy += (Math.random() - 0.5) * 0.04;
            p.vx *= 0.97;
            p.vy *= 0.97;
          }
          p.x += p.vx * (turbulent ? 3 : 1);
          p.y += p.vy * (turbulent ? 3 : 1);
          if (p.x < 0) p.x += W;
          if (p.x > W) p.x -= W;
          if (p.y < 0) p.y += H;
          if (p.y > H) p.y -= H;
        }

        // Skip normal draw for any active supernova particle
        if (novas.some(n => n.active && n.idx === i)) return;

        const alpha = frozen ? 0.1 : p.depth * 0.48;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${pr},${pg},${pb},${alpha})`;
        ctx.fill();
      });

      // ── Draw cross-star particles (up to 3 simultaneous supernovas) ────────
      novas.forEach((sn) => {
        if (!sn.active) return;
        const p = particlesRef.current[sn.idx];
        let raw = 0;
        if (sn.phase === "growing") raw = sn.t / GROW;
        else if (sn.phase === "peak") raw = 1;
        else raw = 1 - sn.t / FADE;

        const intensity = raw < 0.5
          ? 2 * raw * raw
          : 1 - Math.pow(-2 * raw + 2, 2) / 2;

        const coreR    = p.r * (1 + intensity * 3.0);
        const glowR    = coreR * 7;
        const coreAlpha = 0.6 + intensity * 0.4;
        const glowAlpha = intensity * 0.30;

        // Halo: particle color at center → white bloom → blue-white → transparent
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
        grad.addColorStop(0,    `rgba(${pr},${pg},${pb},${glowAlpha * 1.6})`);
        grad.addColorStop(0.18, `rgba(255,252,245,${glowAlpha * 1.0})`);
        grad.addColorStop(0.40, `rgba(200,235,255,${glowAlpha * 0.5})`);
        grad.addColorStop(1,    `rgba(0,0,0,0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // 4 diffraction spikes: base in particle color, tips blue-white
        const rayLen   = glowR * 2.2;
        const rayAlpha = intensity * 0.48;
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
          const tipX = p.x + dx * rayLen;
          const tipY = p.y + dy * rayLen;
          const rg = ctx.createLinearGradient(p.x, p.y, tipX, tipY);
          rg.addColorStop(0,    `rgba(${pr},${pg},${pb},${rayAlpha})`);
          rg.addColorStop(0.12, `rgba(255,255,255,${rayAlpha * 0.8})`);
          rg.addColorStop(0.35, `rgba(210,238,255,${rayAlpha * 0.4})`);
          rg.addColorStop(1,    `rgba(180,220,255,0)`);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(tipX, tipY);
          ctx.strokeStyle = rg;
          ctx.lineWidth = 0.8 + intensity * 1.0;
          ctx.stroke();
        });

        // Core glow ring in particle color
        ctx.beginPath();
        ctx.arc(p.x, p.y, coreR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${pr},${pg},${pb},${coreAlpha})`;
        ctx.fill();

        // Bright white pin at very center (nucleus)
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${coreAlpha * 0.85})`;
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(tick);
    }

    tick();
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <>
      <div className={`ath-nebula ath-nebula-${visualState}`}>
        <div className="ds-blob-wrap ds-blob-wrap-1"><div className="ds-blob ds-blob-1" /></div>
        <div className="ds-blob-wrap ds-blob-wrap-2"><div className="ds-blob ds-blob-2" /></div>
        <div className="ds-blob-wrap ds-blob-wrap-3"><div className="ds-blob ds-blob-3" /></div>
        <div className="ds-blob-wrap ds-blob-wrap-4"><div className="ds-blob ds-blob-4" /></div>
        <div className="su-blob-wrap su-blob-wrap-1"><div className="su-blob su-blob-1" /></div>
        <div className="su-blob-wrap su-blob-wrap-2"><div className="su-blob su-blob-2" /></div>
        <div className="su-blob-wrap su-blob-wrap-3"><div className="su-blob su-blob-3" /></div>
        <div className="su-blob-wrap su-blob-wrap-4"><div className="su-blob su-blob-4" /></div>
      </div>
      <canvas ref={canvasRef} className="ath-world-canvas" />
    </>
  );
}

// ─── Particle Sphere (ConnectScreen) ─────────────────────────────────────────

function ParticleSphere({ connState, theme }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const connRef = useRef(connState);
  const themeRef = useRef(theme);
  const pulseRef = useRef({ active: false, radius: 80, opacity: 0 });
  const prevConnRef = useRef(connState);

  useEffect(() => { connRef.current = connState; }, [connState]);
  useEffect(() => { themeRef.current = theme; }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const SIZE = 220;
    canvas.width = SIZE; canvas.height = SIZE;
    const CX = SIZE / 2, CY = SIZE / 2, R = 80;
    const FOV = 300;
    const N = 80;

    // Golden ratio spiral distribution
    const particles = Array.from({ length: N }, (_, i) => {
      const theta = Math.acos(1 - 2 * (i + 0.5) / N);
      const phi = Math.PI * (1 + Math.sqrt(5)) * i;
      return { theta, phi, idx: i };
    });

    let rotX = 0, rotY = 0, rotZ = 0;
    let ringProgress = 0;

    function rotateXYZ(x, y, z, rx, ry, rz) {
      let y1 = y * Math.cos(rx) - z * Math.sin(rx), z1 = y * Math.sin(rx) + z * Math.cos(rx);
      let x2 = x * Math.cos(ry) + z1 * Math.sin(ry), z2 = -x * Math.sin(ry) + z1 * Math.cos(ry);
      let x3 = x2 * Math.cos(rz) - y1 * Math.sin(rz), y3 = x2 * Math.sin(rz) + y1 * Math.cos(rz);
      return { x: x3, y: y3, z: z2 };
    }

    function project(x, y, z) {
      const dz = FOV + z;
      const scale = FOV / dz;
      return { px: CX + x * scale, py: CY + y * scale, scale, z };
    }

    function tick() {
      const isConnected = connRef.current === "connected";
      const wasConnected = prevConnRef.current === "connected";

      ctx.clearRect(0, 0, SIZE, SIZE);

      if (isConnected) ringProgress = Math.min(1, ringProgress + 0.025);
      else ringProgress = Math.max(0, ringProgress - 0.04);

      const speed = isConnected ? 0.25 : 1;
      rotX += 0.0025 * speed;
      rotY += 0.006 * speed;
      rotZ += 0.0012 * speed;

      const pts = particles.map((p) => {
        const targetTheta = Math.PI / 2;
        const t = ringProgress;
        const blendTheta = p.theta * (1 - t) + targetTheta * t;
        const wobble = isConnected ? 0 : Math.sin(Date.now() * 0.001 * ((p.idx % 4) + 0.7)) * 0.25;
        const chaos = isConnected ? 0 : Math.sin(Date.now() * 0.0007 * ((p.idx % 6) + 0.5)) * 0.18;
        const sx = R * Math.sin(blendTheta + wobble) * Math.cos(p.phi + chaos);
        const sy = R * Math.sin(blendTheta + wobble) * Math.sin(p.phi + chaos);
        const sz = R * Math.cos(blendTheta + wobble);
        const rot = rotateXYZ(sx, sy, sz, rotX, rotY, rotZ);
        return { ...project(rot.x, rot.y, rot.z) };
      });

      pts.sort((a, b) => a.z - b.z);

      const sc = (THEME_COLORS[themeRef.current] ?? THEME_COLORS.deep_space).sphere;
      pts.forEach((p) => {
        const depth = (p.z + R) / (2 * R);
        const alpha = isConnected ? 0.55 + depth * 0.45 : 0.25 + depth * 0.45;
        const size = Math.max(0.5, p.scale * 2.2);
        const [nr, ng, nb] = sc.near;
        const [fr, fg, fb] = sc.far;
        const r = Math.round(depth * nr + (1 - depth) * fr);
        const g = Math.round(depth * ng + (1 - depth) * fg);
        const b = Math.round(depth * nb + (1 - depth) * fb);
        ctx.beginPath();
        ctx.arc(p.px, p.py, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, alpha)})`;
        ctx.fill();
      });

      if (isConnected && ringProgress > 0.85) {
        const alpha = (ringProgress - 0.85) / 0.15;
        const [nr, ng, nb] = sc.near;
        ctx.beginPath();
        ctx.arc(CX, CY, R + 18, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${nr},${ng},${nb},${alpha * 0.18})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      if (isConnected && !wasConnected) {
        pulseRef.current = { active: true, radius: R, opacity: 0.9 };
      }
      prevConnRef.current = connRef.current;

      const pulse = pulseRef.current;
      if (pulse.active) {
        pulse.radius += 2.5;
        pulse.opacity -= 0.018;
        if (pulse.opacity <= 0) { pulse.active = false; }
        else {
          ctx.beginPath();
          ctx.arc(CX, CY, pulse.radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,255,255,${pulse.opacity})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    tick();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="sphere-canvas"
      style={{ width: 220, height: 220 }}
    />
  );
}

const BODY_SEGMENTS = {
  front: [
    { muscle: "shoulders", type: "ellipse", attrs: { cx: 77, cy: 103, rx: 25, ry: 16 } },
    { muscle: "shoulders", type: "ellipse", attrs: { cx: 143, cy: 103, rx: 25, ry: 16 } },
    { muscle: "chest", type: "path", attrs: { d: "M84 124 C90 108 104 108 109 124 L107 158 C93 155 84 144 84 124Z" } },
    { muscle: "chest", type: "path", attrs: { d: "M136 124 C130 108 116 108 111 124 L113 158 C127 155 136 144 136 124Z" } },
    { muscle: "biceps", type: "path", attrs: { d: "M55 122 C42 144 38 171 45 197 C60 191 66 162 69 131Z" } },
    { muscle: "biceps", type: "path", attrs: { d: "M165 122 C178 144 182 171 175 197 C160 191 154 162 151 131Z" } },
    { muscle: "core", type: "path", attrs: { d: "M88 160 L132 160 L126 229 L94 229 Z" } },
    { muscle: "quads", type: "path", attrs: { d: "M82 238 C98 237 106 246 105 268 L101 334 C84 333 75 318 76 294Z" } },
    { muscle: "quads", type: "path", attrs: { d: "M138 238 C122 237 114 246 115 268 L119 334 C136 333 145 318 144 294Z" } },
    { muscle: "front_calves", type: "path", attrs: { d: "M77 337 C95 337 102 354 98 400 L82 400 C75 375 72 356 77 337Z" } },
    { muscle: "front_calves", type: "path", attrs: { d: "M143 337 C125 337 118 354 122 400 L138 400 C145 375 148 356 143 337Z" } },
  ],
  back: [
    { muscle: "shoulders", type: "ellipse", attrs: { cx: 77, cy: 103, rx: 25, ry: 16 } },
    { muscle: "shoulders", type: "ellipse", attrs: { cx: 143, cy: 103, rx: 25, ry: 16 } },
    { muscle: "upper_back", type: "path", attrs: { d: "M77 119 C89 104 131 104 143 119 L134 166 C119 158 101 158 86 166Z" } },
    { muscle: "lower_back", type: "path", attrs: { d: "M86 166 C101 158 119 158 134 166 L128 222 L92 222Z" } },
    { muscle: "triceps", type: "path", attrs: { d: "M54 122 C40 147 38 176 47 204 C63 194 68 162 69 131Z" } },
    { muscle: "triceps", type: "path", attrs: { d: "M166 122 C180 147 182 176 173 204 C157 194 152 162 151 131Z" } },
    { muscle: "hamstrings", type: "path", attrs: { d: "M82 238 C98 237 106 247 104 276 L99 334 C83 331 75 314 76 292Z" } },
    { muscle: "hamstrings", type: "path", attrs: { d: "M138 238 C122 237 114 247 116 276 L121 334 C137 331 145 314 144 292Z" } },
    { muscle: "rear_calves", type: "path", attrs: { d: "M78 337 C96 337 101 356 96 400 L82 400 C75 377 72 358 78 337Z" } },
    { muscle: "rear_calves", type: "path", attrs: { d: "M142 337 C124 337 119 356 124 400 L138 400 C145 377 148 358 142 337Z" } },
  ],
};

function BodySilhouette() {
  return (
    <g aria-hidden="true">
      <circle className="body-silhouette" cx="110" cy="45" r="24" />
      <path className="body-silhouette" d="M82 82 C95 74 125 74 138 82 L151 126 L139 236 L124 236 L116 405 L104 405 L96 236 L81 236 L69 126Z" />
      <path className="body-silhouette" d="M69 118 C49 142 37 177 43 215 L58 215 C54 183 61 155 76 132Z" />
      <path className="body-silhouette" d="M151 118 C171 142 183 177 177 215 L162 215 C166 183 159 155 144 132Z" />
    </g>
  );
}

function MuscleShape({ segment, load, target, selected, onToggle, theme }) {
  const visual = Math.max(load, target);
  const attrs = {
    ...segment.attrs,
    className: `muscle-shape ${target > 0 ? "target" : ""} ${selected ? "selected" : ""}`,
    style: {
      fill: muscleHeatColor(load, target, selected, theme),
      opacity: selected || target > 0 ? 0.86 : 0.2 + visual * 0.62,
    },
    onClick: () => onToggle?.(segment.muscle),
  };

  if (segment.type === "ellipse") return <ellipse {...attrs} />;
  if (segment.type === "rect") return <rect {...attrs} />;
  return <path {...attrs} />;
}

function MuscleBodyMap({
  muscleStatus,
  targetMuscles,
  selectedMuscles,
  onToggle,
  title = "Muscle Heatmap",
  subtitle = "Tap a region to inspect or add focus.",
  theme,
}) {
  const targetMap = targetMuscles ?? {};
  const targetIds = Object.keys(targetMap).filter((id) => targetMap[id] > 0);
  const selectedSet = new Set(selectedMuscles ?? []);
  const selectedIds = [...selectedSet];
  const preferredViewIds = targetIds.length ? targetIds : selectedIds;
  const [view, setView] = useState(defaultBodyViewForMuscles(preferredViewIds));
  const viewKey = preferredViewIds.join("|");

  useEffect(() => {
    if (preferredViewIds.length > 0) setView(defaultBodyViewForMuscles(preferredViewIds));
  }, [viewKey]);

  const labelIds = [...new Set([...targetIds, ...selectedIds])];
  const fallbackIds = MUSCLE_GROUPS
    .map((group) => ({ id: group.id, load: muscleStatus?.[group.id] ?? 0 }))
    .sort((a, b) => b.load - a.load)
    .filter((item) => item.load > 0.05)
    .slice(0, 4)
    .map((item) => item.id);
  const visibleLabels = (labelIds.length ? labelIds : fallbackIds).slice(0, 6);

  return (
    <div className="glass body-map-card">
      <div className="body-map-head">
        <div>
          <div className="body-map-title">{title}</div>
          <div className="body-map-sub">{subtitle}</div>
        </div>
        <div className="body-view-toggle" aria-label="Body view">
          {["front", "back"].map((side) => (
            <button
              key={side}
              type="button"
              className={`body-view-btn ${view === side ? "active" : ""}`}
              onClick={() => setView(side)}
            >
              {side}
            </button>
          ))}
        </div>
      </div>

      <div className="body-map-stage">
        <svg className="body-map-svg" viewBox="0 0 220 420" role="img" aria-label={`${view} muscle map`}>
          <BodySilhouette />
          {BODY_SEGMENTS[view].map((segment, idx) => (
            <MuscleShape
              key={`${segment.muscle}-${idx}`}
              segment={segment}
              load={Math.min(1, muscleStatus?.[segment.muscle] ?? 0)}
              target={Math.min(1, targetMap[segment.muscle] ?? 0)}
              selected={selectedSet.has(segment.muscle)}
              onToggle={onToggle}
              theme={theme}
            />
          ))}
        </svg>
      </div>

      {visibleLabels.length > 0 && (
        <div className="body-map-labels">
          {visibleLabels.map((id) => {
            const load = muscleStatus?.[id] ?? 0;
            const active = selectedSet.has(id) || targetMap[id] > 0;
            return (
              <span key={id} className={`focus-pill ${load > 0.66 ? "hot" : ""} ${active ? "active" : ""}`}>
                {MUSCLE_BY_ID[id]?.label ?? id}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function JourneyPanel({ profile }) {
  const sessions = profile?.sessionsCount ?? 0;
  const stages = [
    { label: "Seed", at: 0, copy: "Initialize profile" },
    { label: "Baseline", at: 3, copy: "Capture first form pattern" },
    { label: "Rhythm", at: 8, copy: "Build weekly consistency" },
    { label: "Control", at: 16, copy: "Reduce problem vectors" },
    { label: "Mastery", at: 28, copy: "Stabilize advanced load" },
  ];
  const activeIndex = stages.reduce((acc, stage, idx) => (sessions >= stage.at ? idx : acc), 0);
  const nextStage = stages[Math.min(activeIndex + 1, stages.length - 1)];
  const remaining = Math.max(0, nextStage.at - sessions);

  return (
    <motion.div className="glass journey-card" custom={6} variants={panelVariants} initial="hidden" animate="visible">
      <div className="journey-head">
        <div>
          <div className="journey-title">Journey Progress</div>
          <div className="journey-sub">
            {remaining > 0 ? `${remaining} sessions to ${nextStage.label}` : "Current phase stabilized"}
          </div>
        </div>
        <div className="journey-score">{sessions} S</div>
      </div>
      <div className="journey-stream">
        {stages.map((stage, idx) => (
          <motion.div
            key={stage.label}
            className={`journey-node ${idx < activeIndex ? "done" : ""} ${idx === activeIndex ? "active" : ""}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05, duration: 0.22 }}
          >
            <div className="journey-dot" />
            <div>
              <div className="journey-label">{stage.label}</div>
              <div className="journey-copy">{stage.copy}</div>
            </div>
            <div className="journey-mile">{stage.at}S</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Trakko AI Overlay ────────────────────────────────────────────────────────

function TrakkoOverlay({ screen, profile }) {
  const [visible, setVisible] = useState(false);
  const [showBubble, setShowBubble] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, [screen]);

  useEffect(() => {
    setVisible(false);
    setShowBubble(false);
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, [screen]);

  const line = typeof TRAKKO_LINES[screen] === "function"
    ? TRAKKO_LINES[screen](profile?.name || "Athlete")
    : TRAKKO_LINES[screen] || TRAKKO_LINES.dashboard(profile?.name || "Athlete");

  if (!visible) return null;

  return (
    <motion.div
      className="trakko-wrap"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
    >
      {showBubble && (
        <motion.div
          className="trakko-bubble"
          initial={{ opacity: 0, scale: 0.85, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ type: "spring", stiffness: 250, damping: 22 }}
        >
          {line}
        </motion.div>
      )}
      <div
        className="trakko-avatar"
        style={{ cursor: "pointer", pointerEvents: "auto" }}
        onClick={() => setShowBubble((v) => !v)}
        title="Kinetic AI"
      >
        <svg viewBox="0 0 20 24" width="17" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 11 C7 7 5.5 3 7 1.5 C8.5 0 9.5 2.5 9 7.5" />
          <path d="M13 11 C13 7 14.5 3 13 1.5 C11.5 0 10.5 2.5 11 7.5" />
          <ellipse cx="10" cy="16" rx="5" ry="4.5" />
          <circle cx="8.2" cy="15" r="0.75" fill="currentColor" stroke="none" />
          <circle cx="11.8" cy="15" r="0.75" fill="currentColor" stroke="none" />
          <path d="M9.4 17.2 Q10 17.8 10.6 17.2" strokeWidth="1.2" />
        </svg>
      </div>
    </motion.div>
  );
}

// ─── AuthScreen ───────────────────────────────────────────────────────────────

function AuthScreen({ onEnter, profile }) {
  const [name, setName] = useState(profile?.name || "");
  const trimmed = name.trim();

  return (
    <div className="screen-pad">
      <div className="auth-wrap">
        <div className="auth-logo-block">
          <div className="auth-logo-icon">
            <div className="auth-logo-mark" />
          </div>
          <div className="auth-logo-text">Aetheris</div>
          <div className="auth-logo-sub">Edge AI · Fitness Intelligence</div>
        </div>

        <div className="glass auth-card">
          <div className="auth-card-title">Identity Matrix</div>
          <div className="auth-card-sub">Initialize your neural fitness profile to begin.</div>
          <label className="ath-field-label" htmlFor="athlete-id">Athlete Designation</label>
          <input
            id="athlete-id"
            className="ath-input"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && trimmed && onEnter(trimmed)}
            autoFocus
          />
          <button
            className="btn-init"
            disabled={!trimmed}
            onClick={() => trimmed && onEnter(trimmed)}
          >
            Initialize Session
          </button>
        </div>

        <div>
          <div className="auth-stats">
            <div className="auth-stat">
              <div className="auth-stat-val">{profile?.sessionsCount ?? 0}</div>
              <div className="auth-stat-label">Sessions</div>
            </div>
            <div className="auth-stat">
              <div className="auth-stat-val">{profile?.averageForm ?? 0}%</div>
              <div className="auth-stat-label">Avg Form</div>
            </div>
            <div className="auth-stat">
              <div className="auth-stat-val">{profile?.streakDays ?? 0}</div>
              <div className="auth-stat-label">Day Streak</div>
            </div>
          </div>
          <div style={{ height: "1rem" }} />
          <div className="sys-label" style={{ textAlign: "center" }}>
            Powered by On-Device MediaPipe · Edge AI
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DashboardScreen ─────────────────────────────────────────────────────────

function DashboardScreen({ profile, onJumpIn, onPlan, onHomeWorkout, lastDevice }) {
  const readiness = Math.min(100, (profile?.sessionsCount ?? 0) * 4 + 60);

  return (
    <div className="screen-pad">
      <div className="dash-wrap">
        <div className="dash-header">
          <div>
            <div className="dash-greeting">Command Center</div>
            <div className="dash-name">{profile?.name ?? "Athlete"}</div>
          </div>
          <div className="readiness-chip">
            <div className="readiness-dot" />
            {readiness}% Ready
          </div>
        </div>

        <div className="stats-strip">
          <motion.div className="glass stat-chip" custom={0} variants={panelVariants} initial="hidden" animate="visible">
            <span className="stat-chip-val" style={{ fontFamily: "var(--mono)" }}>{profile?.sessionsCount ?? 0}</span>
            <span className="stat-chip-label">Sessions</span>
          </motion.div>
          <motion.div className="glass stat-chip" custom={1} variants={panelVariants} initial="hidden" animate="visible">
            <span className="stat-chip-val" style={{ fontFamily: "var(--mono)" }}>{profile?.averageForm ?? 0}%</span>
            <span className="stat-chip-label">Avg Form</span>
          </motion.div>
          <motion.div className="glass stat-chip" custom={2} variants={panelVariants} initial="hidden" animate="visible">
            <span className="stat-chip-val" style={{ fontFamily: "var(--mono)" }}>{profile?.streakDays ?? 0}</span>
            <span className="stat-chip-label">Streak</span>
          </motion.div>
        </div>

        <div className="bento-grid">
          <motion.div
            className="glass bento-hero"
            custom={3} variants={panelVariants} initial="hidden" animate="visible"
            onClick={onJumpIn}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.99 }}
          >
            <div className="bento-tag">Jump-In · Extreme Speed</div>
            <div className="bento-icon">JI</div>
            <div className="bento-label">Start Instantly</div>
          </motion.div>

          <motion.div
            className="glass bento-card"
            custom={4} variants={panelVariants} initial="hidden" animate="visible"
            onClick={onPlan}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <div className="bento-tag">AI Plan</div>
            <div className="bento-icon">AI</div>
            <div className="bento-label">Training Plan</div>
          </motion.div>

          <motion.div
            className="glass bento-card"
            custom={5} variants={panelVariants} initial="hidden" animate="visible"
            onClick={onHomeWorkout}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <div className="bento-tag">Home Mode</div>
            <div className="bento-icon">HM</div>
            <div className="bento-label">Home Workout</div>
          </motion.div>
        </div>

        <JourneyPanel profile={profile} />

        <motion.div className="glass" custom={7} variants={panelVariants} initial="hidden" animate="visible"
          style={{ padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}
        >
          <span className="bento-icon" style={{ width: 30, height: 30, fontSize: "0.58rem" }}>EN</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text)" }}>Edge Node Status</div>
            <div style={{ fontSize: "0.68rem", color: "var(--text-d)", marginTop: 2 }}>
              {lastDevice
                ? `Last: ${lastDevice.mode?.toUpperCase()} · ${new Date(lastDevice.connectedAt).toLocaleDateString()}`
                : "Configure device in Setup tab"}
            </div>
          </div>
          <div className={`sys-label-em${lastDevice ? "" : ""}`} style={lastDevice ? { color: "var(--em-b)" } : {}}>
            {lastDevice ? lastDevice.name : "Standby"}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── ConnectScreen ────────────────────────────────────────────────────────────

function ConnectScreen({ onConnected, onBack, exercise, connMode, deviceUrl, theme }) {
  const [connState, setConnState] = useState("idle");
  const [error, setError] = useState(null);

  const tryConnect = useCallback(async () => {
    setConnState("searching");
    setError(null);

    if (connMode === "ble") {
      if (!navigator.bluetooth) {
        setError("Web Bluetooth not supported on this browser. Use Chrome on Android/Desktop.");
        setConnState("idle");
        return;
      }
      try {
        const device = await navigator.bluetooth.requestDevice({
          filters: [{ namePrefix: "KineticLife-BLE" }],
          optionalServices: [BLE_SERVICE_UUID],
        });
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(BLE_SERVICE_UUID);
        const bleTxChar = await service.getCharacteristic(BLE_TX_UUID);
        const bleRxChar = await service.getCharacteristic(BLE_RX_UUID);
        const info = { mode: "ble", name: device.name ?? "KineticLife-BLE", id: device.id, bleTxChar, bleRxChar };
        saveLastDevice({ mode: "ble", name: info.name, id: info.id });
        setConnState("connected");
        setTimeout(() => onConnected(info), 1200);
      } catch (e) {
        if (e.name === "NotFoundError") {
          setError("No device selected. Tap Retry to scan again.");
        } else {
          setError(e.message || "BLE connection failed. Ensure device is powered on and in range.");
        }
        setConnState("idle");
      }
    } else {
      const base = (deviceUrl || "").replace(/\/+$/, "");
      try {
        const res = await fetch(`${base}/hello`, { signal: AbortSignal.timeout(4000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const info = { mode: "wifi", name: base.replace(/^https?:\/\//, ""), url: base };
        saveLastDevice({ mode: "wifi", name: info.name, url: info.url });
        setConnState("connected");
        setTimeout(() => onConnected(info), 1200);
      } catch {
        setError(`Cannot reach ${base}. Ensure camera is powered on and on the same network.`);
        setConnState("idle");
      }
    }
  }, [connMode, deviceUrl, onConnected]);

  useEffect(() => {
    const t = setTimeout(tryConnect, 400);
    return () => clearTimeout(t);
  }, [tryConnect]);

  return (
    <div className="screen-pad">
      <div className="connect-wrap">
        <div className="connect-header">
          <button className="back-btn" onClick={onBack}>←</button>
          <div>
            <h2 className="ath-title" style={{ fontSize: "1.2rem" }}>Neural Sync</h2>
            <div className="sys-label" style={{ marginTop: 2 }}>
              {exercise?.label ?? "Exercise"}
            </div>
          </div>
        </div>

        <div className="sphere-zone">
          <ParticleSphere connState={connState} theme={theme} />
          <div className="sphere-state-label">
            <div className="sphere-state-title">
              {connState === "idle" && "Standby"}
              {connState === "searching" && "Scanning Edge Nodes"}
              {connState === "connected" && "Lock Acquired"}
            </div>
            <div className={`sphere-state-sub ${connState === "connected" ? "em" : ""}`}>
              {connState === "idle" && "Ready to connect"}
              {connState === "searching" && (connMode === "ble"
                ? "Broadcasting KineticLife-BLE signal…"
                : `Pinging ${(deviceUrl || "").replace(/^https?:\/\//, "")}…`)}
              {connState === "connected" && `${connMode === "ble" ? "BLE" : "WiFi"} stream active · Entering session`}
            </div>
          </div>
        </div>

        <div className="connect-bottom">
          <div className="glass conn-status-row">
            <div className={`conn-dot ${connState}`} />
            <div className="conn-status-text">
              {connState === "idle" && "Tap Retry to connect"}
              {connState === "searching" && (connMode === "ble"
                ? "Searching for KineticLife-BLE device…"
                : `Reaching ${(deviceUrl || "").replace(/^https?:\/\//, "")}…`)}
              {connState === "connected" && (connMode === "ble"
                ? "BLE GATT stream active · Ready"
                : "WebSocket stream ready · Ready")}
            </div>
          </div>
          {error && (
            <div style={{ fontSize: "0.78rem", color: "var(--rd-a)", textAlign: "center", padding: "0.5rem" }}>
              {error}
            </div>
          )}
          {connState === "idle" && (
            <button
              onClick={tryConnect}
              style={{
                marginTop: "1rem", width: "100%", padding: "0.75rem",
                background: "rgba(var(--em-a-rgb),0.1)", border: "1px solid rgba(var(--em-a-rgb),0.3)",
                borderRadius: 12, color: "var(--em-a)", fontFamily: "var(--font)",
                fontSize: "0.88rem", fontWeight: 600, cursor: "pointer", letterSpacing: "0.04em",
              }}
            >
              Retry Connection
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AutoClassifyScreen ───────────────────────────────────────────────────────

function AutoClassifyScreen({ onClassified, onBack }) {
  const [progress, setProgress] = useState(0);
  const [detected, setDetected] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        const next = p + 3.4;
        if (next >= 100) {
          clearInterval(interval);
          const ex = EXERCISES[Math.floor(Math.random() * EXERCISES.length)];
          setDetected(ex);
          const t = setTimeout(() => onClassified(ex), 1200);
          return 100;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [onClassified]);

  return (
    <div className="screen-pad">
      <div className="connect-wrap">
        <div className="connect-header">
          <button className="back-btn" onClick={onBack}>←</button>
          <div>
            <h2 className="ath-title" style={{ fontSize: "1.2rem" }}>SVM Auto-Detect</h2>
            <div className="sys-label" style={{ marginTop: 2 }}>3-second kinematic scan</div>
          </div>
        </div>

        <div className="classify-wrap" style={{ flex: 1 }}>
          <div className="classify-ring">
            <div className="classify-inner">
              <div className="classify-pct">{Math.round(progress)}%</div>
              <div className="classify-label">Scanning</div>
            </div>
          </div>
          {detected ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              style={{ textAlign: "center" }}
            >
              <div className="sys-label-em">Exercise Detected</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 700, marginTop: "0.5rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {detected.label}
              </div>
            </motion.div>
          ) : (
            <div style={{ textAlign: "center" }}>
              <div className="sys-label">Analyzing joint trajectory vectors</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-d)", marginTop: "0.4rem" }}>
                Hold starting position…
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PlanConfigScreen ─────────────────────────────────────────────────────────

function PlanConfigScreen({ onBegin, onBack, muscleStatus, theme, onPlanGenerated }) {
  const [aiProfile, setAiProfile] = useState(() => loadAiCoreProfile());
  const [draft, setDraft] = useState(() => loadAiCoreProfile());
  const [focus, setFocus] = useState(() => new Set(loadAiCoreProfile().focusTags));
  const [editingCore, setEditingCore] = useState(false);
  const [selectedEx, setSelectedEx] = useState(EXERCISES[0]);
  const aiReady = isAiCoreProfileReady(aiProfile);
  const focusTags = [...focus];
  const aiDecision = generateAiCorePlan({ profile: aiProfile, muscleStatus, focusTags });
  const recommendedPlan = aiReady ? aiDecision.payload.exercises : AI_PLAN.map((item) => ({ ...item, reason: "Baseline demo plan" }));
  const targetMap = getExerciseTargets(selectedEx?.id);
  const selectedMuscles = [...new Set([...Object.keys(targetMap), ...focus])];
  const planKey = recommendedPlan.map((item) => item.exerciseId).join("|");

  useEffect(() => {
    if (!recommendedPlan.some((item) => item.exerciseId === selectedEx?.id)) {
      setSelectedEx(exerciseById(recommendedPlan[0]?.exerciseId ?? "squat"));
    }
  }, [planKey]);

  function toggleFocus(id) {
    const next = new Set(focus);
    next.has(id) ? next.delete(id) : next.add(id);
    setFocus(next);
    if (aiReady) {
      const updated = { ...aiProfile, focusTags: [...next], updatedAt: Date.now() };
      setAiProfile(updated);
      setDraft(updated);
      saveAiCoreProfile(updated);
    }
  }

  function updateDraft(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function toggleDraftTag(field, id) {
    setDraft((prev) => {
      const tags = new Set(prev[field] ?? []);
      tags.has(id) ? tags.delete(id) : tags.add(id);
      return { ...prev, [field]: [...tags] };
    });
  }

  function saveCoreProfile(event) {
    event.preventDefault();
    const updated = {
      ...draft,
      heightCm: Number(draft.heightCm) || "",
      weightKg: Number(draft.weightKg) || "",
      trainingDaysPerWeek: clamp(Number(draft.trainingDaysPerWeek) || 3, 1, 7),
      injuryTags: normalizeTags(draft.injuryTags),
      focusTags: normalizeTags(draft.focusTags),
      updatedAt: Date.now(),
    };
    setAiProfile(updated);
    setDraft(updated);
    setFocus(new Set(updated.focusTags));
    setEditingCore(false);
    saveAiCoreProfile(updated);
    const decision = generateAiCorePlan({ profile: updated, muscleStatus, focusTags: updated.focusTags });
    onPlanGenerated?.(decision);
  }

  return (
    <div className="screen-pad">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1.5rem 0 2rem", gap: "1rem", minHeight: 0, overflowY: "auto" }}>
        <div className="connect-header" style={{ paddingBottom: "0.5rem" }}>
          <button className="back-btn" onClick={onBack}>←</button>
          <h2 className="ath-title" style={{ fontSize: "1.2rem" }}>Training Plan</h2>
        </div>

        <motion.div className="glass plan-ai-card" custom={0} variants={panelVariants} initial="hidden" animate="visible">
          <div className="plan-ai-header">
            <span className="plan-ai-icon">KC</span>
            <div>
              <span className="plan-ai-title">Kinetic Core</span>
              <div className="ai-core-status">{aiReady ? aiDecision.action_keyword : "ONBOARDING_REQUIRED"}</div>
            </div>
          </div>
          <div className="ai-core-dialogue">
            {aiReady
              ? aiDecision.dialogue
              : "Complete the intake fields once. The demo agent will route AI Plan using recovery load, injuries, and focus tags."}
          </div>

          {(!aiReady || editingCore) && (
            <form className="ai-core-form" onSubmit={saveCoreProfile}>
              <div className="ai-core-form-grid">
                <label>
                  <span className="ath-field-label">Height</span>
                  <input className="ath-input" type="number" min="80" max="240" value={draft.heightCm} onChange={(e) => updateDraft("heightCm", e.target.value)} placeholder="cm" />
                </label>
                <label>
                  <span className="ath-field-label">Weight</span>
                  <input className="ath-input" type="number" min="25" max="250" value={draft.weightKg} onChange={(e) => updateDraft("weightKg", e.target.value)} placeholder="kg" />
                </label>
              </div>
              <label>
                <span className="ath-field-label">Training Frequency</span>
                <select className="ath-input" value={draft.trainingDaysPerWeek} onChange={(e) => updateDraft("trainingDaysPerWeek", e.target.value)}>
                  {[2, 3, 4, 5, 6].map((day) => <option key={day} value={day}>{day} days / week</option>)}
                </select>
              </label>
              <div className="ath-field-label">Injury Constraints</div>
              <div className="ai-chip-row">
                {AI_CORE_INJURY_OPTIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`ai-chip ${(draft.injuryTags ?? []).includes(item.id) ? "active warn" : ""}`}
                    onClick={() => toggleDraftTag("injuryTags", item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="ath-field-label">Focus Areas</div>
              <div className="ai-chip-row">
                {MUSCLE_GROUPS.filter((group) => ["Upper", "Arms", "Core", "Legs"].includes(group.group)).map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    className={`ai-chip ${(draft.focusTags ?? []).includes(group.id) ? "active" : ""}`}
                    onClick={() => toggleDraftTag("focusTags", group.id)}
                  >
                    {group.label}
                  </button>
                ))}
              </div>
              <div className="ai-core-actions">
                {aiReady && <button className="ai-core-reset" type="button" onClick={() => { setDraft(aiProfile); setEditingCore(false); }}>Cancel</button>}
                <button className="btn-init ai-core-save" type="submit">{aiReady ? "Update AI Plan" : "Initialize AI Plan"}</button>
              </div>
            </form>
          )}

          {aiReady && !editingCore && (
            <div className="ai-core-decision">
              <div>
                <div className="sys-label">Target Route</div>
                <div className="ai-core-route">{aiDecision.payload.target_muscle_group}</div>
              </div>
              <button className="ai-core-reset" onClick={() => { setDraft(aiProfile); setEditingCore(true); }}>Edit Profile</button>
            </div>
          )}

          {aiReady && !editingCore && (
            <div className="ai-chip-row">
              {aiDecision.payload.decisionTags.length ? aiDecision.payload.decisionTags.map((tag, index) => (
                <span key={`${tag.type}-${tag.label}-${index}`} className={`ai-chip readonly ${tag.type === "injury" || tag.type === "fatigue" ? "warn" : "active"}`}>
                  {tag.label}
                </span>
              )) : <span className="ai-chip readonly active">Balanced readiness</span>}
            </div>
          )}
        </motion.div>

        {aiReady && (
          <motion.div className="glass plan-ai-card" custom={1} variants={panelVariants} initial="hidden" animate="visible">
            <div className="plan-ai-header">
              <span className="plan-ai-icon">PL</span>
              <span className="plan-ai-title">AI Recommended Plan</span>
            </div>
          <div className="plan-list">
            {recommendedPlan.map((item) => {
              const ex = exerciseById(item.exerciseId);
              return (
              <div
                key={item.exerciseId}
                className={`plan-item ${selectedEx?.id === ex.id ? "sel" : ""}`}
                onClick={() => setSelectedEx(ex)}
              >
                <div className="plan-item-dot" />
                <div className="plan-item-main">
                  <div className="plan-item-name">{ex.label}</div>
                  <div className="plan-item-reason">{item.reason}</div>
                </div>
                <div className="plan-item-meta">{item.sets}x{item.targetReps}</div>
              </div>
              );
            })}
          </div>
          </motion.div>
        )}

        <motion.div custom={2} variants={panelVariants} initial="hidden" animate="visible">
          <MuscleBodyMap
            muscleStatus={muscleStatus}
            targetMuscles={targetMap}
            selectedMuscles={selectedMuscles}
            onToggle={toggleFocus}
            title="Target Muscle Map"
            subtitle={`${selectedEx?.label ?? "Exercise"} target preview. Tap regions to add AI focus.`}
            theme={theme}
          />
        </motion.div>

        <div className="spacer" />

        <div>
          <div className="sys-label" style={{ marginBottom: "0.5rem" }}>Selected Exercise</div>
          <div className="ex-grid" style={{ marginBottom: "1rem" }}>
            {EXERCISES.map((ex) => (
              <div
                key={ex.id}
                className={`ex-row ${selectedEx?.id === ex.id ? "sel" : ""}`}
                onClick={() => setSelectedEx(ex)}
              >
                <span className="ex-code">{ex.short}</span>
                <span className="ex-label">{ex.label}</span>
                <div className="ex-check">✓</div>
              </div>
            ))}
          </div>
          <button className="btn-init" onClick={() => onBegin(selectedEx)}>
            One-Tap Start →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── HomeCoachScreen ──────────────────────────────────────────────────────────

function HomeCoachScreen({ onBegin, onBack }) {
  const [bodyPart, setBodyPart] = useState(null);

  const parts = [
    { id: "upper", label: "Upper Body" },
    { id: "lower", label: "Lower Body" },
    { id: "core", label: "Core Focus" },
    { id: "full", label: "Full Body" },
  ];

  return (
    <div className="screen-pad">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1.5rem 0 2rem", gap: "1rem", minHeight: 0, overflowY: "auto" }}>
        <div className="connect-header" style={{ paddingBottom: "0.5rem" }}>
          <button className="back-btn" onClick={onBack}>←</button>
          <h2 className="ath-title" style={{ fontSize: "1.2rem" }}>Home Protocol</h2>
        </div>

        <div className="coach-wrap" style={{ flex: 1 }}>
          <div className="coach-avatar">K</div>
          <div className="coach-bubble">
            <div className="sys-label-em" style={{ marginBottom: "0.3rem" }}>Kinetic Coach</div>
            <div className="coach-text">
              {bodyPart
                ? `${parts.find((p) => p.id === bodyPart)?.label} selected. No equipment needed — body mechanics only.`
                : "Select your training focus for today. I'll guide your session."}
            </div>
          </div>

          <div style={{ width: "100%" }}>
            <div className="sys-label" style={{ marginBottom: "0.5rem" }}>Target Area</div>
            <div className="body-focus-grid">
              {parts.map((p) => (
                <button
                  key={p.id}
                  className={`body-focus-btn ${bodyPart === p.id ? "sel" : ""}`}
                  onClick={() => setBodyPart(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          className="btn-init"
          disabled={!bodyPart}
          onClick={() => onBegin(EXERCISES[0])}
        >
          Start Home Session →
        </button>
      </div>
    </div>
  );
}

// ─── LiveScreen ───────────────────────────────────────────────────────────────

function LiveScreen({ exercise, onFinish, onVisualState, iotConnRef, theme }) {
  const [reps, setReps] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [hint, setHint] = useState(null);
  const [dtw, setDtw] = useState(0.5);
  const [repCharge, setRepCharge] = useState({ value: 0, resetting: false });
  const [isReady, setIsReady] = useState(false);
  const autoMode = !exercise?.id;
  const [autoActionRows, setAutoActionRows] = useState([]);
  const [autoRepGate, setAutoRepGate] = useState(() => ({
    exerciseId: exercise?.id ?? null,
    confirmed: exercise?.id ? AUTO_REP_CONFIRMATIONS_REQUIRED : 0,
    required: AUTO_REP_CONFIRMATIONS_REQUIRED,
  }));
  const [classification, setClassification] = useState(() => ({
    id: exercise?.id ?? null,
    confidence: exercise?.id ? 100 : 0,
    status: exercise?.id ? "manual" : "scanning",
  }));
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const keyAnglesRef = useRef([]);
  const classificationRef = useRef(classification);
  const repsByExerciseRef = useRef({});
  const autoActionRowsRef = useRef([]);
  const classifierStatsRef = useRef(makeAutoClassifierState());

  const auroraClass = dtw > 0.85 ? "good" : dtw < 0.65 ? "warn" : "";
  const repProgress = repCharge.value;
  const repProgressPct = Math.round(repProgress * 100);
  const repNearComplete = repProgress >= 0.78;
  const repLocked = repProgress >= 0.92;
  const activeExercise = classification.id ? exerciseById(classification.id) : null;
  const autoCountingReady = !autoMode || autoRepGate.confirmed >= autoRepGate.required;
  const sessionLabel = autoMode
    ? activeExercise?.label ?? "Unassigned Motion"
    : exercise?.label ?? "Exercise";

  useEffect(() => {
    classificationRef.current = classification;
  }, [classification]);

  useEffect(() => {
    const good = dtw > 0.85;
    const warn = dtw < 0.65;
    onVisualState?.(good ? "live_good" : warn ? "live_warning" : "idle");
  }, [dtw, onVisualState]);

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Camera stream + MediaPipe pipeline ────────────────────────────────────
  useEffect(() => {
    const conn = iotConnRef?.current;
    if (!conn) return;

    let cancelled = false;
    let streamCleanup = () => {};
    keyAnglesRef.current = [];         // reset buffer on each Live mount
    repsByExerciseRef.current = {};
    classifierStatsRef.current = makeAutoClassifierState();
    let angleFrameN = 0;
    const autoConfirmationsByExercise = {};

    // ── Per-frame mutable closure state ───────────────────────────────────────
    let landmarker   = null;  // set after MP loads
    let smoother     = null;
    let drawSkeleton = null;
    let drawAngle    = null;
    let exRules      = null;
    let exMap        = null;
    let activeExerciseId = exercise?.id ?? null;
    let repPhase     = "rest";
    let consecErrFrames = 0;
    let processing   = false; // one frame at a time
    let hintTimer    = null;
    let hudFrame     = 0;
    let highDtwStreak = 0;
    let comboActive  = false;
    let lastDtwScore = 0.5;
    let lastDtwUiAt = 0;
    let lastDtwUiValue = 0.5;
    let targetProgress = 0;
    let lastProgressUiAt = 0;
    let lastProgressUiValue = 0;
    let chargeProgress = 0;
    let chargeLocked = false;
    let chargeResetTimer = null;
    let lastGateUiKey = "";
    let lastRowsUiKey = "";
    let lastRowsUiAt = 0;
    const ERR_DEBOUNCE = 4;

    const inferCanvas = document.createElement("canvas");
    inferCanvas.width = 120; inferCanvas.height = 160;
    const inferCtx = inferCanvas.getContext("2d", { willReadFrequently: true });
    let _mpTs = 0;
    const nextMpTs = () => { _mpTs = Math.max(performance.now(), _mpTs + 1); return _mpTs; };

    // ── Lens undistortion (theta-based fisheye, calibrated 2026-05-22) ──────
    // 140° wide-angle OV5647: k1=-0.38 k2=0.18 fx=fy=250 cx=60 cy=80
    const _D = { k1:-0.38, k2:0.18, k3:0, p1:0, p2:0, fx:250, fy:250, cx:60, cy:80 };
    const _undistCanvas = document.createElement("canvas");
    _undistCanvas.width = 120; _undistCanvas.height = 160;
    const _undistCtx = _undistCanvas.getContext("2d", { willReadFrequently: true });
    const _distLUT = (() => {
      const { k1,k2,k3,p1,p2,fx,fy,cx,cy } = _D;
      const lut = new Float32Array(120 * 160 * 2);
      for (let v = 0; v < 160; v++) {
        for (let u = 0; u < 120; u++) {
          const xn=(u-cx)/fx, yn=(v-cy)/fy;
          const r=Math.sqrt(xn*xn+yn*yn), idx=(v*120+u)*2;
          if (r < 1e-8) { lut[idx]=u; lut[idx+1]=v; continue; }
          const th=Math.atan(r), t2=th*th, t4=t2*t2, t6=t2*t4;
          const td=th*(1+k1*t2+k2*t4+k3*t6), sc=td/r;
          const r2=xn*xn+yn*yn;
          lut[idx]   = (xn*sc + 2*p1*xn*yn + p2*(r2+2*xn*xn))*fx + cx;
          lut[idx+1] = (yn*sc + p1*(r2+2*yn*yn) + 2*p2*xn*yn)*fy + cy;
        }
      }
      return lut;
    })();
    function _applyDistLUT() {
      const src = inferCtx.getImageData(0, 0, 120, 160);
      const dst = new ImageData(120, 160);
      for (let v = 0; v < 160; v++) {
        for (let u = 0; u < 120; u++) {
          const li=(v*120+u)*2, sx=_distLUT[li], sy=_distLUT[li+1];
          const x0=sx|0, y0=sy|0, x1=x0+1, y1=y0+1, di=(v*120+u)*4;
          if (x0>=0 && x1<120 && y0>=0 && y1<160) {
            const dx=sx-x0, dy=sy-y0;
            const w00=(1-dx)*(1-dy), w10=dx*(1-dy), w01=(1-dx)*dy, w11=dx*dy;
            for (let c=0;c<3;c++) dst.data[di+c]=(src.data[(y0*120+x0)*4+c]*w00+src.data[(y0*120+x1)*4+c]*w10+src.data[(y1*120+x0)*4+c]*w01+src.data[(y1*120+x1)*4+c]*w11)+0.5|0;
            dst.data[di+3]=255;
          }
        }
      }
      _undistCtx.putImageData(dst, 0, 0);
    }
    function getAutoConfirmations(id) {
      if (!autoMode || !id) return AUTO_REP_CONFIRMATIONS_REQUIRED;
      return Math.min(AUTO_REP_CONFIRMATIONS_REQUIRED, autoConfirmationsByExercise[id] ?? 0);
    }
    function autoDisplayProgress(id, movementValue) {
      if (!autoMode || !id) return movementValue;
      const confirmed = getAutoConfirmations(id);
      if (confirmed >= AUTO_REP_CONFIRMATIONS_REQUIRED) return movementValue;
      return Math.min(0.99, (confirmed + Math.max(0, Math.min(1, movementValue))) / AUTO_REP_CONFIRMATIONS_REQUIRED);
    }
    function publishAutoGate(id, movementValue = 0) {
      if (!autoMode) return;
      const confirmed = getAutoConfirmations(id);
      const key = `${id ?? "none"}:${confirmed}:${Math.round(movementValue * 20)}`;
      if (key === lastGateUiKey) return;
      lastGateUiKey = key;
      setAutoRepGate({
        exerciseId: id ?? null,
        confirmed,
        required: AUTO_REP_CONFIRMATIONS_REQUIRED,
      });
    }
    function publishAutoActionRow(id, movementValue = 0, force = false) {
      if (!autoMode || !id) return;
      const ex = exerciseById(id);
      const confirmed = getAutoConfirmations(id);
      const progress = autoDisplayProgress(id, movementValue);
      const existingRows = autoActionRowsRef.current;
      const previous = existingRows.find((row) => row.exerciseId === id);
      const row = {
        exerciseId: id,
        label: ex.label,
        short: ex.short,
        reps: repsByExerciseRef.current[id] ?? 0,
        progress,
        confirmed,
        required: AUTO_REP_CONFIRMATIONS_REQUIRED,
        active: true,
        confidence: classificationRef.current.id === id
          ? classificationRef.current.confidence
          : previous?.confidence ?? 0,
      };
      const nextRows = [
        row,
        ...existingRows
          .filter((item) => item.exerciseId !== id)
          .map((item) => ({ ...item, active: false })),
      ];
      const key = nextRows
        .map((item) => `${item.exerciseId}:${item.reps}:${item.confirmed}:${Math.round(item.progress * 100)}:${item.active ? 1 : 0}`)
        .join("|");
      const nowUi = performance.now();
      if (!force && key === lastRowsUiKey) return;
      if (!force && nowUi - lastRowsUiAt < 110) return;
      lastRowsUiKey = key;
      lastRowsUiAt = nowUi;
      autoActionRowsRef.current = nextRows;
      setAutoActionRows(nextRows);
    }
    const enc = new TextEncoder();

    // Single frame handler: display raw feed + inference in one pass
    async function onFrame(blob) {
      if (processing || cancelled) return;
      processing = true;
      try {
        let bmp;
        try { bmp = await createImageBitmap(blob); } catch { return; }

        const canvas = canvasRef.current;
        if (!canvas) { bmp.close(); return; }
        const W = canvas.offsetWidth || 300, H = canvas.offsetHeight || 400;
        if (canvas.width !== W) canvas.width = W;
        if (canvas.height !== H) canvas.height = H;
        const ctx = canvas.getContext("2d");

        setIsReady(true); // first frame → hide placeholder

        hudFrame += 1;

        // ── Background — raw feed hidden. Combo mode leaves a HUD motion trail.
        const lsc = (THEME_COLORS[theme] ?? THEME_COLORS.deep_space).skeleton;
        if (!comboActive) ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = comboActive ? lsc.bgCombo : lsc.bg;
        ctx.fillRect(0, 0, W, H);

        // ── MediaPipe inference (skips silently until landmarker ready) ──────
        if (landmarker && smoother && drawSkeleton && exMap) {
          // Rotate source into portrait inferCanvas — raw BLE frame is landscape (person sideways)
          // vflip=1 corrects up/down on device; software +90° here corrects the 90° axis for MP
          inferCtx.clearRect(0, 0, 120, 160);
          inferCtx.save();
          inferCtx.translate(120, 0);
          inferCtx.rotate(Math.PI / 2);
          inferCtx.drawImage(bmp, 0, 0, 160, 120);
          inferCtx.restore();

          _applyDistLUT();
          const result = landmarker.detectForVideo(_undistCanvas, nextMpTs());
          if (result.landmarks?.length) {
            const rawLm    = result.landmarks[0];
            const smoothLm  = smoother.smooth(rawLm);
            // Keep head up: if nose is below hip midpoint (camera upside-down), flip y
            const noseY    = smoothLm[0]?.y ?? 0;
            const hipMidY  = ((smoothLm[23]?.y ?? 0) + (smoothLm[24]?.y ?? 0)) / 2;
            const flipped  = noseY > hipMidY + 0.05; // +0.05 dead-zone avoids spurious flip
            const displayLm = flipped ? smoothLm.map(p => ({ ...p, y: 1 - p.y })) : smoothLm;
            const now = performance.now();

            if (autoMode) {
              const nextClass = classifyMotionWindow(classifierStatsRef.current, rawLm, exMap, now);
              if (nextClass.id !== activeExerciseId) {
                activeExerciseId = nextClass.id;
                exRules = activeExerciseId ? exMap[activeExerciseId] : null;
                repPhase = "rest";
                chargeProgress = 0;
                chargeLocked = false;
                const carryProgress = autoDisplayProgress(activeExerciseId, 0);
                lastProgressUiValue = carryProgress;
                setRepCharge({ value: carryProgress, resetting: false });
                publishAutoGate(activeExerciseId, 0);
                publishAutoActionRow(activeExerciseId, 0, true);
              }
              const uiClass = {
                id: activeExerciseId,
                confidence: nextClass.confidence,
                status: activeExerciseId ? "matched" : nextClass.status,
              };
              const prev = classificationRef.current;
              if (prev.id !== uiClass.id || prev.status !== uiClass.status || Math.abs(prev.confidence - uiClass.confidence) >= 4) {
                classificationRef.current = uiClass;
                setClassification(uiClass);
              }
            }

            const activeRules = activeExerciseId ? exMap[activeExerciseId] : exRules;
            const errorBoneSet = new Set();
            if (activeRules) {
              // Rep state machine
              const keyAngle = activeRules.getKeyAngle(rawLm);
              // Sample for post-session chart (1 per 3 frames, max 300 pts)
              if (++angleFrameN % 3 === 0 && keyAnglesRef.current.length < 300) {
                keyAnglesRef.current.push(Math.round(keyAngle));
              }
              targetProgress = movementProgress(activeExerciseId, keyAngle);
              publishAutoGate(activeExerciseId, chargeProgress);
              publishAutoActionRow(activeExerciseId, chargeProgress);
              if (!chargeLocked) {
                chargeProgress = Math.max(chargeProgress, targetProgress);
                const displayCharge = autoDisplayProgress(activeExerciseId, chargeProgress);
                publishAutoActionRow(activeExerciseId, chargeProgress);
                if (chargeProgress >= 0.98) {
                  chargeLocked = true;
                  chargeProgress = 1;
                  const lockedDisplayCharge = autoDisplayProgress(activeExerciseId, 1);
                  lastProgressUiAt = now;
                  lastProgressUiValue = lockedDisplayCharge;
                  setRepCharge({ value: lockedDisplayCharge, resetting: false });
                  publishAutoActionRow(activeExerciseId, 1, true);
                  if (chargeResetTimer) clearTimeout(chargeResetTimer);
                  if (!autoMode || getAutoConfirmations(activeExerciseId) >= AUTO_REP_CONFIRMATIONS_REQUIRED) {
                    chargeResetTimer = setTimeout(() => {
                      lastProgressUiValue = 0;
                      setRepCharge({ value: 0, resetting: true });
                    }, 260);
                  }
                } else if (now - lastProgressUiAt > 110 && Math.abs(displayCharge - lastProgressUiValue) > 0.018) {
                  lastProgressUiAt = now;
                  lastProgressUiValue = displayCharge;
                  setRepCharge({ value: displayCharge, resetting: false });
                }
              } else if (targetProgress < 0.25) {
                chargeLocked = false;
                chargeProgress = 0;
                const displayCharge = autoDisplayProgress(activeExerciseId, 0);
                if (now - lastProgressUiAt > 110 && Math.abs(displayCharge - lastProgressUiValue) > 0.018) {
                  lastProgressUiAt = now;
                  lastProgressUiValue = displayCharge;
                  setRepCharge({ value: displayCharge, resetting: false });
                  publishAutoActionRow(activeExerciseId, 0);
                }
              }
              if (repPhase === "rest" && activeRules.workCond(keyAngle)) repPhase = "work";
              else if (repPhase === "work" && activeRules.restCond(keyAngle)) {
                repPhase = "rest";
                let shouldCountRep = Boolean(activeExerciseId);
                if (autoMode && activeExerciseId) {
                  const confirmed = getAutoConfirmations(activeExerciseId);
                  shouldCountRep = confirmed >= AUTO_REP_CONFIRMATIONS_REQUIRED;
                  if (!shouldCountRep) {
                    autoConfirmationsByExercise[activeExerciseId] = Math.min(AUTO_REP_CONFIRMATIONS_REQUIRED, confirmed + 1);
                    publishAutoGate(activeExerciseId, 0);
                    publishAutoActionRow(activeExerciseId, 0, true);
                    const displayCharge = autoDisplayProgress(activeExerciseId, 0);
                    lastProgressUiValue = displayCharge;
                    setRepCharge({ value: displayCharge, resetting: false });
                  } else {
                    lastProgressUiValue = 0;
                    setRepCharge({ value: 0, resetting: true });
                  }
                }
                if (shouldCountRep && activeExerciseId) {
                  repsByExerciseRef.current[activeExerciseId] = (repsByExerciseRef.current[activeExerciseId] ?? 0) + 1;
                  publishAutoActionRow(activeExerciseId, 0, true);
                  setReps((r) => { if (navigator.vibrate) navigator.vibrate(50); return r + 1; });
                }
              }

            // Form checks
            const activeHints  = [];
            let frameErr = false;
            for (const check of (activeRules.checks ?? [])) {
              if (!check.valid(check.getVal(rawLm), repPhase)) {
                check.bones.forEach(([a, b]) => errorBoneSet.add(`${Math.min(a,b)}_${Math.max(a,b)}`));
                activeHints.push(check.hint);
                frameErr = true;
              }
            }
            consecErrFrames = frameErr ? Math.min(consecErrFrames + 1, ERR_DEBOUNCE) : 0;
            if (consecErrFrames >= ERR_DEBOUNCE && activeHints.length) {
              setHint(activeHints[0]);
              if (hintTimer) clearTimeout(hintTimer);
                hintTimer = setTimeout(() => setHint(null), 3000);
            }
            lastDtwScore = frameErr ? 0.35 + Math.random() * 0.2 : 0.75 + Math.random() * 0.2;
            highDtwStreak = lastDtwScore > 0.88 ? Math.min(6, highDtwStreak + 1) : Math.max(0, highDtwStreak - 1);
            comboActive = highDtwStreak >= 3;
            if (now - lastDtwUiAt > 180 || Math.abs(lastDtwScore - lastDtwUiValue) > 0.08) {
              lastDtwUiAt = now;
              lastDtwUiValue = lastDtwScore;
              setDtw(lastDtwScore);
            }
            } else {
              targetProgress = 0;
              chargeProgress = Math.max(0, chargeProgress * 0.92);
              if (performance.now() - lastProgressUiAt > 180 && lastProgressUiValue !== 0) {
                lastProgressUiAt = performance.now();
                lastProgressUiValue = 0;
                setRepCharge({ value: 0, resetting: false });
              }
            }

            // vidTransform: map inferCanvas (120×160) to the display region
            const effW = 120;
            const effH = 160;
            const skScale = Math.max(W / effW, H / effH);
            const sdw = effW * skScale, sdh = effH * skScale;
            const vt = { dx: (W-sdw)/2, dy: (H-sdh)/2, dw: sdw, dh: sdh };
            const hudOpts = {
              dtw: lastDtwScore,
              comboActive,
              frame: hudFrame,
              targetProgress,
              errorBoneSet,
              keyJoints: (activeRules?.displayAngles ?? []).map((angle) => angle.joint).filter((joint) => joint != null),
              colors: (THEME_COLORS[theme] ?? THEME_COLORS.deep_space).renderer,
            };
            drawSkeleton(ctx, vt, displayLm, errorBoneSet, hudOpts);
            if (drawAngle && activeRules?.displayAngles?.length) drawAngle(ctx, vt, displayLm, activeRules, hudOpts);
          }
        }

        bmp.close();
      } finally {
        processing = false;
      }
    }

    // ── Start camera stream immediately (raw feed before MP loads) ────────────
    if (conn.mode === "ble" && conn.bleTxChar && conn.bleRxChar) {
      const tx = conn.bleTxChar;
      const rx = conn.bleRxChar;
      const frame = { expected: 0, received: 0, chunks: [] };

      function onPacket(e) {
        const val = e.target.value;
        const bytes = new Uint8Array(val.buffer, val.byteOffset, val.byteLength);
        if (bytes.length >= 4 && bytes[0] === 67 && bytes[1] === 65 && bytes[2] === 77 && bytes[3] === 58) {
          const parts = new TextDecoder().decode(bytes).split(":");
          frame.expected = Number(parts[2]) || 0; frame.received = 0; frame.chunks = [];
          return;
        }
        if (!frame.expected) return;
        const needed = frame.expected - frame.received;
        const chunk = bytes.length > needed ? bytes.slice(0, needed) : bytes.slice();
        frame.chunks.push(chunk);
        frame.received += chunk.byteLength;
        if (frame.received < frame.expected) return;
        onFrame(new Blob(frame.chunks, { type: "image/jpeg" }));
        frame.expected = 0; frame.received = 0; frame.chunks = [];
      }

      const bleWrite = (cmd) => {
        const d = enc.encode(cmd);
        return rx.writeValueWithoutResponse ? rx.writeValueWithoutResponse(d) : rx.writeValue(d);
      };

      // BLE cam params: mirror debug.html FW_BLE defaults, tested 160×120/q30/vflip=1
      const BLE_CAM = [
        "size=180", "gap=12",
        "res=160x120", "q=25",
        "brightness=0", "contrast=1", "saturation=0", "sharpness=10",
        "ae_level=0", "vflip=1", "hmirror=0",
        "cam=0",
      ];
      BLE_CAM.reduce((p, cmd) => p.then(() => bleWrite(cmd)), tx.startNotifications().then(() => {
        tx.addEventListener("characteristicvaluechanged", onPacket);
      })).catch((e) => console.error("[LiveScreen] BLE start:", e));

      streamCleanup = () => {
        tx.removeEventListener("characteristicvaluechanged", onPacket);
        bleWrite("stop").catch(() => {});
        if (hintTimer) clearTimeout(hintTimer);
      };

    } else if (conn.mode === "wifi" && conn.url) {
      // Apply cam params via HTTP before streaming — mirror debug.html FW_WIFI defaults, q=25/vflip=1
      const WIFI_CAM = "res=320x240&q=25&brightness=0&contrast=1&saturation=0&sharpness=1&ae_level=0&vflip=1&hmirror=0";
      fetch(`${conn.url}/cam?${WIFI_CAM}`, { signal: AbortSignal.timeout(3000) }).catch(() => {});
      const wsUrl = conn.url.replace(/^http(s?):\/\//i, (_, s) => `ws${s}://`) + "/ws";
      const sock = new WebSocket(wsUrl);
      sock.binaryType = "arraybuffer";
      sock.onmessage = ({ data }) => onFrame(new Blob([data], { type: "image/jpeg" }));
      sock.onerror   = () => console.error("[LiveScreen] WS error");
      streamCleanup  = () => { sock.close(); if (hintTimer) clearTimeout(hintTimer); };
    }

    // ── Load MediaPipe + libs in parallel (never blocks raw feed) ────────────
    async function loadMP() {
      const [{ EXERCISES: EX_MAP }, { createSmoother }, { drawSkeleton: ds, drawAngleOnCanvas: da }] = await Promise.all([
        import("../../lib/exercise-rules.js"),
        import("../../lib/landmark-smoothing.js"),
        import("../../lib/pose-renderer.js"),
      ]);
      if (cancelled) return;
      exMap        = EX_MAP;
      exRules      = exercise?.id ? EX_MAP[exercise.id] : null;
      smoother     = createSmoother(0.45);
      drawSkeleton = ds;
      drawAngle    = da;

      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      const lm = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "/mediapipe/models/pose_landmarker_lite.task", delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      if (cancelled) { lm.close(); return; }
      landmarker = lm;
      landmarkerRef.current = lm;
    }

    loadMP().catch((e) => console.error("[LiveScreen] MP load:", e));

    return () => {
      cancelled = true;
      streamCleanup();
      if (chargeResetTimer) clearTimeout(chargeResetTimer);
      if (landmarkerRef.current) { try { landmarkerRef.current.close(); } catch {} landmarkerRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="live-root">
      <div className="cam-area">
        <div className={`cam-aurora ${auroraClass}`} />
        {!isReady && (
          <div className="cam-placeholder" style={{ position: "relative", zIndex: 2 }}>
            <div className="cam-placeholder-icon">CAM</div>
            <p>Live sensor feed</p>
            <p style={{ fontSize: "0.68rem", opacity: 0.5 }}>Configure in Setup · BLE primary</p>
          </div>
        )}
        <canvas ref={canvasRef} className="cam-canvas" />
        <div className="cam-overlay">
          <div className="cam-corner tl" />
          <div className="cam-corner tr" />
          <div className="cam-corner bl" />
          <div className="cam-corner br" />
          <div className="live-badge">
            <div className="live-dot" />
            LIVE
          </div>
          <div className="dtw-badge">
            DTW {Math.round(dtw * 100)}%
          </div>
          {autoMode && (
            <div className={`classify-badge ${classification.id ? "" : "unassigned"}`}>
              <span className="classify-dot" />
              <span className="classify-text">
                {classification.id
                  ? `${activeExercise?.short ?? "AI"} · ${Math.round(classification.confidence)}%`
                  : "Unassigned"}
              </span>
            </div>
          )}
          {hint && (
            <div className="form-hint">
              <div className="hint-pill">{hint}</div>
            </div>
          )}
        </div>
      </div>
      {autoMode ? (
        <div className="action-rep-stack" aria-label="Detected action rep counters">
          {autoActionRows.length ? autoActionRows.map((row) => {
            const rowPct = Math.round((row.progress ?? 0) * 100);
            const rowNear = row.progress >= 0.78;
            const rowLocked = row.progress >= 0.92;
            const rowReady = row.confirmed >= row.required;
            return (
              <div
                key={row.exerciseId}
                className={`rep-hud action-rep-hud ${row.active ? "active" : ""} ${rowNear ? "near" : ""} ${rowLocked ? "locked" : ""}`}
              >
                <div className="rep-hud-top">
                  <div className="rep-counter">
                    <div className="rep-num">{row.reps}</div>
                    <div>
                      <div className="action-title">{row.label}</div>
                      <div className="action-sub">{row.short} · {row.active ? "Active" : "Buffered"}</div>
                      {!rowReady && (
                        <div className="rep-gate-label">Confirm {row.confirmed}/{row.required}</div>
                      )}
                    </div>
                  </div>
                  <div className="rep-progress-readout">{rowPct}%</div>
                </div>
                <div className="rep-progress-track" aria-label={`${row.label} movement progress`}>
                  <div className="rep-progress-fill" style={{ width: `${rowPct}%` }} />
                </div>
              </div>
            );
          }) : (
            <div className="action-empty">Waiting for library motion</div>
          )}
        </div>
      ) : (
        <div className={`rep-hud ${repNearComplete ? "near" : ""} ${repLocked ? "locked" : ""} ${repCharge.resetting ? "resetting" : ""}`}>
          <div className="rep-hud-top">
            <div className="rep-counter">
              <div className="rep-num">{reps}</div>
              <div>
                <div className="rep-label">Reps</div>
              </div>
            </div>
            <div className="rep-progress-readout">{repProgressPct}%</div>
          </div>
          <div className="rep-progress-track" aria-label="Movement progress">
            <div className="rep-progress-fill" style={{ width: `${repProgressPct}%` }} />
            {Array.from({ length: 8 }, (_, i) => {
              const x = Math.max(6, Math.min(96, repProgressPct - 4 + i * 1.15));
              return (
                <span
                  key={i}
                  className="rep-particle"
                  style={{ "--x": `${x}%`, "--delay": `${i * 0.11}s` }}
                />
              );
            })}
          </div>
        </div>
      )}
      <div className="session-bar">
        <div className="session-meta">
          <span className="session-ex-label">{autoMode ? `AUTO · ${sessionLabel}` : sessionLabel}</span>
          <span className="session-timer">{fmt(elapsed)}</span>
        </div>
        <button className="finish-btn" onClick={() => onFinish({
          reps, elapsed, dtw,
          keyAngles: keyAnglesRef.current.slice(),
          exerciseId: classificationRef.current.id,
          classification: {
            mode: autoMode ? "auto" : "manual",
            exerciseId: classificationRef.current.id,
            confidence: classificationRef.current.confidence,
            status: classificationRef.current.id ? "assigned" : "unassigned",
            repsByExercise: { ...repsByExerciseRef.current },
            actionRows: autoActionRowsRef.current.map((row) => ({
              exerciseId: row.exerciseId,
              reps: row.reps,
              confirmed: row.confirmed,
              required: row.required,
            })),
            stats: {
              totalFrames: classifierStatsRef.current.totalFrames,
              classifiedFrames: classifierStatsRef.current.classifiedFrames,
              unknownFrames: classifierStatsRef.current.unknownFramesTotal,
              switches: classifierStatsRef.current.switches,
            },
          },
        })}>
          END SESSION
        </button>
      </div>
    </div>
  );
}

// ─── AnalysisScreen ───────────────────────────────────────────────────────────

// ─── DtwChart ─────────────────────────────────────────────────────────────────
const ANGLE_RANGES = {
  squat:         { min: 75,  max: 170, rest: 158, work: 85  },
  bicep_curl:    { min: 15,  max: 160, rest: 152, work: 28  },
  right_bicep_curl: { min: 15, max: 160, rest: 152, work: 28 },
  lateral_raise: { min: 10,  max: 95,  rest: 22,  work: 78  },
  squat_side: { min: 75, max: 170, rest: 158, work: 88 },
  barbell_squat_side: { min: 75, max: 170, rest: 158, work: 88 },
  deadlift_side: { min: 90, max: 175, rest: 165, work: 108 },
  push_up_side: { min: 55, max: 170, rest: 155, work: 82 },
};

function buildReference(exerciseId, numPts, reps) {
  const { rest, work } = ANGLE_RANGES[exerciseId] ?? ANGLE_RANGES.squat;
  const period = numPts / Math.max(1, reps);
  return Array.from({ length: numPts }, (_, i) => {
    const t = Math.sin(((i % period) / period) * Math.PI);
    return rest + (work - rest) * t;
  });
}

function easeInOutQuart(t) {
  return t < 0.5 ? 8*t*t*t*t : 1 - Math.pow(-2*t+2, 4)/2;
}

function DtwChart({ keyAngles, exerciseId, reps, theme }) {
  const canvasRef = useRef(null);
  const exId = exerciseId ?? "squat";
  const hasUser = keyAngles?.length > 4;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width  = canvas.offsetWidth  || 300;
    const H = canvas.height = 130;
    const ctx = canvas.getContext("2d");
    const { min: yMin, max: yMax } = ANGLE_RANGES[exId] ?? ANGLE_RANGES.squat;

    const numPts = hasUser ? keyAngles.length : 80;
    const ref    = buildReference(exId, numPts, Math.max(1, reps ?? 1));
    const user   = hasUser ? keyAngles : [];

    const toX = (i) => (i / (numPts - 1)) * W;
    const toY = (v) => H - 8 - ((Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin)) * (H - 16);

    const DURATION = 1300;
    const USER_DELAY = 140;
    const start = performance.now();
    let raf;

    function draw(now) {
      const elapsed = now - start;
      const refProg  = easeInOutQuart(Math.min(1, elapsed / DURATION));
      const userProg = easeInOutQuart(Math.min(1, Math.max(0, elapsed - USER_DELAY) / DURATION));

      const cc = (THEME_COLORS[theme] ?? THEME_COLORS.deep_space).chart;
      ctx.clearRect(0, 0, W, H);

      // Grid lines
      ctx.strokeStyle = cc.grid;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      for (let i = 0; i <= 3; i++) {
        const y = 8 + (i / 3) * (H - 16);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.setLineDash([]);

      // Reference curve (ideal)
      const refEnd = Math.floor(refProg * (numPts - 1));
      if (refEnd >= 1) {
        ctx.save();
        ctx.globalAlpha = 0.38;
        ctx.strokeStyle = cc.ref;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(toX(0), toY(ref[0]));
        for (let i = 1; i <= refEnd; i++) ctx.lineTo(toX(i), toY(ref[i]));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // User curve (glowing)
      if (user.length >= 2) {
        const userEnd = Math.floor(userProg * (user.length - 1));
        if (userEnd >= 1) {
          ctx.save();
          ctx.shadowColor = cc.glow;
          ctx.shadowBlur  = 10;
          ctx.strokeStyle = cc.user;
          ctx.lineWidth   = 2.5;
          ctx.lineJoin    = "round";
          ctx.beginPath();
          ctx.moveTo(toX(0), toY(user[0]));
          for (let i = 1; i <= userEnd; i++) ctx.lineTo(toX(i), toY(user[i]));
          ctx.stroke();
          ctx.restore();
        }
      }

      if (refProg < 1 || userProg < 1) raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [keyAngles, exId, reps, hasUser, theme]);

  const cc = (THEME_COLORS[theme] ?? THEME_COLORS.deep_space).chart;
  return (
    <div style={{ position: "relative" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: 130, display: "block", borderRadius: 6 }} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: 6, fontSize: "0.62rem", opacity: 0.55, fontFamily: "Space Mono, monospace" }}>
        <span style={{ color: cc.ref }}>── ideal</span>
        <span style={{ color: cc.user }}>── yours</span>
      </div>
    </div>
  );
}

function analysisAdvice(dtw, exerciseId) {
  if (!exerciseId) return "No library movement was confidently matched. Repeat with a larger, steadier range of motion or add this motion to the library before counting it as a programmed set.";
  const ex = exerciseId ?? "squat";
  const isCurl = ex === "bicep_curl" || ex === "right_bicep_curl";
  if (dtw >= 0.85) return "Excellent form consistency. Rhythm and depth are well-controlled — push rep count next set.";
  if (ex === "deadlift_side") return dtw >= 0.70
    ? "Good hinge pattern. Keep knees quieter than a squat and finish each rep with a strong lockout."
    : "Hinge pattern is unstable. Push hips back, brace the trunk, and keep the knees from turning it into a squat.";
  if (ex === "push_up_side") return dtw >= 0.70
    ? "Solid push-up rhythm. Keep the plank line rigid as the elbows cycle."
    : "Push-up pattern needs control. Keep shoulders, hips, and knees aligned while lowering with the elbows.";
  if (ex === "squat_side") return dtw >= 0.70
    ? "Good side-view squat rhythm. Keep knees and hips traveling together through depth."
    : "Side squat pattern needs calibration. Reach depth while keeping hips and knees coordinated.";
  if (ex === "barbell_squat_side") return dtw >= 0.70
    ? "Good side-view squat depth. Keep hips and knees moving together without folding forward."
    : "Side squat pattern needs calibration. Reach depth while keeping the torso braced and hips under control.";
  if (dtw >= 0.70) return isCurl
    ? "Solid effort. Watch elbow drift on the down phase — slow the eccentric for better control."
    : ex === "lateral_raise"
    ? "Good range of motion. Keep your core braced throughout and avoid momentum on the way up."
    : "Good depth on most reps. Focus on keeping your torso upright at the bottom of each squat.";
  return isCurl
    ? "Elbow position needs attention — anchor upper arms still and lead with the wrist."
    : ex === "lateral_raise"
    ? "Reduce the load or slow the movement — form breaks down before the top of the arc."
    : "Depth and alignment need work. Slow down the descent and keep knees tracking over toes.";
}

function AnalysisScreen({ result, onNewSet, onDone, theme }) {
  const accuracy = Math.round((result?.dtw ?? 0.74) * 100);
  const dtwOk = accuracy >= 70;
  const radius = 40;
  const circ = 2 * Math.PI * radius;
  const dash = (accuracy / 100) * circ;
  const classifiedExercise = result?.exerciseId ? exerciseById(result.exerciseId) : null;
  const classification = result?.classification;
  const stats = classification?.stats ?? {};
  const assignedPct = stats.totalFrames
    ? Math.round(((stats.classifiedFrames ?? 0) / stats.totalFrames) * 100)
    : (result?.exerciseId ? 100 : 0);
  const actionTotals = (() => {
    const rows = Array.isArray(classification?.actionRows) ? classification.actionRows : [];
    const byId = new Map(rows.map((row) => [row.exerciseId, { ...row, reps: row.reps ?? 0 }]));
    Object.entries(classification?.repsByExercise ?? {}).forEach(([id, count]) => {
      const prev = byId.get(id) ?? { exerciseId: id, confirmed: 0, required: AUTO_REP_CONFIRMATIONS_REQUIRED };
      byId.set(id, { ...prev, reps: count ?? 0 });
    });
    if (!byId.size && result?.exerciseId) {
      byId.set(result.exerciseId, { exerciseId: result.exerciseId, reps: result?.reps ?? 0 });
    }
    return [...byId.values()]
      .filter((row) => row.exerciseId)
      .map((row) => ({ ...exerciseById(row.exerciseId), reps: row.reps ?? 0 }))
      .sort((a, b) => b.reps - a.reps);
  })();
  const topRepBreakdown = actionTotals.length
    ? actionTotals.map((row) => `${row.short} ${row.reps}`).join(" · ")
    : "None";

  const settleParticles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    x: 10 + Math.random() * 80,
    delay: Math.random() * 1.5,
    duration: 1.5 + Math.random() * 1.5,
    size: 1.5 + Math.random() * 3,
    color: i % 3 === 0 ? "var(--em-b)" : i % 3 === 1 ? "var(--am-a)" : "var(--em-a)",
  }));

  return (
    <div className="screen-pad">
      <div className="analysis-wrap">
        <div className="analysis-header">
          <div className="sys-label-em">Neural Settlement</div>
          <h2 className="ath-title" style={{ fontSize: "1.4rem", marginTop: "0.25rem" }}>Set Analysis</h2>
        </div>

        <div className="analysis-settle-zone">
          {settleParticles.map((p) => (
            <div
              key={p.id}
              className="settle-particle"
              style={{
                left: `${p.x}%`,
                width: p.size,
                height: p.size,
                background: p.color,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
                animationIterationCount: "infinite",
              }}
            />
          ))}
        </div>

        <motion.div className="glass score-glass" custom={0} variants={panelVariants} initial="hidden" animate="visible">
          <div className="sys-label" style={{ marginBottom: "0.5rem" }}>Form Completeness</div>
          <div className="score-ring-wrap">
            <div className="score-ring">
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                <circle
                  cx="50" cy="50" r={radius}
                  fill="none"
                  stroke={dtwOk ? "url(#emGrad)" : "var(--rd-a)"}
                  strokeWidth="7"
                  strokeDasharray={`${dash} ${circ}`}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="emGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--em-a)" />
                    <stop offset="100%" stopColor="var(--em-b)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="score-center">
                <span className="score-pct">{accuracy}%</span>
                <span className="score-pct-label">accuracy</span>
              </div>
            </div>
          </div>
          <div className="score-verdict">
            <strong style={{ color: dtwOk ? "var(--em-b)" : "var(--rd-a)" }}>
              {dtwOk ? "Form Locked" : "Calibration Required"}
            </strong>
          </div>
        </motion.div>

        <div className="stats-row">
          {[
            { val: result?.reps ?? 0, label: "Reps" },
            { val: `${accuracy}%`, label: "Accuracy" },
            { val: fmt(result?.elapsed ?? 0), label: "Duration" },
          ].map((s, i) => (
            <motion.div key={s.label} className="glass stat-glass" custom={i + 1} variants={panelVariants} initial="hidden" animate="visible">
              <div className="stat-glass-val">{s.val}</div>
              <div className="stat-glass-label">{s.label}</div>
            </motion.div>
          ))}
        </div>

        <motion.div className="glass classification-panel" custom={4} variants={panelVariants} initial="hidden" animate="visible">
          <div className="classification-title">Motion Classification</div>
          <div className="classification-main">
            <div className="classification-name">{classifiedExercise?.label ?? "Unassigned"}</div>
            <div className="classification-confidence">
              {classification?.mode === "auto"
                ? `${Math.round(classification?.confidence ?? 0)}% match`
                : "Manual"}
            </div>
          </div>
          <div className="classification-mini">
            <div><strong>{assignedPct}%</strong><span>Assigned</span></div>
            <div><strong>{stats.switches ?? 0}</strong><span>Switches</span></div>
            <div><strong>{topRepBreakdown}</strong><span>Rep Split</span></div>
          </div>
          <div className="classification-actions">
            {actionTotals.length ? actionTotals.map((row) => (
              <div key={row.id} className="classification-action-row">
                <span className="classification-action-code">{row.short}</span>
                <span className="classification-action-name">{row.label}</span>
                <span className="classification-action-reps">{row.reps} reps</span>
              </div>
            )) : (
              <div className="classification-action-row">
                <span className="classification-action-code">--</span>
                <span className="classification-action-name">Unassigned</span>
                <span className="classification-action-reps">0 reps</span>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div className="glass joint-panel" custom={5} variants={panelVariants} initial="hidden" animate="visible">
          <div className="joint-panel-title" style={{ marginBottom: "0.6rem" }}>Key Angle Trace</div>
          <DtwChart
            keyAngles={result?.keyAngles}
            exerciseId={result?.exerciseId}
            reps={result?.reps}
            theme={theme}
          />
        </motion.div>

        <motion.div className="glass advice-glass" custom={6} variants={panelVariants} initial="hidden" animate="visible">
          <div className="advice-label">Coach Feedback</div>
          <div className="advice-text">{analysisAdvice(result?.dtw ?? 0.74, result?.exerciseId)}</div>
        </motion.div>

        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={onNewSet}>New Set</button>
          <button className="btn-init" style={{ flex: 2 }} onClick={onDone}>Back to Command Center</button>
        </div>
      </div>
    </div>
  );
}

// ─── ProfileScreen ────────────────────────────────────────────────────────────

function ProfileScreen({ profile, muscleStatus, theme }) {
  const muscles = MUSCLE_GROUPS.map((mg) => ({
    ...mg,
    load: Math.min(1, (muscleStatus?.[mg.id] ?? 0)),
  }));
  const [selectedMuscle, setSelectedMuscle] = useState(() => {
    const top = muscles.slice().sort((a, b) => b.load - a.load)[0];
    return top?.id ?? "quads";
  });
  const selected = MUSCLE_BY_ID[selectedMuscle] ?? MUSCLE_BY_ID.quads;
  const selectedLoad = Math.round((muscleStatus?.[selected.id] ?? 0) * 100);
  const avgLoad = Math.round(
    (muscles.reduce((sum, muscle) => sum + muscle.load, 0) / Math.max(1, muscles.length)) * 100
  );

  return (
    <div className="screen-pad">
      <div className="profile-wrap">
        <div className="sys-label" style={{ paddingTop: "0.5rem" }}>Athlete Profile</div>

        <motion.div className="glass profile-hero" custom={0} variants={panelVariants} initial="hidden" animate="visible">
          <div className="profile-avatar">
            {(profile?.name ?? "A").charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="profile-name">{profile?.name ?? "Athlete"}</div>
            <div className="profile-meta">
              {profile?.sessionsCount ?? 0} sessions · {profile?.streakDays ?? 0}-day streak
            </div>
          </div>
        </motion.div>

        <motion.div custom={1} variants={panelVariants} initial="hidden" animate="visible">
          <MuscleBodyMap
            muscleStatus={muscleStatus}
            targetMuscles={{}}
            selectedMuscles={[selected.id]}
            onToggle={setSelectedMuscle}
            title="Muscle Recovery Matrix"
            subtitle={`Average load ${avgLoad}%. Amber means trained recently; emerald is ready focus.`}
            theme={theme}
          />
        </motion.div>

        <motion.div className="glass recovery-detail" custom={2} variants={panelVariants} initial="hidden" animate="visible">
          <div className="recovery-name">{selected.label}</div>
          <div className="recovery-value">{selectedLoad}%</div>
          <div className="recovery-copy">
            {selectedLoad > 66
              ? "High recent load. Pair this area with mobility or choose a lighter complementary movement."
              : selectedLoad > 28
                ? "Moderate training signal. This area can work, but keep form quality as the priority."
                : "Low recent load. Good candidate for the next focused training block."}
          </div>
        </motion.div>

        <motion.div className="glass" custom={3} variants={panelVariants} initial="hidden" animate="visible"
          style={{ padding: "1.1rem" }}
        >
          <div className="sys-label" style={{ marginBottom: "0.75rem" }}>Performance Genome</div>
          {[
            { label: "Average Form Score", val: `${profile?.averageForm ?? 0}%` },
            { label: "Total Sessions", val: profile?.sessionsCount ?? 0 },
            { label: "Current Streak", val: `${profile?.streakDays ?? 0} days` },
          ].map((row) => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.55rem 0", borderBottom: "1px solid var(--gb)" }}>
              <span style={{ fontSize: "0.82rem", color: "var(--text-m)" }}>{row.label}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: "0.85rem", color: "var(--em-b)" }}>{row.val}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

// ─── SettingsScreen ───────────────────────────────────────────────────────────

function SettingsScreen({ deviceUrl, setDeviceUrl, connMode, setConnMode, theme, setTheme }) {
  return (
    <div className="screen-pad">
      <div className="settings-wrap">
        <div className="sys-label" style={{ paddingTop: "0.5rem" }}>Device Topology</div>

        <motion.div className="glass settings-section" custom={0} variants={panelVariants} initial="hidden" animate="visible">
          <div className="settings-section-title">Visual Theme</div>
          <div className="settings-row">
            <div>
              <div className="settings-label">Color Palette</div>
              <div className="settings-sub">{theme === "sunset" ? "Sunset — warm amber & rose" : "Deep Space — emerald & cyan"}</div>
            </div>
            <div className="mode-toggle">
              <button className={`mode-btn ${theme === "deep_space" ? "active" : ""}`} onClick={() => setTheme("deep_space")}>Space</button>
              <button className={`mode-btn ${theme === "sunset" ? "active" : ""}`} onClick={() => setTheme("sunset")}>Sunset</button>
            </div>
          </div>
        </motion.div>

        <motion.div className="glass settings-section" custom={1} variants={panelVariants} initial="hidden" animate="visible">
          <div className="settings-section-title">Connection Mode</div>
          <div className="settings-row">
            <div>
              <div className="settings-label">Primary Link</div>
              <div className="settings-sub">BLE: GATT JPEG stream</div>
            </div>
            <div className="mode-toggle">
              <button className={`mode-btn ${connMode === "ble" ? "active" : ""}`} onClick={() => setConnMode("ble")}>BLE</button>
              <button className={`mode-btn ${connMode === "wifi" ? "active" : ""}`} onClick={() => setConnMode("wifi")}>WiFi</button>
            </div>
          </div>
        </motion.div>

        <motion.div className="glass settings-section" custom={2} variants={panelVariants} initial="hidden" animate="visible">
          <div className="settings-section-title">WiFi / Debug Config</div>
          <div>
            <label className="ath-field-label" htmlFor="device-url">Device Address</label>
            <input
              id="device-url"
              className="ath-input"
              value={deviceUrl}
              onChange={(e) => setDeviceUrl(e.target.value)}
              placeholder="http://fitcam-xxxxxx.local or IP"
            />
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-label">BLE Device Prefix</div>
              <div className="settings-sub">Scans for KineticLife-BLE-*</div>
            </div>
            <div className="data-value">Auto</div>
          </div>
        </motion.div>

        <motion.div className="glass settings-section" custom={3} variants={panelVariants} initial="hidden" animate="visible">
          <div className="settings-section-title">System Status</div>
          {[
            { label: "iOS Safari BLE", val: "Not Supported", ok: false },
            { label: "Android Chrome BLE", val: "HTTPS Required", ok: true },
            { label: "WiFi Fallback", val: "Available", ok: true },
            { label: "MediaPipe", val: "On-Device", ok: true },
          ].map((row) => (
            <div key={row.label} className="settings-row" style={{ borderBottom: "1px solid var(--gb)", paddingBottom: "0.65rem" }}>
              <span className="settings-label">{row.label}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", color: row.ok ? "var(--em-b)" : "var(--am-a)" }}>
                {row.val}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

// ─── CoreScreen ───────────────────────────────────────────────────────────────

function CoreMessageCard({ message, onExecutePlan }) {
  const roleLabel = message.role === "user" ? "Athlete" : "Kinetic Core";
  const timeLabel = new Date(message.timestamp ?? Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const exercises = Array.isArray(message.payload?.exercises) ? message.payload.exercises : [];
  const accuracy = Number(message.payload?.accuracy ?? 0);

  return (
    <motion.div
      className={`core-message ${message.role === "user" ? "user" : "ai"}`}
      variants={panelVariants}
      initial="hidden"
      animate="visible"
    >
      <div
        className="core-bubble"
        style={message.type === "daily_plan" ? { cursor: "pointer" } : {}}
        onClick={message.type === "daily_plan" ? onExecutePlan : undefined}
      >
        <div className="core-msg-meta">
          <span>{roleLabel}</span>
          <span>{timeLabel}</span>
        </div>
        <div className="core-msg-text">{message.content}</div>

        {message.type === "daily_plan" && exercises.length > 0 && (
          <div className="core-mini-card">
            {exercises.map((item) => {
              const ex = exerciseById(item.exerciseId);
              return (
                <div key={`${message.id}-${item.exerciseId}`} className="core-plan-row">
                  <span className="core-plan-code">{ex.short}</span>
                  <span className="core-plan-name">{ex.label}</span>
                  <span className="core-plan-meta">{item.sets}x{item.targetReps}</span>
                </div>
              );
            })}
            <div className="core-plan-cta" onClick={(e) => { e.stopPropagation(); onExecutePlan(); }}>
              Tap to start this plan
            </div>
          </div>
        )}

        {message.type === "post_workout" && (
          <div className="core-mini-card">
            <div className="core-plan-row">
              <span className="core-plan-code">{message.payload?.exerciseShort ?? "AI"}</span>
              <span className="core-plan-name">{message.payload?.exerciseLabel ?? "Completed Session"}</span>
              <span className="core-plan-meta">{message.payload?.reps ?? 0} reps</span>
            </div>
            <div className="core-score-bar">
              <div className="core-score-fill" style={{ width: `${Math.max(4, Math.min(100, accuracy))}%` }} />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function CoreScreen({ messages, onSend, onExecutePlan, onQuickPlan }) {
  const [draft, setDraft] = useState("");
  const timelineRef = useRef(null);
  const visibleMessages = messages.length ? messages : [
    makeAiMessage({
      type: "text",
      content: "Core is ready. Generate an AI Plan, finish a session, or leave a training note to build this local intelligence stream.",
    }),
  ];

  useEffect(() => {
    const node = timelineRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  function submit(text = draft) {
    const value = String(text || "").trim();
    if (!value) return;
    onSend(value);
    setDraft("");
  }

  return (
    <div className="screen-pad">
      <div className="core-wrap">
        <div className="core-header">
          <div className="sys-label-em">Local Training Intelligence</div>
          <h2 className="ath-title" style={{ fontSize: "1.3rem", marginTop: "0.25rem" }}>Kinetic Core</h2>
        </div>

        <div className="core-timeline" ref={timelineRef}>
          {visibleMessages.map((message) => (
            <CoreMessageCard
              key={message.id}
              message={message}
              onExecutePlan={onExecutePlan}
            />
          ))}
        </div>

        <div className="core-input-zone">
          <div className="core-input-shell">
            <div className="core-quick-row">
              <button className="core-quick" onClick={() => submit("Generate today's training plan")}>Generate Today's Plan</button>
              <button className="core-quick" onClick={() => submit("I feel tired today")}>I feel tired</button>
              <button className="core-quick" onClick={() => submit("Left shoulder feels sore")}>Log shoulder note</button>
              <button className="core-quick" onClick={() => submit("How is my progress?")}>My progress</button>
            </div>
            <div className="core-input-row">
              <input
                className="core-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                placeholder="Add a training note..."
              />
              <button className="core-send" onClick={() => submit()}>SEND</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── BottomNav ────────────────────────────────────────────────────────────────

function BottomNav({ tab, onChange, aiUnread }) {
  const items = [
    { id: "home", label: "Home", icon: "HM" },
    { id: "core", label: "Core", icon: "AI" },
    { id: "profile", label: "Profile", icon: "PR" },
    { id: "setup", label: "Setup", icon: "ST" },
  ];
  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <button
          key={item.id}
          className={`nav-item ${tab === item.id ? "active" : ""} ${item.id === "core" && aiUnread ? "unread" : ""}`}
          onClick={() => onChange(item.id)}
        >
          <span className="nav-icon">
            {item.icon}
            {item.id === "core" && aiUnread && <span className="nav-unread-dot" />}
          </span>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function AetherisApp() {
  const [screen, setScreen] = useState("auth");
  const [navTab, setNavTab] = useState("home");
  const [profile, setProfile] = useState(() => loadProfile());
  const [muscleStatus, setMuscleStatus] = useState(() => loadMuscleStatus());
  const [exercise, setExercise] = useState(null);
  const [sessionResult, setSessionResult] = useState(null);
  const [visualState, setVisualState] = useState("auth");
  const [flowMode, setFlowMode] = useState(null);
  const [deviceUrl, setDeviceUrl] = useState(() => localStorage.getItem("ath_device_url") || "http://fitcam-d37d7c.local");
  const [connMode, setConnMode] = useState(() => localStorage.getItem("ath_conn_mode") || "ble");
  const [lastDevice, setLastDevice] = useState(() => loadLastDevice());
  const [theme, setTheme] = useState(() => localStorage.getItem("ath_theme") || "deep_space");
  const [aiMessages, setAiMessages] = useState(() => loadAiMessages());
  const [aiUnread, setAiUnread] = useState(() => loadAiUnread());
  const iotConnRef = useRef(null);

  useEffect(() => { localStorage.setItem("ath_device_url", deviceUrl); }, [deviceUrl]);
  useEffect(() => { localStorage.setItem("ath_conn_mode", connMode); }, [connMode]);
  useEffect(() => { localStorage.setItem("ath_theme", theme); }, [theme]);

  const NAV_SCREENS = ["dashboard", "core", "profile", "settings"];
  const showNav = NAV_SCREENS.includes(screen);

  function appendAiMessage(message, { unread = true } = {}) {
    setAiMessages((prev) => {
      const next = [...prev, message].slice(-60);
      saveAiMessages(next);
      return next;
    });
    if (unread && screen !== "core") {
      setAiUnread(true);
      saveAiUnread(true);
    }
  }

  function clearAiUnread() {
    setAiUnread(false);
    saveAiUnread(false);
  }

  function handleEnter(name) {
    const updated = { ...profile, name };
    setProfile(updated);
    saveProfile(updated);
    setScreen("dashboard");
    setVisualState("idle");
    setNavTab("home");
  }

  function handleNavTab(tab) {
    setNavTab(tab);
    if (tab === "home") { setScreen("dashboard"); setVisualState("idle"); }
    if (tab === "core") { setScreen("core"); setVisualState("idle"); clearAiUnread(); }
    if (tab === "profile") { setScreen("profile"); setVisualState("idle"); }
    if (tab === "setup") { setScreen("settings"); setVisualState("idle"); }
  }

  function handleJumpIn() {
    setFlowMode("jump_in");
    goLive(null);
  }

  function handlePlan() {
    setFlowMode("plan");
    setScreen("plan_config");
    setVisualState("idle");
  }

  function handleHomeWorkout() {
    setFlowMode("home_workout");
    setScreen("home_coach");
    setVisualState("idle");
  }

  // If already connected, skip ConnectScreen entirely and go straight to live.
  function goLive(ex) {
    setExercise(ex);
    if (iotConnRef.current) {
      setScreen("live");
      setVisualState("connected");
      setTimeout(() => setVisualState("idle"), 600);
    } else {
      setScreen("connect");
      setVisualState("searching");
    }
  }

  function handleClassified(ex) { goLive(ex); }
  function handlePlanBegin(ex)   { goLive(ex); }
  function handleCoachBegin(ex)  { goLive(ex); }

  function handleConnected(deviceInfo) {
    if (deviceInfo) setLastDevice(deviceInfo);
    setScreen("live");
    setVisualState("connected");
    setTimeout(() => setVisualState("idle"), 1000);
  }

  function handleLiveFinish(data) {
    setSessionResult(data);
    setScreen("analysis");
    setVisualState("analysis");
    const updated = {
      ...profile,
      sessionsCount: (profile.sessionsCount ?? 0) + 1,
      averageForm: Math.round(((profile.averageForm ?? 0) + data.dtw * 100) / 2),
    };
    setProfile(updated);
    saveProfile(updated);
    const repEntries = Object.entries(data.classification?.repsByExercise ?? {})
      .filter(([, count]) => Number(count) > 0);
    const trainedEntries = repEntries.length
      ? repEntries
      : data.exerciseId
      ? [[data.exerciseId, Math.max(1, data.reps ?? 1)]]
      : [];
    if (trainedEntries.length) {
      const updated = { ...muscleStatus };
      const totalActionReps = trainedEntries.reduce((sum, [, count]) => sum + Math.max(0, Number(count) || 0), 0);
      trainedEntries.forEach(([exerciseId, count]) => {
        const targets = getExerciseTargets(exerciseId);
        const share = totalActionReps > 0 ? Math.max(0.25, (Number(count) || 0) / totalActionReps) : 1;
        Object.entries(targets).forEach(([muscle, intensity]) => {
          updated[muscle] = Math.min(1, (updated[muscle] ?? 0) + (0.10 + intensity * 0.18) * share);
        });
      });
      setMuscleStatus(updated);
      saveMuscleStatus(updated);
    }
    const finishedExercise = data.exerciseId ? exerciseById(data.exerciseId) : null;
    const accuracy = Math.round((data.dtw ?? 0) * 100);
    appendAiMessage(makeAiMessage({
      type: "post_workout",
      content: finishedExercise
        ? `Training complete. ${finishedExercise.label} finished at ${accuracy}% DTW alignment. Recovery load has been updated.`
        : `Training complete. No library movement was confidently assigned; Core stored this as an unassigned session note.`,
      payload: {
        accuracy,
        reps: data.reps ?? 0,
        elapsed: data.elapsed ?? 0,
        exerciseId: data.exerciseId ?? null,
        exerciseLabel: finishedExercise?.label ?? "Unassigned Session",
        exerciseShort: finishedExercise?.short ?? "--",
      },
    }));
  }

  function handleNewSet() {
    if (iotConnRef.current) {
      setScreen("live");
      setVisualState("connected");
      setTimeout(() => setVisualState("idle"), 600);
    } else {
      setScreen("connect");
      setVisualState("searching");
    }
  }

  function handleDone() {
    setScreen("dashboard");
    setVisualState("idle");
    setNavTab("home");
    setSessionResult(null);
  }

  function handleBack() {
    setScreen("dashboard");
    setVisualState("idle");
    setNavTab("home");
  }

  function handleLiveVisualState(vs) {
    setVisualState(vs);
  }

  function handlePlanGenerated(decision) {
    appendAiMessage(makeAiMessage({
      type: "daily_plan",
      content: decision.dialogue,
      payload: decision.payload,
    }));
  }

  function handleCoreSend(text) {
    appendAiMessage(makeAiMessage({ role: "user", type: "text", content: text }), { unread: false });

    const inferred = inferInjuryTagsFromText(text);
    if (inferred.length) {
      const current = loadAiCoreProfile();
      const merged = normalizeTags([...(current.injuryTags ?? []), ...inferred]);
      saveAiCoreProfile({ ...current, injuryTags: merged, updatedAt: Date.now() });
      appendAiMessage(makeAiMessage({
        type: "text",
        content: `Constraint noted. Future plans will reduce load around ${inferred.map((id) => AI_CORE_INJURY_OPTIONS.find((item) => item.id === id)?.label ?? id).join(", ")}.`,
        payload: { injuryTags: inferred },
      }), { unread: false });
      return;
    }

    const lower = text.toLowerCase();

    if (lower.includes("generate") || lower.includes("plan") || lower.includes("today") || lower.includes("workout")) {
      const coreProfile = loadAiCoreProfile();
      const decision = generateAiCorePlan({ profile: coreProfile, muscleStatus, focusTags: coreProfile.focusTags ?? [] });
      appendAiMessage(makeAiMessage({ type: "daily_plan", content: decision.dialogue, payload: decision.payload }));
      return;
    }

    if (lower.includes("tired") || lower.includes("fatigue") || lower.includes("exhausted") || lower.includes("sore")) {
      appendAiMessage(makeAiMessage({ type: "text", content: "Recovery is a training variable. Today's load recommendation will shift toward lower-intensity movement or active recovery. Hydration and sleep quality are the primary recovery levers." }));
      return;
    }

    if (lower.includes("progress") || lower.includes("how am i") || lower.includes("stats") || lower.includes("status")) {
      const sessions = profile?.sessionsCount ?? 0;
      const form = profile?.averageForm ?? 0;
      appendAiMessage(makeAiMessage({ type: "text", content: `${sessions} session${sessions !== 1 ? "s" : ""} logged. Average DTW alignment: ${form > 0 ? `${form}%` : "no data yet"}. Muscle recovery status is updated after each completed set.` }));
      return;
    }

    appendAiMessage(makeAiMessage({ type: "text", content: "Training note recorded in your local intelligence stream." }));
  }

  const handleConnectedCallback = useCallback((deviceInfo) => {
    if (deviceInfo) {
      iotConnRef.current = deviceInfo;
      const meta = { mode: deviceInfo.mode, name: deviceInfo.name, id: deviceInfo.id, url: deviceInfo.url, connectedAt: Date.now() };
      setLastDevice(meta);
    }
    setScreen("live");
    setVisualState("connected");
    setTimeout(() => setVisualState("idle"), 1000);
  }, []);

  function renderScreen() {
    switch (screen) {
      case "auth":
        return <AuthScreen onEnter={handleEnter} profile={profile} />;
      case "dashboard":
        return (
          <DashboardScreen
            profile={profile}
            onJumpIn={handleJumpIn}
            onPlan={handlePlan}
            onHomeWorkout={handleHomeWorkout}
            lastDevice={lastDevice}
          />
        );
      case "auto_classify":
        return <AutoClassifyScreen onClassified={handleClassified} onBack={handleBack} />;
      case "plan_config":
        return <PlanConfigScreen onBegin={handlePlanBegin} onBack={handleBack} muscleStatus={muscleStatus} theme={theme} onPlanGenerated={handlePlanGenerated} />;
      case "home_coach":
        return <HomeCoachScreen onBegin={handleCoachBegin} onBack={handleBack} />;
      case "connect":
        return (
          <ConnectScreen
            onConnected={handleConnectedCallback}
            onBack={handleBack}
            exercise={exercise}
            connMode={connMode}
            deviceUrl={deviceUrl}
            theme={theme}
          />
        );
      case "live":
        return (
          <LiveScreen
            exercise={exercise}
            onFinish={handleLiveFinish}
            onVisualState={handleLiveVisualState}
            iotConnRef={iotConnRef}
            theme={theme}
          />
        );
      case "analysis":
        return (
          <AnalysisScreen
            result={sessionResult}
            onNewSet={handleNewSet}
            onDone={handleDone}
            theme={theme}
          />
        );
      case "core":
        return (
          <CoreScreen
            messages={aiMessages}
            onSend={handleCoreSend}
            onExecutePlan={handlePlan}
            onQuickPlan={handlePlan}
          />
        );
      case "profile":
        return <ProfileScreen profile={profile} muscleStatus={muscleStatus} theme={theme} />;
      case "settings":
        return (
          <SettingsScreen
            deviceUrl={deviceUrl}
            setDeviceUrl={setDeviceUrl}
            connMode={connMode}
            setConnMode={setConnMode}
            theme={theme}
            setTheme={setTheme}
          />
        );
      default:
        return null;
    }
  }

  return (
    <>
      <style>{css}</style>
      <div className="ath-root" data-theme={theme}>
        <AetherisWorld visualState={visualState} theme={theme} />

        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            className="ath-screen-layer"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>

        {showNav && <BottomNav tab={navTab} onChange={handleNavTab} aiUnread={aiUnread} />}
      </div>
    </>
  );
}
