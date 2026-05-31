import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createAvatar } from "@dicebear/core";
import * as thumbs from "@dicebear/thumbs";
import Lottie from "lottie-react";
import lottieAiCore        from "../assets/ai-core.json";
import lottieSetClear      from "../assets/Set_clear.json";
import lottiePathClear     from "../assets/path_clear.json";
import lottieCheeringRibbons from "../assets/cheering_ribbons.json";
import lottieTrophy        from "../assets/Trophy.json";
import lottieJumpingJack   from "../assets/home_Jumping_Jack.json";
import lottieSquatKick     from "../assets/home_Squat_Kick.json";
import lottieBlueJumping   from "../assets/blue_jumping.json";
import lottieAvocadoWalking from "../assets/Avocado_walking.json";
import lottieSqurtWalking  from "../assets/squrt_walking.json";
import jumpInDeep from "../assets/home-entry/jump-in-deep.svg";
import jumpInSunset from "../assets/home-entry/jump-in-sunset.svg";
import aiPlanDeep from "../assets/home-entry/ai-plan-deep.svg";
import aiPlanSunset from "../assets/home-entry/ai-plan-sunset.svg";
import homeModeDeep from "../assets/home-entry/home-mode-deep.svg";
import homeModeSunset from "../assets/home-entry/home-mode-sunset.svg";

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
  bicep_curl: { biceps: 1, shoulders: 0.22, core: 0.18 },
  right_bicep_curl: { biceps: 1, shoulders: 0.22, core: 0.18 },
  lateral_raise: { shoulders: 1, upper_back: 0.42, core: 0.22 },
  squat_side: { quads: 1, hamstrings: 0.74, core: 0.56, lower_back: 0.4, front_calves: 0.44, rear_calves: 0.44 },
  barbell_squat_side: { quads: 1, hamstrings: 0.78, core: 0.58, lower_back: 0.46, front_calves: 0.42, rear_calves: 0.42 },
  deadlift_side: { hamstrings: 1, lower_back: 0.9, core: 0.72, quads: 0.38, rear_calves: 0.28, upper_back: 0.46 },
  both_bicep_curl: { biceps: 1, shoulders: 0.28, core: 0.18 },
  deadlift: { hamstrings: 1, lower_back: 0.9, core: 0.72, quads: 0.38, rear_calves: 0.28, upper_back: 0.46 },
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
    label: "Right Dumbbell Curl",
    short: "RC",
    muscles: Object.keys(MUSCLE_INTENSITY_BY_EXERCISE.bicep_curl),
    joints: ["left_elbow"],
  },
  {
    id: "right_bicep_curl",
    label: "Left Dumbbell Curl",
    short: "LC",
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
    id: "both_bicep_curl",
    label: "Both-Arms Bicep Curl",
    short: "BC",
    muscles: Object.keys(MUSCLE_INTENSITY_BY_EXERCISE.both_bicep_curl),
    joints: ["left_elbow", "right_elbow"],
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
const NEXUS_CHECKINS_KEY = "ath_nexus_checkins";
const ACTIVE_USER_KEY = "ath_active_user";
const KNOWN_USERS_KEY = "ath_known_users";
const PROFILE_KEY = "ath_profile";
const MUSCLE_STATUS_KEY = "ath_muscles";
const DEVICE_URL_KEY = "ath_device_url";
const CONN_MODE_KEY = "ath_conn_mode";
const THEME_KEY = "ath_theme";
const LAST_DEVICE_KEY = "ath_last_device";

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
  lateral_raise: { group: "Upper Body", baseSets: 3, reps: 12, risk: { shoulder: 70 } },
  bicep_curl: { group: "Arms", baseSets: 3, reps: 12, risk: { elbow: 60, wrist: 25 } },
  right_bicep_curl: { group: "Arms", baseSets: 3, reps: 12, risk: { elbow: 60, wrist: 25 } },
  both_bicep_curl: { group: "Arms", baseSets: 3, reps: 12, risk: { elbow: 65, wrist: 30 } },
};

const NEXUS_MOODS = [
  { id: "tired", label: "Tired", tone: "#7C8CFF", face: "tired" },
  { id: "sleepy", label: "Sleepy", tone: "#A58BFF", face: "sleepy" },
  { id: "satisfied", label: "Good", tone: "#00FF9D", face: "satisfied" },
  { id: "happy", label: "Happy", tone: "#00DBE9", face: "happy" },
  { id: "laughing", label: "Pumped", tone: "#FFB800", face: "laughing" },
];

const NEXUS_MOOD_BY_ID = Object.fromEntries(NEXUS_MOODS.map((mood) => [mood.id, mood]));

const NEXUS_MOCK_CHECKINS = [
  { id: "mock_0x4f", name: "Athlete_0x4F", exerciseId: "lateral_raise", reps: 14, dtwAvg: 91, mood: "satisfied", resonance: 8, x: 18, y: 30 },
  { id: "mock_0xa2", name: "Athlete_0xA2", exerciseId: "both_bicep_curl", reps: 18, dtwAvg: 84, mood: "tired", resonance: 5, x: 75, y: 24 },
  { id: "mock_0xc9", name: "Athlete_0xC9", exerciseId: "deadlift_side", reps: 9, dtwAvg: 88, mood: "happy", resonance: 11, x: 82, y: 63 },
  { id: "mock_0x71", name: "Athlete_0x71", exerciseId: "squat", reps: 16, dtwAvg: 93, mood: "laughing", resonance: 15, x: 28, y: 72 },
  { id: "mock_0xbd", name: "Athlete_0xBD", exerciseId: "bicep_curl", reps: 12, dtwAvg: 79, mood: "sleepy", resonance: 3, x: 52, y: 18 },
];

// large = 2-3 days rest, small = 1 day rest
const EXERCISE_MUSCLE_CLASS = {
  squat: "large", squat_side: "large", barbell_squat_side: "large",
  deadlift_side: "large",
  lateral_raise: "small", bicep_curl: "small", right_bicep_curl: "small",
  both_bicep_curl: "small",
};

// muscle group key for rest-period conflict detection
const EXERCISE_MUSCLE_GROUP_KEY = {
  squat: "lower", squat_side: "lower", barbell_squat_side: "lower",
  deadlift_side: "posterior",
  lateral_raise: "pull",
  bicep_curl: "arms", right_bicep_curl: "arms", both_bicep_curl: "arms",
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

const HOME_ENTRY_IMAGES = {
  deep_space: {
    jump: jumpInDeep,
    plan: aiPlanDeep,
    home: homeModeDeep,
  },
  sunset: {
    jump: jumpInSunset,
    plan: aiPlanSunset,
    home: homeModeSunset,
  },
};

// ─── Home Workout ─────────────────────────────────────────────────────────────

const HOME_ROUTES = {
  upper: {
    varKey: "a",
    name: "APEX PROTOCOL",
    tagline: "Biceps · Shoulders",
    accentColor: "#00DBE9",
    steps: [
      { type: "exercise", exerciseId: "both_bicep_curl", sets: 3, reps: 6 },
      { type: "exercise", exerciseId: "lateral_raise",   sets: 3, reps: 6 },
      { type: "cardio",   duration: 30, label: "Jumping Jacks", lottie: "jumping_jack" },
    ],
    muscles: { biceps: 1.0, shoulders: 0.85, triceps: 0.35, core: 0.22 },
  },
  lower: {
    varKey: "b",
    name: "FORGE PROTOCOL",
    tagline: "Quads · Posterior Chain",
    accentColor: "#A855F7",
    steps: [
      { type: "exercise", exerciseId: "squat",    sets: 3, reps: 6 },
      { type: "exercise", exerciseId: "deadlift", sets: 3, reps: 6 },
      { type: "cardio",   duration: 30, label: "Squat Kicks", lottie: "squat_kick" },
    ],
    muscles: { quads: 1.0, hamstrings: 0.9, lower_back: 0.75, core: 0.55, rear_calves: 0.3 },
  },
};

// TODO: replace with AI API call → fetchKiniLine(screen, context): Promise<string>
const KINI_LINES = {
  selection: [
    "Pick your protocol. Let's make it count.",
    "No equipment. No excuses. Choose your mission.",
    "Ready to level up? I'll guide you through.",
    "Your body is the gym today. Let's go.",
  ],
  between: [
    "Not bad! For a human, anyway. 😄 Take a breath.",
    "You're actually doing it! I'm almost impressed. Rest up.",
    "That looked suspiciously good. One more challenge — don't blow it.",
    "Every rep is logged. Yes, even the wobbly ones. Keep going!",
    "I saw that little grunt. Totally normal. Next one's ready.",
    "Rest time! You've earned approximately 15 seconds of feeling great.",
  ],
  cardio: [
    "Just wiggle SOMETHING. I won't tell anyone what it looks like.",
    "This is the part where you prove you're not a statue. Move!",
    "Any joint. Any direction. Interpretive dance totally counts.",
    "30 seconds of freedom! Just... keep something moving. Please.",
    "I'm watching the timer. You're watching me. Let's make it weird.",
  ],
  reward: [
    "Mission complete! I knew you had it in you. Well, mostly knew.",
    "Protocol finished! Go eat something. You've definitely earned it.",
    "That was very real work. I'm logging this as 'impressive.' Officially.",
    "You showed up, you pushed, you survived. That's the whole job!",
    "Done! You are now 3×6 reps cooler than you were this morning.",
  ],
  set_rest: [
    "Set done! Shake out those arms. Or legs. Whichever one is complaining.",
    "Rest time. I'd high-five you but I'm a robot. Imagine it.",
    "Good set! Now breathe. Dramatically if needed.",
    "That was a solid set. Your muscles are having a little meeting. Let them.",
    "Rest mode activated. Refueling in progress. Next set incoming!",
  ],
  exercise_done: [
    "All sets done! Your muscles filed a complaint. I ignored it.",
    "Exercise complete! The next challenge is already waiting. How exciting!",
    "Finished! Your form was... let's say 'character-building.' On to the next.",
    "Solid work. You came, you squatted (or curled), you conquered.",
    "That's a wrap on this one. Momentum is a beautiful thing — keep it.",
  ],
};

// Encouraging words: color intensity tracks positivity (cool→hot)
const HOME_LIVE_WORDS = [
  { text: "KEEP GOING!",   color: "#00DBE9" },
  { text: "GREAT FORM!",   color: "#AAFF5A" },
  { text: "NICE REP!",     color: "#FFE44D" },
  { text: "KEEP PUSHING!", color: "#FFA040" },
  { text: "AMAZING!",      color: "#FF6030" },
  { text: "PERFECT!",      color: "#FF3020" },
  { text: "ON FIRE!",      color: "#FF1000" },
  { text: "BEAST MODE!",   color: "#FF0050" },
];

const CARDIO_MILESTONES = [
  { pct: 0.85, text: "JUST GETTING STARTED!", color: "#00DBE9" },
  { pct: 0.65, text: "WARMING UP!",            color: "#AAFF5A" },
  { pct: 0.50, text: "HALFWAY THERE!",         color: "#FFE44D" },
  { pct: 0.30, text: "FINAL PUSH!",            color: "#FFA040" },
  { pct: 0.15, text: "ALMOST THERE!",          color: "#FF3020" },
  { pct: 0.05, text: "FINISH STRONG!",         color: "#FF0050" },
];

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

function normalizeUserId(name) {
  const normalized = String(name ?? "").trim().toLocaleLowerCase();
  return normalized ? encodeURIComponent(normalized) : "";
}

function userStorageKey(baseKey, name) {
  const id = normalizeUserId(name);
  return id ? `${baseKey}:${id}` : baseKey;
}

function getActiveUserName() {
  try { return localStorage.getItem(ACTIVE_USER_KEY) || ""; } catch { return ""; }
}

function setActiveUserName(name) {
  try { localStorage.setItem(ACTIVE_USER_KEY, String(name ?? "").trim()); } catch {}
}

function loadKnownUsers() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KNOWN_USERS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch { return []; }
}

function registerKnownUser(name) {
  const userName = String(name ?? "").trim();
  if (!userName) return;
  try {
    const users = loadKnownUsers().filter((item) => normalizeUserId(item) !== normalizeUserId(userName));
    localStorage.setItem(KNOWN_USERS_KEY, JSON.stringify([userName, ...users].slice(0, 12)));
  } catch {}
}

function makeDefaultProfile(name = "") {
  return { name, sessionsCount: 0, averageForm: 0, streakDays: 0 };
}

function loadProfile(name = getActiveUserName()) {
  const userName = String(name ?? "").trim();
  const defaults = makeDefaultProfile(userName);
  try {
    if (userName) {
      const scopedRaw = localStorage.getItem(userStorageKey(PROFILE_KEY, userName));
      if (scopedRaw) {
        const parsed = JSON.parse(scopedRaw);
        return { ...defaults, ...parsed, name: parsed.name || userName };
      }
      return defaults;
    }
    return defaults;
  } catch { return defaults; }
}

function saveProfile(p) {
  try {
    const userName = String(p?.name || getActiveUserName()).trim();
    if (userName) {
      const next = { ...makeDefaultProfile(userName), ...p, name: p?.name || userName };
      setActiveUserName(next.name);
      registerKnownUser(next.name);
      localStorage.setItem(userStorageKey(PROFILE_KEY, next.name), JSON.stringify(next));
      return;
    }
  } catch {}
}

function makeDefaultMuscleStatus() {
  return Object.fromEntries(MUSCLE_GROUPS.map((group) => [group.id, 0]));
}

function loadMuscleStatus(name = getActiveUserName()) {
  const defaults = makeDefaultMuscleStatus();
  const userName = String(name ?? "").trim();
  try {
    const scopedRaw = userName ? localStorage.getItem(userStorageKey(MUSCLE_STATUS_KEY, userName)) : null;
    if (scopedRaw) return { ...defaults, ...JSON.parse(scopedRaw) };
  } catch {}
  return defaults;
}

function saveMuscleStatus(s, name = getActiveUserName()) {
  try {
    const userName = String(name ?? "").trim();
    if (userName) localStorage.setItem(userStorageKey(MUSCLE_STATUS_KEY, userName), JSON.stringify(s));
  } catch {}
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

function loadAiCoreProfile(name = getActiveUserName()) {
  const defaults = makeDefaultAiCoreProfile();
  const userName = String(name ?? "").trim();
  try {
    const raw = userName ? localStorage.getItem(userStorageKey(AI_CORE_PROFILE_KEY, userName)) : null;
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

function saveAiCoreProfile(profile, name = getActiveUserName()) {
  try {
    const userName = String(name ?? "").trim();
    if (userName) localStorage.setItem(userStorageKey(AI_CORE_PROFILE_KEY, userName), JSON.stringify(profile));
  } catch {}
}

function loadAiMessages(name = getActiveUserName()) {
  const userName = String(name ?? "").trim();
  try {
    const raw = userName ? localStorage.getItem(userStorageKey(AI_MESSAGES_KEY, userName)) : null;
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAiMessages(messages, name = getActiveUserName()) {
  try {
    const userName = String(name ?? "").trim();
    const payload = JSON.stringify(messages.slice(-60));
    if (userName) localStorage.setItem(userStorageKey(AI_MESSAGES_KEY, userName), payload);
  } catch {}
}

function loadAiUnread(name = getActiveUserName()) {
  const userName = String(name ?? "").trim();
  try {
    const raw = userName ? localStorage.getItem(userStorageKey(AI_UNREAD_KEY, userName)) : null;
    return raw === "true";
  } catch { return false; }
}

function saveAiUnread(value, name = getActiveUserName()) {
  try {
    const userName = String(name ?? "").trim();
    const payload = value ? "true" : "false";
    if (userName) localStorage.setItem(userStorageKey(AI_UNREAD_KEY, userName), payload);
  } catch {}
}

function loadNexusCheckins(name = getActiveUserName()) {
  const userName = String(name ?? "").trim();
  try {
    const raw = userName ? localStorage.getItem(userStorageKey(NEXUS_CHECKINS_KEY, userName)) : null;
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveNexusCheckins(checkins, name = getActiveUserName()) {
  try {
    const userName = String(name ?? "").trim();
    if (userName) localStorage.setItem(userStorageKey(NEXUS_CHECKINS_KEY, userName), JSON.stringify(checkins.slice(0, 6)));
  } catch {}
}

function loadUserValue(baseKey, fallback, name = getActiveUserName()) {
  const userName = String(name ?? "").trim();
  try {
    const scoped = userName ? localStorage.getItem(userStorageKey(baseKey, userName)) : null;
    if (scoped != null) return scoped;
    return fallback;
  } catch { return fallback; }
}

function saveUserValue(baseKey, value, name = getActiveUserName()) {
  const userName = String(name ?? "").trim();
  try {
    if (userName) localStorage.setItem(userStorageKey(baseKey, userName), value);
  } catch {}
}

function loadDeviceUrl(name = getActiveUserName()) {
  return loadUserValue(DEVICE_URL_KEY, "http://fitcam-d37d7c.local", name);
}

function normalizeDeviceHttpUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

function saveDeviceUrl(value, name = getActiveUserName()) {
  saveUserValue(DEVICE_URL_KEY, value || "http://fitcam-d37d7c.local", name);
}

function loadConnMode(name = getActiveUserName()) {
  const mode = loadUserValue(CONN_MODE_KEY, "wifi", name);
  return mode === "wifi" ? "wifi" : "ble";
}

function saveConnMode(value, name = getActiveUserName()) {
  saveUserValue(CONN_MODE_KEY, value === "wifi" ? "wifi" : "ble", name);
}

function loadTheme(name = getActiveUserName()) {
  const value = loadUserValue(THEME_KEY, "deep_space", name);
  return value === "sunset" ? "sunset" : "deep_space";
}

function saveTheme(value, name = getActiveUserName()) {
  saveUserValue(THEME_KEY, value === "sunset" ? "sunset" : "deep_space", name);
}

function clearLegacySingleUserKeys() {
  try {
    [
      PROFILE_KEY,
      MUSCLE_STATUS_KEY,
      AI_CORE_PROFILE_KEY,
      AI_MESSAGES_KEY,
      AI_UNREAD_KEY,
      NEXUS_CHECKINS_KEY,
      DEVICE_URL_KEY,
      CONN_MODE_KEY,
      THEME_KEY,
      LAST_DEVICE_KEY,
    ].forEach((key) => localStorage.removeItem(key));
  } catch {}
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

// ─── Kinetic Core dialogue pools ─────────────────────────────────────────────
const _coreReplyHistory = {};

function pickReply(pool, key) {
  if (!_coreReplyHistory[key]) _coreReplyHistory[key] = [];
  const history = _coreReplyHistory[key];
  const window  = Math.ceil(pool.length / 2);
  let available = pool.map((_, i) => i).filter(i => !history.includes(i));
  if (available.length === 0) { _coreReplyHistory[key] = []; available = pool.map((_, i) => i); }
  const chosen = available[Math.floor(Math.random() * available.length)];
  history.push(chosen);
  if (history.length > window) history.shift();
  return pool[chosen];
}

const CORE_REPLIES = {
  default: [
    "Training note recorded in your local intelligence stream.",
    "Logged. Your input is now part of the recovery context.",
    "Received. If there's a specific question — form, fatigue, planning — ask directly and I'll route it.",
    "Captured. Patterns only emerge with consistent data points. Keep logging.",
    "On record. Anything you want analyzed or planned, just ask.",
    "Stored to your local stream. Context updated.",
    "Entry added. Your stream builds over time.",
    "Got it. I'll factor this into context for your next plan request.",
    "Noted. The system is aware.",
    "Logged. Ask me to generate a plan, check your stats, or flag a constraint anytime.",
  ],
  injury: [
    (labels) => `Constraint noted: ${labels}. Load around that zone will be moderated in future plans.`,
    (labels) => `${labels} logged as a sensitivity. Plans will route around it where possible.`,
    (labels) => `Logged. ${labels} is now flagged as a load-sensitive zone.`,
    (labels) => `Understood — ${labels} added to your constraint profile. Training load will be redistributed.`,
    (labels) => `${labels} flagged. Expect reduced risk exposure in that region going forward.`,
    (labels) => `Constraint active: ${labels}. Your next plan accounts for this automatically.`,
    (labels) => `${labels} noted. I'll keep intensity in that zone below threshold until you clear it.`,
  ],
  tired_with: [
    (lines) => `Fatigue after output is a normal adaptive signal. Today's log:\n${lines}\nRecovery now is where the gains lock in. Prioritize sleep and protein tonight.`,
    (lines) => `Output recorded. Your body is responding to load — that's the point. Today:\n${lines}\nHydrate, sleep, and let the process run.`,
    (lines) => `Feeling it is proof the stimulus was real. Today's sessions:\n${lines}\nMuscle load updated. Recovery window starts now.`,
    (lines) => `That kind of tired is earned. Log for today:\n${lines}\nSystems logged — let the adaptation happen.`,
    (lines) => `Fatigue is information. Here's what produced it:\n${lines}\nThe work is in the books. Eat, sleep, trust the cycle.`,
    (lines) => `Normal post-training response. Today's output:\n${lines}\nRecovery is the second half of training. Don't skip it.`,
  ],
  tired_none: [
    "Rest is a valid session. Nothing logged today — it carries forward without penalty.",
    "Skipping isn't failure — it's data. Rest days have their own adaptation value.",
    "No sessions today. If you need rest, take it without guilt. The schedule adapts.",
    "Fatigue without a session usually signals systemic recovery need. Honor it.",
    "Sometimes the right move is to not train. Your system will recalibrate.",
    "No output logged yet today. Low-intensity movement — a walk, some mobility — is fine if you want to stay active without adding load.",
    "Rest days are programmed into any serious training cycle. This counts.",
  ],
  progress: [
    (s, f) => `${s} session${s !== 1 ? "s" : ""} logged. Average DTW alignment: ${f > 0 ? `${f}%` : "no data yet"}. Muscle recovery status is updated after each completed set.`,
    (s, f) => `Sessions on record: ${s}. Form consistency avg: ${f > 0 ? `${f}%` : "pending data"}. The trend matters more than any single number.`,
    (s, f) => `${s} data point${s !== 1 ? "s" : ""} in your stream. Avg form: ${f > 0 ? `${f}%` : "not yet recorded"}. Muscle load map is current.`,
    (s, f) => `Training record: ${s} session${s !== 1 ? "s" : ""}, ${f > 0 ? `${f}% avg alignment` : "alignment data pending"}. Each session sharpens the baseline.`,
    (s, f) => `Logged output: ${s} session${s !== 1 ? "s" : ""}. ${f > 0 ? `Form average ${f}% — ${f >= 80 ? "above threshold" : f >= 65 ? "solid range" : "tracking upward"}` : "Form data builds after your first set"}. Recovery map is live.`,
    (s, f) => `You've put in ${s} session${s !== 1 ? "s" : ""} so far. ${f > 0 ? `Average precision: ${f}%. Keep the reps clean and the number climbs.` : "Complete a set to start tracking form alignment."}`,
    (s, f) => `${s} session${s !== 1 ? "s" : ""} in the system. ${f > 0 ? `${f}% avg DTW — ${f >= 75 ? "you're moving well" : "room to tighten form"}` : "Alignment data will appear after your first completed set"}.`,
  ],
  motivation: [
    "The hardest sessions build the most. Show up, move, log it.",
    "Consistency isn't glamorous. It's just the only thing that works.",
    "You don't need motivation. You need a target and a start. Go.",
    "The gap between where you are and where you want to be is sessions logged, not sessions missed.",
    "Hard is relative. What you can do today is enough.",
    "Systems beat motivation every time. You built one. Use it.",
    "Every session in the record is one your future self benefits from.",
    "The data doesn't care how you felt going in — only what you did. Let's log something.",
  ],
  technique: [
    "Form is tracked in real time via DTW alignment. Watch the DTW bar during your set — deviations show as red joints.",
    "Technique issues surface as live hints during sessions. If a joint is flagging, adjust it and watch the DTW score respond.",
    "The DTW alignment score is your form proxy. Sustained scores above 80% indicate consistent movement patterns.",
    "Each exercise has joint-specific checks. They activate in real time and tell you exactly where the breakdown is.",
    "Good technique shows up as green bones in the skeleton overlay. Red bones flag deviation.",
    "Form degrades under fatigue — that's expected. DTW is measured against your own movement template, not a generic model.",
    "Run a set and check the per-joint angle display. That's the most direct form feedback available.",
  ],
  recovery: [
    "Recovery is when adaptation happens. Sleep quality is the primary driver — prioritize 7-9 hours when training load is high.",
    "DOMS typically peaks at 24-72 hours post-session. Light movement accelerates clearance better than complete rest.",
    "Active recovery is usually more effective than passive rest. Low-intensity movement on off days keeps the system primed.",
    "The heatmap shows which groups are loaded. Focus mobility and stretch work on those zones specifically.",
    "Sleep is the highest-leverage recovery tool available. No protocol replaces it.",
    "If you're consistently sore, your recovery window is shorter than your training frequency. Add a rest day or reduce volume.",
    "Muscle load is tracked in your heatmap. High-load zones benefit most from sleep, hydration, and light mobility — in that order.",
  ],
  nutrition: [
    "Protein synthesis peaks post-session. 20-40g of quality protein within two hours of training is the baseline target.",
    "Hydration directly affects joint efficiency and muscle contraction. 0.5L per 30 minutes of training is a useful reference.",
    "Pre-session carbohydrates fuel intensity. Post-session protein supports repair. The order matters.",
    "For training support: adequate protein (1.6-2.2g/kg bodyweight) and consistent hydration covers most of the nutritional requirement.",
    "Post-workout: protein prioritized. Pre-workout: carbohydrates and hydration. During: water only unless session exceeds 90 minutes.",
    "Caloric intake matters less than timing and protein distribution across the day.",
    "Nutrition is outside my direct instrumentation — I track mechanical output. That said: protein and sleep are the highest-leverage post-session inputs.",
  ],
};

const PLAN_DIALOGUE = {
  fatigue: [
    (names) => `${names} above 75% load — plan redirected to rested groups.`,
    (names) => `High load on ${names}. Today's plan reduces exposure to those zones.`,
    (names) => `${names} need recovery time. Routing today's session around them.`,
    (names) => `${names} registering above threshold. Plan shifts to complement recovery.`,
  ],
  injury: [
    (labels) => `Constraints factored in: ${labels}. Load has been redistributed.`,
    (labels) => `${labels} flagged — exercises adjusted to keep you moving safely.`,
    (labels) => `Working around ${labels}. The plan avoids risk exposure in those zones.`,
    (labels) => `Injury profile active: ${labels}. Selections avoid high-risk movements.`,
  ],
  focus: [
    (labels) => `${labels} prioritized in today's selection.`,
    (labels) => `Plan biased toward ${labels} based on your focus profile.`,
    (labels) => `Focus on ${labels} — exercises selected to hit those groups directly.`,
    (labels) => `Focus tags active: ${labels}. Plan weighted accordingly.`,
  ],
  balanced: [
    "Full readiness detected. Balanced plan generated.",
    "Recovery metrics look clean. Standard plan ready.",
    "No fatigue flags — you're in a good window to train at full intensity.",
    "Heatmap is clear. Plan optimized for current readiness.",
    "No elevated fatigue detected; balanced readiness plan selected.",
  ],
};

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
  const injuryLabels = injuries.map((id) => AI_CORE_INJURY_OPTIONS.find((item) => item.id === id)?.label ?? id).join(", ");
  const focusLabels  = focus.map((id) => MUSCLE_BY_ID[id]?.label ?? id).join(", ");
  const reason = highFatigue.length
    ? `${fatigueNames.join(", ")} above 75% load; plan shifts away from overloaded tissue.`
    : injuries.length
    ? `Injury constraints active: ${injuryLabels}.`
    : focus.length
    ? `Focus tags prioritized: ${focusLabels}.`
    : "No elevated fatigue detected; balanced readiness plan selected.";
  const dialogue = highFatigue.length
    ? pickReply(PLAN_DIALOGUE.fatigue, "plan_fatigue")(fatigueNames.join(", "))
    : injuries.length
    ? pickReply(PLAN_DIALOGUE.injury, "plan_injury")(injuryLabels)
    : focus.length
    ? pickReply(PLAN_DIALOGUE.focus, "plan_focus")(focusLabels)
    : pickReply(PLAN_DIALOGUE.balanced, "plan_balanced");

  return {
    dialogue,
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

// Training day patterns keyed by days-per-week (0=Sun,1=Mon…6=Sat)
const WEEK_TRAINING_PATTERNS = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
};
const WEEK_DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Builds a full-week schedule respecting muscle recovery:
// large muscle groups (quads/posterior/chest): 2-day gap minimum
// small muscle groups (shoulders/arms): 1-day gap minimum
// Focus tags and fatigue inform exercise priority per day.
function buildWeekSchedule(trainingDaysPerWeek, muscleStatus, focusTags, injuryTags) {
  const days = clamp(Number(trainingDaysPerWeek) || 3, 2, 6);
  const pattern = new Set(WEEK_TRAINING_PATTERNS[days] ?? WEEK_TRAINING_PATTERNS[3]);
  const todayDow = new Date().getDay();
  const toLinear = (d) => (d === 0 ? 7 : d);
  const weekOrder = [1, 2, 3, 4, 5, 6, 0];
  const injuries = normalizeTags(injuryTags);
  const focus = normalizeTags(focusTags);

  // Score every exercise once (injury filter applied)
  const scoredPool = EXERCISES.map((ex) => {
    const rule = AI_CORE_EXERCISE_RULES[ex.id] ?? { baseSets: 3, reps: 10, risk: {} };
    const injuryPenalty = injuries.reduce((s, tag) => s + (rule.risk?.[tag] ?? 0), 0);
    if (injuryPenalty >= 100) return null;
    const targets = Object.keys(getExerciseTargets(ex.id));
    const avgLoad = targets.length
      ? targets.reduce((s, m) => s + (muscleStatus?.[m] ?? 0), 0) / targets.length : 0;
    const maxLoad = targets.reduce((mx, m) => Math.max(mx, muscleStatus?.[m] ?? 0), 0);
    const focusHits = targets.filter((m) => focus.includes(m));
    const muscleClass = EXERCISE_MUSCLE_CLASS[ex.id] ?? "small";
    const groupKey = EXERCISE_MUSCLE_GROUP_KEY[ex.id] ?? "general";
    const restRequired = muscleClass === "large" ? 2 : 1;
    const focusBonus = focusHits.length ? 38 : 0;
    const fatiguePenalty = maxLoad > 0.75 ? 55 : maxLoad > 0.55 ? 18 : 0;
    const score = (1 - avgLoad) * 100 + focusBonus - fatiguePenalty - injuryPenalty * 0.4;
    const reason = injuryPenalty > 0 ? "Injury-safe selection"
      : focusHits.length ? `Focus: ${focusHits.map((id) => MUSCLE_BY_ID[id]?.label ?? id).join(", ")}`
      : maxLoad > 0.75 ? "Recovery bias — reduced load"
      : avgLoad < 0.35 ? "Fresh — low recent load"
      : "Balanced readiness";
    return {
      exerciseId: ex.id,
      sets: clamp((rule.baseSets ?? 3) - (maxLoad > 0.65 ? 1 : 0), 2, 4),
      targetReps: rule.reps ?? 10,
      muscleClass, groupKey, restRequired, score, reason,
    };
  }).filter(Boolean);

  // Greedily assign best available exercise to each training day
  const trainingDays = weekOrder.filter((d) => pattern.has(d));
  const lastGroupDayIdx = {}; // groupKey → index in trainingDays
  const dayAssignments = {};

  trainingDays.forEach((dow, dayIdx) => {
    const available = scoredPool.filter((ex) => {
      const last = lastGroupDayIdx[ex.groupKey];
      return last === undefined || (dayIdx - last) >= ex.restRequired;
    });
    const pool = available.length ? available : scoredPool;
    const best = [...pool].sort((a, b) => b.score - a.score)[0];
    dayAssignments[dow] = best;
    lastGroupDayIdx[best.groupKey] = dayIdx;
  });

  return weekOrder.map((dow) => {
    const isTraining = pattern.has(dow);
    const isToday = dow === todayDow;
    const isPast = toLinear(dow) < toLinear(todayDow);
    const exercise = isTraining ? dayAssignments[dow] : null;
    return { dow, label: WEEK_DAY_LABELS[dow], isTraining, isToday, isPast, exercise };
  });
}

function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function movementProgress(exerciseId, keyAngle) {
  if (!Number.isFinite(keyAngle)) return 0;
  if (exerciseId === "bicep_curl" || exerciseId === "right_bicep_curl" || exerciseId === "both_bicep_curl") return Math.max(0, Math.min(1, (155 - keyAngle) / 100));
  if (exerciseId === "lateral_raise") return Math.max(0, Math.min(1, (keyAngle - 30) / 55));
  if (exerciseId === "deadlift_side") return Math.max(0, Math.min(1, (165 - keyAngle) / 55));
  return Math.max(0, Math.min(1, (160 - keyAngle) / 55));
}

const AUTO_CLASSIFIER_IDS = ["squat", "bicep_curl", "right_bicep_curl", "both_bicep_curl", "lateral_raise", "squat_side", "barbell_squat_side", "deadlift_side"];
const AUTO_REP_CONFIRMATIONS_REQUIRED = 2;
const AUTO_ACTION_ROW_LIMIT = 4;
const AUTO_SWITCH_HOLD_MS = 2800;
const AUTO_SIMPLER_SWITCH_MARGIN = 0.22;

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

function classifierActiveJointCount(id) {
  return Math.max(1, (AUTO_CLASSIFIER_SPECS[id]?.features ?? []).filter((feature) => feature.type === "active").length);
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
    minAmp: 26,
    strongAmp: 65,
    rest: 34,
    work: 66,
    direction: "up",
    features: [
      { id: "left_shoulder",  type: "active", weight: 0.30, minAmp: 22, strongAmp: 62, rest: 36, work: 66, direction: "up", fn: (lm) => classifierAngle(lm[23], lm[11], lm[13]) },
      { id: "right_shoulder", type: "active", weight: 0.30, minAmp: 22, strongAmp: 62, rest: 36, work: 66, direction: "up", fn: (lm) => classifierAngle(lm[24], lm[12], lm[14]) },
      // Elbows must stay extended during lateral raise — key separator from bicep_curl.
      // Bicep curl produces elbow amp ~70°; lateral raise elbow amp typically < 25°.
      // minAvg:125 also confirms elbows are mostly straight (not curled).
      { id: "right_elbow_quiet", type: "quiet", weight: 0.16, maxAmp: 28, minAvg: 125, fn: (lm) => classifierAngle(lm[12], lm[14], lm[16]) },
      { id: "left_elbow_quiet",  type: "quiet", weight: 0.14, maxAmp: 28, minAvg: 125, fn: (lm) => classifierAngle(lm[11], lm[13], lm[15]) },
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
  both_bicep_curl: {
    minAmp: 30,
    strongAmp: 85,
    rest: 143,
    work: 82,
    direction: "down",
    features: [
      // Elbow flexion — primary signal (reduced weight to make room for shoulder discriminator)
      { id: "left_elbow",  type: "active", weight: 0.27, minAmp: 30, strongAmp: 85, rest: 143, work: 82, direction: "down", fn: (lm) => classifierAngle(lm[11], lm[13], lm[15]) },
      { id: "right_elbow", type: "active", weight: 0.27, minAmp: 30, strongAmp: 85, rest: 143, work: 82, direction: "down", fn: (lm) => classifierAngle(lm[12], lm[14], lm[16]) },
      // Shoulder abduction must stay quiet — key separator from lateral_raise.
      // Lateral raise produces ~60-70° shoulder amp; bicep curl only ~10-20°.
      // maxAmp:18 → score=0 if shoulder amp > 36°, score=1 if amp <= 18°.
      { id: "shoulder_abduction_quiet", type: "quiet", weight: 0.24, maxAmp: 18, fn: (lm) => avgFinite(classifierAngle(lm[23], lm[11], lm[13]), classifierAngle(lm[24], lm[12], lm[14])) },
      { id: "knees_quiet", type: "quiet", weight: 0.14, maxAmp: 24, fn: (lm) => avgFinite(classifierAngle(lm[23], lm[25], lm[27]), classifierAngle(lm[24], lm[26], lm[28])) },
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
};

function makeAutoClassifierState() {
  return {
    samples: [],
    candidateId: null,
    candidateFrames: 0,
    activeId: null,
    activeSince: 0,
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
      classifier.activeSince = 0;
      classifier.activeConfidence = 0;
    }
    return { id: classifier.activeId, confidence: classifier.activeConfidence, status: classifier.activeId ? "hold" : "unassigned" };
  }

  classifier.unknownFrames = 0;
  if (classifier.activeId && classifier.activeId !== top.id) {
    const activeRank = ranked.find((item) => item.id === classifier.activeId);
    const holdActive = now - (classifier.activeSince || 0) < AUTO_SWITCH_HOLD_MS;
    const switchingToSimpler = classifierActiveJointCount(top.id) < classifierActiveJointCount(classifier.activeId);
    const activeStillPlausible = activeRank && activeRank.score >= 0.46 && activeRank.jointMatches >= 2;

    if (holdActive || (switchingToSimpler && activeStillPlausible && top.score - activeRank.score < AUTO_SIMPLER_SWITCH_MARGIN)) {
      classifier.candidateId = classifier.activeId;
      classifier.candidateFrames = 0;
      classifier.activeConfidence = Math.max(0, Math.round((activeRank?.score ?? classifier.activeConfidence / 100) * 100));
      classifier.classifiedFrames += 1;
      return { id: classifier.activeId, confidence: classifier.activeConfidence, status: "hold" };
    }
  }

  if (classifier.candidateId === top.id) classifier.candidateFrames += 1;
  else {
    classifier.candidateId = top.id;
    classifier.candidateFrames = 1;
  }

  if (classifier.candidateFrames >= 5 && classifier.activeId !== top.id) {
    if (classifier.activeId) classifier.switches += 1;
    classifier.activeId = top.id;
    classifier.activeSince = now;
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

function loadLastDevice(name = getActiveUserName()) {
  const userName = String(name ?? "").trim();
  try {
    const raw = userName ? localStorage.getItem(userStorageKey(LAST_DEVICE_KEY, userName)) : null;
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveLastDevice(info, name = getActiveUserName()) {
  try {
    const userName = String(name ?? "").trim();
    const payload = JSON.stringify({ ...info, connectedAt: Date.now() });
    if (userName) localStorage.setItem(userStorageKey(LAST_DEVICE_KEY, userName), payload);
  } catch {}
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

function muscleHeatLevel(load, target = 0) {
  const visual = Math.max(load, target);
  if (visual <= 0.01) return 0;
  return Math.min(7, Math.max(1, Math.ceil(visual * 7)));
}

function muscleHeatColor(load, target = 0, theme = "deep_space") {
  const m = (THEME_COLORS[theme] ?? THEME_COLORS.deep_space).muscle;
  return m.levels[muscleHeatLevel(load, target)] ?? m.levels[0];
}

function muscleHeatOpacity(load, target = 0) {
  const level = muscleHeatLevel(load, target);
  return level === 0 ? 0.62 : 0.58 + level * 0.06;
}

// ─── Theme Color Tokens ───────────────────────────────────────────────────────
const THEME_COLORS = {
  deep_space: {
    particle: { live_good: [0,255,157], connected: [0,255,157], live_warning: [255,60,50], signal_lost: [80,90,115], analysis: [255,184,0], idle: [0,219,233] },
    sphere: { near: [0,255,157], far: [0,219,233] },
    skeleton: { bg: "#030508", bgCombo: "rgba(10,12,16,0.30)" },
    chart: { ref: "#FFB800", user: "#00FF9D", glow: "#00FF9D", grid: "rgba(255,255,255,0.05)" },
    muscle: {
      levels: [
        "#161B22",
        "#0D47A1",
        "#1976D2",
        "#00B4D8",
        "#00E5FF",
        "#FFB300",
        "#FF6D00",
        "#FF003C",
      ],
    },
    renderer: { ok_a: "#00DBE9", ok_b: "#00FF9D", white: "rgba(245,252,255,0.96)", dim: "rgba(255,255,255,0.28)", warn: "#FFB800", err: "#FF3366", labelBg: "rgba(3,5,8,0.58)", warningTxt: "#030508", blendMode: "lighter" },
  },
  sunset: {
    particle: { live_good: [232,40,94], connected: [232,40,94], live_warning: [180,0,30], signal_lost: [180,140,120], analysis: [232,82,10], idle: [255,95,31] },
    sphere: { near: [232,40,94], far: [255,95,31] },
    skeleton: { bg: "#F2E8D5", bgCombo: "#F2E8D5" },
    chart: { ref: "#E06200", user: "#E8285E", glow: "#FF5F1F", grid: "rgba(0,0,0,0.06)" },
    muscle: {
      levels: [
        "#FFFFFF",
        "#FDE0C9",
        "#FAC09C",
        "#F79F6F",
        "#F47B42",
        "#E85D2F",
        "#D63D1F",
        "#BD1F29",
      ],
    },
    // Da Vinci manuscript style: warm parchment bg, sepia-brown lines, pink-purple errors
    renderer: {
      ok_a:       "#4A1C0C",   // dark sepia — primary bone colour
      ok_b:       "#7A3018",   // deep red-brown — secondary / head ring
      white:      "#6B1A0A",   // dark red — joint dots
      dim:        "rgba(74,28,12,0.22)", // barely-visible low-confidence joints
      warn:       "#1A0804",   // near-black — angle arcs & sketch guides
      err:        "#CC0E6A",   // high-saturation red-purple — form error highlight
      labelBg:    "rgba(242,232,213,0.90)", // parchment label background
      warningTxt: "#1A0804",   // near-black text
      blendMode:  "multiply",  // ink-on-paper: dark strokes darken the parchment ✓
    },
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
  --app-height: 100vh;
  --bottom-nav-h: 76px;
  --spring-heavy: cubic-bezier(0.2, 0, 0, 1);
  --spring-micro: cubic-bezier(0.34, 1.56, 0.64, 1);
  /* RGB channels for rgba() usage — override these in theme blocks */
  --em-a-rgb: 0,219,233;
  --em-b-rgb: 0,255,157;
  --am-a-rgb: 255,184,0;
  --cy-rgb: 0,122,255;
  --accent-txt: #030508;
  --muscle-radar: #FFFFFF;
  --muscle-radar-rgb: 255,255,255;
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
  --text-m: rgba(80,38,14,0.72);
  --text-d: rgba(80,38,14,0.52);
  --em-a-rgb: 255,95,31;
  --em-b-rgb: 232,40,94;
  --am-a-rgb: 255,149,0;
  --cy-rgb: 155,89,182;
  --accent-txt: rgba(255,247,240,0.95);
  --muscle-radar: #FFF0A6;
  --muscle-radar-rgb: 255,240,166;
  --nav-bg: rgba(255,240,225,0.88);
  /* dusk-blue — deep indigo for the "cool sky" counterpart to the warm sunset */
  --su-blue-rgb: 28,42,210;
}

[data-theme="sunset"] .body-silhouette {
  fill: rgba(32,14,6,0.04);
  stroke: rgba(32,14,6,0.14);
}

[data-theme="sunset"] .body-guide {
  stroke: rgba(32,14,6,0.12);
}

[data-theme="sunset"] .body-face-line {
  stroke: rgba(32,14,6,0.24);
}

[data-theme="sunset"] .body-anatomy-line {
  stroke: rgba(32,14,6,0.18);
}

[data-theme="sunset"] .muscle-shape {
  stroke: rgba(130,50,24,0.24);
}

[data-theme="sunset"] .muscle-shape.selected {
  stroke: #FFF0A6;
  stroke-width: 2;
  filter:
    drop-shadow(0 0 5px rgba(255,240,166,0.72))
    drop-shadow(0 0 10px rgba(255,184,0,0.38));
}

[data-theme="sunset"] .muscle-selection-ring {
  stroke: #FFF0A6;
  stroke-width: 2;
  stroke-dasharray: 1.4 6.2;
  filter:
    drop-shadow(0 0 5px rgba(255,240,166,0.72))
    drop-shadow(0 0 11px rgba(255,184,0,0.38));
  animation-name: muscle-radar-pulse-soft;
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
[data-theme="sunset"] .action-rep-stack {
  background: rgba(255,246,238,0.90);
  border-top-color: rgba(160,70,15,0.10);
}
[data-theme="sunset"] .action-rep-stack .rep-hud {
  background: rgba(255,250,244,0.52);
  border-bottom-color: rgba(160,70,15,0.10);
}
[data-theme="sunset"] .action-title {
  color: rgba(32,14,6,0.92);
}
[data-theme="sunset"] .action-sub,
[data-theme="sunset"] .rep-gate-label,
[data-theme="sunset"] .rep-progress-readout,
[data-theme="sunset"] .action-empty,
[data-theme="sunset"] .action-hidden-count {
  color: rgba(88,45,18,0.68);
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

/* ── Sunset: Nexus Social ── */
/* Stage: warmer, more opaque for better node contrast */
[data-theme="sunset"] .nexus-stage {
  background:
    radial-gradient(circle at 50% 52%, rgba(232,40,94,0.11), transparent 38%),
    radial-gradient(circle at 18% 24%, rgba(255,95,31,0.09), transparent 30%),
    radial-gradient(circle at 80% 70%, rgba(255,149,0,0.08), transparent 26%),
    rgba(245,205,165,0.88);
  border-color: rgba(160,64,16,0.28);
}
/* Orbit ring */
[data-theme="sunset"] .nexus-stage::after {
  border-color: rgba(140,50,10,0.22);
}
/* Ambient pulse */
[data-theme="sunset"] .nexus-stage-pulse {
  background: radial-gradient(circle at 50% 50%,
    rgba(232,40,94,0.06), transparent 52%);
}

/* ── Lines: darker + higher-opacity animation on light bg ── */
[data-theme="sunset"] .nexus-links line {
  stroke: rgba(100,30,8,0.55);
  animation: nexus-link-flow-su 4.8s ease-in-out infinite;
}
@keyframes nexus-link-flow-su {
  0%, 100% { stroke-dashoffset: 0;   opacity: 0.60; }
  50%       { stroke-dashoffset: -12; opacity: 1;    }
}
[data-theme="sunset"] .nexus-links line.active {
  stroke: rgba(180,20,55,0.92);
  stroke-width: 0.7;
  filter: drop-shadow(0 0 4px rgba(200,20,60,0.50));
}

/* ── Node glow blob: opaque enough to show on light bg ── */
[data-theme="sunset"] .nexus-node::before {
  background: color-mix(in srgb, var(--mood) 45%, rgba(60,15,5,0.20));
  filter: blur(12px);
  opacity: 0.82;
}
[data-theme="sunset"] .nexus-node.active::before,
[data-theme="sunset"] .nexus-node.mine::before {
  opacity: 1;
  animation: none;
}
/* Shining node: stronger blob */
[data-theme="sunset"] .nexus-node.shining::before {
  background: color-mix(in srgb, var(--mood) 58%, rgba(60,15,5,0.20));
}
/* Needs-boost: dim with slight warm cast */
[data-theme="sunset"] .nexus-node.needs-boost .nexus-avatar-wrap {
  opacity: 0.70;
  filter: saturate(0.55) brightness(0.92);
}

/* ── Avatar ring: visible border + dark depth shadow ── */
[data-theme="sunset"] .nexus-avatar-wrap {
  border-width: 2.5px;
  border-color: color-mix(in srgb, var(--mood) 80%, rgba(60,15,5,0.30));
  box-shadow: 0 2px 10px rgba(60,20,5,0.22),
              0 0 12px color-mix(in srgb, var(--mood) 28%, transparent);
}

/* ── Tap ring: thicker, fully opaque mood color ── */
[data-theme="sunset"] .nexus-node::after {
  border: 2px solid color-mix(in srgb, var(--mood) 90%, rgba(60,15,5,0.25));
}

/* ── Burst ring: higher-opacity on light bg ── */
[data-theme="sunset"] .nexus-node-burst.active {
  animation: nexus-burst-ring-su 1.8s ease-out forwards;
}
@keyframes nexus-burst-ring-su {
  0%   { box-shadow: 0 0 0 0   color-mix(in srgb, var(--mood) 80%, rgba(0,0,0,0.20)); opacity: 1; }
  14%  { box-shadow: 0 0 0 13px color-mix(in srgb, var(--mood) 70%, rgba(0,0,0,0.15)); }
  100% { box-shadow: 0 0 0 26px color-mix(in srgb, var(--mood) 0%,  transparent);     opacity: 0; }
}

/* ── Resonate button fire flash: stronger on light bg ── */
[data-theme="sunset"] .nexus-resonate.firing {
  animation: nexus-resonate-fire-su 0.52s ease-out;
}
@keyframes nexus-resonate-fire-su {
  0%   { transform: scale(1); }
  22%  { transform: scale(0.95);
         box-shadow: 0 0 22px 8px color-mix(in srgb, var(--mood) 55%, rgba(0,0,0,0.15)); }
  100% { transform: scale(1);
         box-shadow: 0 0 10px 3px color-mix(in srgb, var(--mood) 25%, transparent); }
}

/* ── Text: dark shadow lifts text off warm stage ── */
[data-theme="sunset"] .nexus-node-name {
  color: rgba(24,8,2,0.96);
  font-weight: 800;
  text-shadow: 0 1px 4px rgba(255,235,210,0.95), 0 -1px 2px rgba(255,235,210,0.7);
}
[data-theme="sunset"] .nexus-node-meta {
  color: rgba(60,24,6,0.82);
  text-shadow: 0 1px 3px rgba(255,235,210,0.8);
}

/* ── Header & back button ── */
[data-theme="sunset"] .nexus-back {
  border-color: rgba(160,64,16,0.22);
  color: rgba(80,38,14,0.75);
  background: rgba(255,225,200,0.40);
}
/* ── Detail panel ── */
[data-theme="sunset"] .nexus-detail-name { color: rgba(22,6,0,0.96); font-weight: 800; }
[data-theme="sunset"] .nexus-detail-sub  { color: rgba(60,24,6,0.85); }
[data-theme="sunset"] .nexus-mood-line   { color: rgba(60,24,6,0.78); }
/* ── Avatar dot border ── */
[data-theme="sunset"] .nexus-avatar-dot {
  border-color: rgba(255,220,185,0.95);
}
/* ── Resonate button ── */
[data-theme="sunset"] .nexus-resonate {
  border-color: color-mix(in srgb, var(--mood) 52%, rgba(120,40,10,0.25));
  color: rgba(32,14,6,0.88);
}
[data-theme="sunset"] .nexus-resonate.boost-mode {
  border-color: rgba(200,100,0,0.60);
  background: rgba(255,149,0,0.18);
  color: rgba(32,14,6,0.88);
}
/* ── Mood chip ── */
[data-theme="sunset"] .mood-chip {
  border-color: rgba(160,64,16,0.18);
  background: rgba(255,215,180,0.28);
  color: rgba(60,28,8,0.82);
}
[data-theme="sunset"] .mood-chip.active {
  border-color: var(--mood);
  background: color-mix(in srgb, var(--mood) 20%, rgba(255,220,190,0.35));
}
[data-theme="sunset"] .nexus-boost-tag { color: #B04800; }

html, body, #root {
  background: var(--base);
  overflow: hidden;
  height: var(--app-height, 100vh);
  /* Prevent horizontal scroll / visual-viewport drift on iOS Safari */
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overscroll-behavior-x: none;
  touch-action: pan-y;
}

body {
  font-family: var(--font);
  color: var(--text);
  min-height: var(--app-height, 100vh);
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ── World Layer ── */
.ath-root {
  height: var(--app-height, 100vh);
  min-height: var(--app-height, 100vh);
  width: 100%;
  max-width: 100%;
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
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.ath-screen-host {
  position: relative;
  z-index: 2;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.screen-pad {
  flex: 1; display: flex; flex-direction: column;
  padding-top: env(safe-area-inset-top, 0px);
  padding-left: max(1rem, env(safe-area-inset-left, 0px));
  padding-right: max(1rem, env(safe-area-inset-right, 0px));
  padding-bottom: 0;
  max-width: var(--max-w);
  margin: 0 auto;
  width: 100%;
  min-height: 0;
  overflow: hidden;
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
  color: var(--text-m);
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
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
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
  padding: 1.25rem 0 calc(var(--bottom-nav-h, 76px) + 1.25rem);
  gap: 1rem;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
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
  grid-template-columns: 1fr;
  gap: 10px;
}

.bento-hero {
  background: rgba(15,16,20,0.24);
  grid-column: 1;
  aspect-ratio: 2 / 1;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: transform 0.2s var(--spring-heavy);
  min-height: 140px;
}
.bento-hero:active { transform: scale(0.99); }

.bento-card {
  background: rgba(15,16,20,0.24);
  aspect-ratio: 2 / 1;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: transform 0.2s var(--spring-heavy), border-color 0.2s;
  min-height: 140px;
}
.bento-card:hover { transform: scale(1.015); border-color: var(--gb-hi); }
.bento-card:active { transform: scale(0.98); }

[data-theme="sunset"] .bento-hero,
[data-theme="sunset"] .bento-card {
  background: rgba(255,232,208,0.24);
}

/* Full-bleed illustration fills the card */
.bento-illus {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  display: block; pointer-events: none;
  opacity: 1;
}

.bento-illus-img {
  object-fit: cover;
  object-position: center;
  user-select: none;
  -webkit-user-drag: none;
}

.bento-illus-plan,
.bento-illus-home {
  transform: scale(1.02);
}

/* Text overlay at bottom of card */
.bento-overlay {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 0.7rem 0.9rem;
  background: linear-gradient(transparent, rgba(0,0,0,0.32) 90%);
  z-index: 2;
  display: flex; flex-direction: column; gap: 0.18rem;
}
[data-theme="sunset"] .bento-overlay {
  background:
    linear-gradient(180deg, rgba(255,248,238,0) 0%, rgba(255,235,214,0.16) 38%, rgba(255,176,128,0.34) 100%);
  box-shadow: inset 0 -1px 0 rgba(255,244,230,0.18);
}
.bento-overlay-top {
  position: absolute; top: 0; left: 0; right: 0;
  padding: 0.6rem 0.9rem;
  z-index: 2;
}

/* Keep .bento-icon for Edge Node row */
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
.bento-icon-svg { width: 18px; height: 18px; display: block; }

@keyframes bento-dot-pulse {
  0%,100% { opacity: 0.35; r: 2.5; }
  50%      { opacity: 0.9;  r: 3.8; }
}
@keyframes bento-dot-pulse-slow {
  0%,100% { opacity: 0.25; }
  50%      { opacity: 0.65; }
}

.action-badge-svg {
  width: 100%; height: 100%;
  display: block;
}

.bento-tag {
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.55);
}
[data-theme="sunset"] .bento-tag {
  color: var(--em-a);
  text-shadow: 0 1px 8px rgba(60,14,0,0.35);
}

.bento-label {
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.92);
  line-height: 1.1;
}
[data-theme="sunset"] .bento-label { color: rgba(255,235,210,0.96); }

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
  /* Anchor to physical screen edges including side safe areas */
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
  z-index: 10;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  background: var(--nav-bg, rgba(5,6,10,0.85));
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  border-top: 1px solid var(--gb);
  display: flex;
  padding-top: 0.5rem;
  padding-bottom: calc(0.5rem + env(safe-area-inset-bottom, 0px));
}

.nav-item {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center; gap: 4px;
  padding: 0.4rem 0.25rem;
  background: none; border: none;
  cursor: pointer;
  transition: opacity 0.15s;
  color: var(--text-d);
  position: relative;
  min-width: 0;
}

.nav-item.active { color: var(--em-b); }

.nav-item.unread {
  color: var(--em-b);
  text-shadow: 0 0 12px rgba(var(--em-b-rgb),0.38);
}

.nav-icon {
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  position: relative;
}

.nav-icon-svg {
  width: 20px; height: 20px;
  display: block;
}

.nav-item.active .nav-icon-svg {
  filter: drop-shadow(0 0 5px rgba(var(--em-b-rgb),0.6));
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
  padding: 2rem 0 calc(var(--bottom-nav-h, 76px) + 1rem);
  gap: 0;
  overflow-y: auto;
  overflow-x: hidden;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
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
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
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
  min-width: 0;
  padding-top: env(safe-area-inset-top, 0px);
  position: relative;
  z-index: 5;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
}
.live-root::-webkit-scrollbar { display: none; }

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

/* Both themes: suppress all aurora overlays and shake on LiveScreen */
[data-theme="sunset"] .cam-aurora,
[data-theme="sunset"] .cam-aurora.good,
[data-theme="sunset"] .cam-aurora.warn,
[data-theme="deep_space"] .cam-aurora,
[data-theme="deep_space"] .cam-aurora.good,
[data-theme="deep_space"] .cam-aurora.warn {
  background: none;
  animation: none;
}

@keyframes aurora-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-1px); }
  75% { transform: translateX(1px); }
}

.cam-placeholder {
  position: relative; z-index: 2;
  width: 100%;
  height: 100%;
  display: flex; align-items: center; justify-content: center;
}
.cam-init-overlay {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 24px;
}
.cam-init-spinner {
  width: 36px; height: 36px;
  border-radius: 50%;
  border: 2px solid rgba(var(--em-a-rgb), 0.15);
  border-top-color: rgba(var(--em-a-rgb), 0.9);
  transition: opacity 0.4s;
}
.cam-init-spinner.active { animation: cam-spin 1s linear infinite; opacity: 1; }
.cam-init-spinner.dim    { opacity: 0.35; animation: cam-spin 2s linear infinite; }
@keyframes cam-spin { to { transform: rotate(360deg); } }
.cam-init-label {
  font: 600 13px/1.4 var(--font-ui, sans-serif);
  color: rgba(var(--em-a-rgb), 0.9);
  letter-spacing: 0.04em;
  text-align: center;
}
.cam-init-sub {
  font: 400 11px/1.4 var(--font-ui, sans-serif);
  color: rgba(255,255,255,0.35);
  text-align: center;
}

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
  padding: 5px 12px;
  font-size: 1.3rem;
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
  max-height: min(30svh, 260px);
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

.action-arm-hint {
  margin-top: 0.18rem;
  font-size: 0.52rem;
  font-weight: 800;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: rgba(var(--em-a-rgb), 0.72);
}

.action-empty {
  padding: 0.9rem 1rem;
  color: var(--text-d);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.action-hidden-count {
  padding: 0.55rem 1rem 0.7rem;
  color: var(--text-d);
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.13em;
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
  font-size: 1.4rem;
  padding: 5px 12px;
  background: rgba(3,5,8,0.7);
  border: 1px solid var(--gb);
  border-radius: 6px;
  color: var(--text-m);
}

.classify-badge {
  position: absolute;
  top: 62px;
  right: 12px;
  max-width: min(68%, 260px);
  display: flex;
  align-items: center;
  gap: 0.42rem;
  padding: 5px 10px;
  background: rgba(3,5,8,0.72);
  border: 1px solid rgba(var(--em-a-rgb),0.24);
  border-radius: 7px;
  color: rgba(240,245,255,0.82);
  font-size: 1.24rem;
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
  position: absolute; top: 118px; left: 0; right: 0;
  display: flex; justify-content: center;
  pointer-events: none;
}

.hint-pill {
  background: rgba(255,45,85,0.14);
  border: 1px solid rgba(255,45,85,0.45);
  border-radius: 20px;
  padding: 8px 20px;
  font-size: 1.18rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: rgba(255,140,150,0.95);
  text-align: center;
  animation: hint-in 0.25s ease;
}
[data-theme="sunset"] .hint-pill {
  background: rgba(204,14,106,0.10);
  border-color: rgba(204,14,106,0.40);
  color: #1A0804;
}

@keyframes hint-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.arm-hint-badge {
  position: absolute; bottom: 14px;
  display: flex; align-items: center; gap: 5px;
  background: rgba(3,5,8,0.72);
  border: 1px solid rgba(var(--em-a-rgb),0.32);
  border-radius: 7px;
  padding: 4px 8px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  pointer-events: none;
}
.arm-hint-badge.left  { left: 14px; }
.arm-hint-badge.right { right: 14px; }
.arm-hint-arrow {
  font-size: 0.9rem; line-height: 1;
  color: rgba(var(--em-a-rgb),0.85);
}
.arm-hint-label {
  font-size: 0.58rem; font-weight: 800;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: rgba(var(--em-a-rgb),0.9);
}

.session-bar {
  padding: 0.85rem 1.25rem;
  border-top: 1px solid var(--gb);
  background: rgba(5,6,10,0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex; flex-direction: column; gap: 0.65rem;
  position: sticky;
  bottom: 0;
  z-index: 5;
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
  display: inline-flex;
  width: 26px; height: 26px;
  flex-shrink: 0;
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
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
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

.nexus-share-panel {
  padding: 1rem;
  display: grid;
  gap: 0.85rem;
}

.nexus-share-title {
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text);
}

.nexus-share-sub {
  margin-top: 0.25rem;
  font-size: 0.78rem;
  line-height: 1.45;
  color: var(--text-m);
}

.mood-picker {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.38rem;
}

.mood-chip {
  min-width: 0;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
  color: var(--text-m);
  border-radius: 12px;
  padding: 0.46rem 0.24rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.24rem;
  font-family: var(--font);
  font-size: 0.68rem;
  cursor: pointer;
  transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
}

.mood-chip.active {
  color: var(--text);
  border-color: var(--mood);
  background: color-mix(in srgb, var(--mood) 15%, transparent);
  box-shadow: 0 0 20px color-mix(in srgb, var(--mood) 28%, transparent);
}

.mood-chip:active { transform: scale(0.96); }
.mood-chip .mood-avatar { width: 28px; height: 28px; }
.nexus-share-btn { padding: 0.82rem 1rem; font-size: 0.76rem; }

/* ── Nexus Check-ins ── */
.nexus-wrap {
  flex: 1; min-height: 0; display: flex; flex-direction: column;
  padding: 1.5rem 0 calc(var(--bottom-nav-h, 76px) + 1rem);
  gap: 0.85rem;
  overflow-y: auto;
  overflow-x: hidden;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
}
.nexus-wrap > * { flex-shrink: 0; }

.nexus-header {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding-top: 0.5rem;
}

.nexus-back {
  flex: 0 0 auto;
  border: 1px solid var(--gb);
  color: var(--text-m);
  background: rgba(255,255,255,0.04);
  border-radius: 999px;
  padding: 0.48rem 0.75rem;
  font-family: var(--font);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.nexus-stage {
  min-height: 430px;
  height: min(58svh, 520px);
  border-radius: 22px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 52%, rgba(var(--em-a-rgb),0.18), transparent 34%),
    radial-gradient(circle at 18% 24%, rgba(0,122,255,0.12), transparent 28%),
    radial-gradient(circle at 82% 70%, rgba(255,184,0,0.10), transparent 26%),
    rgba(10,12,16,0.36);
}

.nexus-stage::after {
  content: "";
  position: absolute;
  inset: 14%;
  border: 1px dashed rgba(255,255,255,0.08);
  border-radius: 48%;
  animation: nexus-orbit 18s linear infinite;
  pointer-events: none;
}

.nexus-links {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
}

.nexus-links line {
  stroke: rgba(var(--em-a-rgb),0.18);
  stroke-width: 0.32;
  stroke-linecap: round;
  stroke-dasharray: 3 4;
  animation: nexus-link-flow 4.8s ease-in-out infinite;
}

.nexus-links line.active {
  stroke: rgba(var(--em-b-rgb),0.66);
  stroke-width: 0.55;
  filter: drop-shadow(0 0 8px rgba(var(--em-b-rgb),0.75));
}

.nexus-node {
  position: absolute;
  z-index: 2;
  transform: translate(-50%, -50%);
  width: 96px;
  min-height: 104px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text);
  font-family: var(--font);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  animation: nexus-float 4.8s ease-in-out infinite;
}

.nexus-node::before {
  content: "";
  position: absolute;
  width: 78px;
  height: 78px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--mood) 18%, transparent);
  filter: blur(18px);
  opacity: 0.75;
  transition: opacity 0.18s ease, transform 0.18s ease;
  animation: nexus-breathe-glow 3.8s ease-in-out infinite;
}

.nexus-node.active::before,
.nexus-node.mine::before {
  opacity: 1;
  transform: scale(1.22);
  animation: none;
}

.nexus-node::after {
  content: "";
  position: absolute;
  width: 60px; height: 60px;
  border-radius: 50%;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%) scale(0);
  border: 1.5px solid color-mix(in srgb, var(--mood) 80%, transparent);
  opacity: 0;
  pointer-events: none;
  z-index: 4;
}
.nexus-node.tapping::after {
  animation: nexus-tap-ring 0.42s ease-out forwards;
}
@keyframes nexus-tap-ring {
  0%   { transform: translate(-50%, -50%) scale(0.5); opacity: 0.9; }
  100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
}
@keyframes nexus-breathe-glow {
  0%, 100% { transform: scale(1);    opacity: 0.6; }
  50%       { transform: scale(1.35); opacity: 0.92; }
}

.nexus-node .mood-avatar {
  position: relative;
  z-index: 1;
  filter: drop-shadow(0 0 14px color-mix(in srgb, var(--mood) 58%, transparent));
}

.nexus-node-name,
.nexus-node-meta {
  position: relative;
  z-index: 1;
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 1px 8px rgba(0,0,0,0.72);
}

.nexus-node-name {
  margin-top: 0.25rem;
  font-size: 0.68rem;
  font-weight: 800;
}

.nexus-node-meta {
  margin-top: 0.1rem;
  font-family: var(--mono);
  font-size: 0.56rem;
  color: var(--text-m);
}

.nexus-detail {
  padding: 1rem;
  display: grid;
  gap: 0.8rem;
}

.nexus-detail-main {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.nexus-detail-name {
  font-size: 0.92rem;
  font-weight: 800;
  color: var(--text);
}

.nexus-detail-sub {
  margin-top: 0.22rem;
  font-size: 0.76rem;
  line-height: 1.45;
  color: var(--text-m);
}

.nexus-mood-line {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-family: var(--mono);
  font-size: 0.72rem;
  color: var(--text-m);
}

.nexus-resonate {
  border: 1px solid color-mix(in srgb, var(--mood) 44%, transparent);
  background: color-mix(in srgb, var(--mood) 13%, rgba(255,255,255,0.02));
  color: var(--text);
  border-radius: 12px;
  padding: 0.82rem 1rem;
  font-family: var(--font);
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 0 0 18px color-mix(in srgb, var(--mood) 20%, transparent);
}

.mood-avatar {
  display: block;
  overflow: visible;
}

/* ── Nexus DiceBear avatar ── */
.nexus-avatar-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--mood) 58%, transparent);
  box-shadow: 0 0 18px color-mix(in srgb, var(--mood) 36%, transparent),
              inset 0 0 8px color-mix(in srgb, var(--mood) 12%, transparent);
  overflow: hidden;
  flex-shrink: 0;
}
.nexus-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  filter: saturate(1.15);
}
.nexus-avatar-dot {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--mood);
  border: 2px solid rgba(3,5,8,0.9);
  box-shadow: 0 0 6px var(--mood);
}

@keyframes nexus-orbit {
  0% { transform: rotate(0deg) scale(1); opacity: 0.45; }
  50% { transform: rotate(180deg) scale(1.08); opacity: 0.72; }
  100% { transform: rotate(360deg) scale(1); opacity: 0.45; }
}

@keyframes nexus-link-flow {
  0%, 100% { stroke-dashoffset: 0; opacity: 0.45; }
  50% { stroke-dashoffset: -12; opacity: 0.86; }
}

@keyframes nexus-float {
  0%, 100% { margin-top: 0; }
  50% { margin-top: -10px; }
}

/* ── DTW-based node tiers ── */
/* High performer: full glow */
.nexus-node.shining .nexus-avatar-wrap {
  box-shadow: 0 0 22px color-mix(in srgb, var(--mood) 52%, transparent),
              inset 0 0 10px color-mix(in srgb, var(--mood) 18%, transparent);
}
.nexus-node.shining::before {
  background: color-mix(in srgb, var(--mood) 26%, transparent);
}
/* Low performer: dimmed, desaturated */
.nexus-node.needs-boost .nexus-avatar-wrap {
  opacity: 0.68;
  filter: saturate(0.55);
}
.nexus-node.needs-boost::before {
  opacity: 0.42;
  background: color-mix(in srgb, var(--mood) 10%, transparent);
}

/* Amber support badge on needy nodes */
.nexus-boost-badge {
  position: absolute; top: -3px; right: -3px;
  width: 13px; height: 13px;
  border-radius: 50%;
  background: #FFB800;
  border: 2px solid rgba(3,5,8,0.92);
  box-shadow: 0 0 8px rgba(255,184,0,0.75);
  animation: nexus-boost-pulse 2.1s ease-in-out infinite;
  z-index: 5; pointer-events: none;
}
@keyframes nexus-boost-pulse {
  0%, 100% { transform: scale(1);   opacity: 0.8; }
  50%       { transform: scale(1.35); opacity: 1;   }
}

/* Support-need label in detail panel */
.nexus-boost-tag {
  display: inline-block;
  margin-left: 0.45rem;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #FFB800;
}

/* Resonance burst ring overlay */
.nexus-node-burst {
  position: absolute; inset: -12px;
  border-radius: 50%; pointer-events: none; z-index: 3;
}
.nexus-node-burst.active {
  animation: nexus-burst-ring 1.8s ease-out forwards;
}
@keyframes nexus-burst-ring {
  0%   { box-shadow: 0 0 0 0   color-mix(in srgb, var(--mood) 70%, transparent); opacity: 1; }
  14%  { box-shadow: 0 0 0 14px color-mix(in srgb, var(--mood) 60%, transparent); }
  100% { box-shadow: 0 0 0 28px color-mix(in srgb, var(--mood) 0%,  transparent); opacity: 0; }
}

/* Stage ambient breathing div */
.nexus-stage-pulse {
  position: absolute; inset: 0;
  border-radius: inherit; pointer-events: none; z-index: 0;
  background: radial-gradient(circle at 50% 50%,
    rgba(0,219,233,0.09), transparent 52%);
  animation: nexus-ambient-breathe 5.4s ease-in-out infinite;
}
@keyframes nexus-ambient-breathe {
  0%, 100% { opacity: 0.42; transform: scale(0.88); }
  50%       { opacity: 1;    transform: scale(1.12); }
}

/* Resonate button firing flash */
.nexus-resonate.firing {
  animation: nexus-resonate-fire 0.52s ease-out;
}
.nexus-resonate.boost-mode {
  border-color: color-mix(in srgb, #FFB800 50%, transparent);
  background: color-mix(in srgb, #FFB800 14%, rgba(255,255,255,0.02));
  box-shadow: 0 0 22px color-mix(in srgb, #FFB800 24%, transparent);
}
@keyframes nexus-resonate-fire {
  0%   { transform: scale(1); }
  22%  { transform: scale(0.95);
         box-shadow: 0 0 30px 10px color-mix(in srgb, var(--mood) 60%, transparent); }
  100% { transform: scale(1);
         box-shadow: 0 0 18px  4px color-mix(in srgb, var(--mood) 22%, transparent); }
}

@media (max-width: 420px) {
  .mood-picker { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.25rem; }
  .mood-chip { font-size: 0.62rem; padding: 0.42rem 0.16rem; }
  .nexus-stage { min-height: 390px; height: 54svh; }
  .nexus-node { width: 82px; }
  .nexus-node-name, .nexus-node-meta { max-width: 82px; }
  .nexus-node-name { font-size: 0.62rem; }
}

/* ── Profile Screen ── */
.profile-wrap {
  flex: 1; min-height: 0; display: flex; flex-direction: column;
  padding: 1.5rem 0 calc(var(--bottom-nav-h, 76px) + 1.25rem);
  gap: 0.85rem;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
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
  fill: rgba(255,255,255,0.024);
  stroke: rgba(255,255,255,0.15);
  stroke-width: 1.45;
  vector-effect: non-scaling-stroke;
}

.body-guide {
  fill: none;
  stroke: rgba(255,255,255,0.10);
  stroke-width: 1;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.body-face-line {
  fill: none;
  stroke: rgba(255,255,255,0.20);
  stroke-width: 1.1;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}

.body-anatomy-line {
  fill: none;
  stroke: rgba(255,255,255,0.16);
  stroke-width: 1.15;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}

.muscle-shape {
  stroke: rgba(3,5,8,0.62);
  stroke-width: 1.35;
  vector-effect: non-scaling-stroke;
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
  stroke: rgba(var(--muscle-radar-rgb),0.92);
  stroke-width: 2;
  filter: drop-shadow(0 0 8px rgba(var(--muscle-radar-rgb),0.8));
}

.muscle-selection-ring {
  fill: none;
  stroke: var(--muscle-radar);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 1.4 6.2;
  vector-effect: non-scaling-stroke;
  opacity: 0;
  pointer-events: none;
  animation: muscle-radar-pulse 1.05s ease-in-out infinite;
  filter: drop-shadow(0 0 10px rgba(var(--muscle-radar-rgb),0.45));
}

@keyframes muscle-breathe {
  0%, 100% { filter: drop-shadow(0 0 6px rgba(var(--em-a-rgb),0.2)); }
  50% { filter: drop-shadow(0 0 16px rgba(var(--em-b-rgb),0.38)); }
}

@keyframes muscle-radar-pulse {
  0% {
    opacity: 0.18;
    stroke-width: 3.2;
    stroke-dashoffset: 0;
    filter: drop-shadow(0 0 5px rgba(var(--muscle-radar-rgb),0.25));
  }
  45% {
    opacity: 0.96;
    stroke-width: 6.6;
    filter: drop-shadow(0 0 16px rgba(var(--muscle-radar-rgb),0.62));
  }
  100% {
    opacity: 0.16;
    stroke-width: 8.4;
    stroke-dashoffset: -15;
    filter: drop-shadow(0 0 7px rgba(var(--muscle-radar-rgb),0.32));
  }
}

@keyframes muscle-radar-pulse-soft {
  0% {
    opacity: 0.42;
    stroke-width: 2;
    stroke-dashoffset: 0;
    filter:
      drop-shadow(0 0 4px rgba(255,240,166,0.52))
      drop-shadow(0 0 8px rgba(255,184,0,0.26));
  }
  45% {
    opacity: 1;
    stroke-width: 2.8;
    filter:
      drop-shadow(0 0 7px rgba(255,240,166,0.86))
      drop-shadow(0 0 14px rgba(255,184,0,0.42));
  }
  100% {
    opacity: 0.34;
    stroke-width: 3.4;
    stroke-dashoffset: -15;
    filter:
      drop-shadow(0 0 5px rgba(255,240,166,0.58))
      drop-shadow(0 0 10px rgba(255,184,0,0.30));
  }
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
  padding: 0.75rem 1rem;
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
  padding: 1.5rem 0 calc(var(--bottom-nav-h, 76px) + 1.25rem);
  gap: 0.85rem;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
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
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
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

.plan-ai-icon-svg {
  width: 16px; height: 16px;
  display: block;
}

.plan-ai-title {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text);
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

.ai-route-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.2rem;
}

.ai-core-route {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
}

.ai-chip-xs {
  font-size: 0.58rem !important;
  padding: 0.1rem 0.38rem !important;
  line-height: 1.6;
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

.plan-day-chip {
  flex-shrink: 0;
  width: 34px;
  font-size: 0.62rem;
  font-weight: 700;
  font-family: var(--mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-m);
  text-align: center;
}

.plan-day-chip.active {
  color: var(--em-b);
  text-shadow: 0 0 8px rgba(var(--em-b-rgb),0.5);
}

.plan-day-chip.rest {
  color: var(--text-d);
  opacity: 0.55;
}

.plan-item.today {
  border-bottom-color: rgba(var(--em-a-rgb),0.28);
}
.plan-item.today:not(.plan-item-rest) {
  cursor: pointer;
}
.plan-item.today:not(.plan-item-rest):hover {
  background: rgba(var(--em-b-rgb),0.06);
}

.plan-item.past {
  opacity: 0.38;
  pointer-events: none;
}

.plan-today-cta {
  font-size: 0.68rem;
  font-family: var(--mono);
  letter-spacing: 0.06em;
  color: var(--em-b);
  white-space: nowrap;
  opacity: 0.9;
}

.plan-item-rest {
  cursor: default;
}

.plan-rest-label {
  flex: 1;
  font-size: 0.7rem;
  font-family: var(--mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-d);
  opacity: 0.4;
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
  min-width: 0;
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
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--em-a);
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
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
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

/* ── Home Workout ──────────────────────────────────────────────────────────── */

.hw-wrap { flex:1; min-height:0; display:flex; flex-direction:column; padding:1.5rem 0 calc(var(--bottom-nav-h,76px) + 1rem); gap:1.1rem; overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; }
.hw-wrap > * { flex-shrink:0; }

.hw-header { display:flex; align-items:center; gap:0.85rem; padding-top:0.5rem; }
.hw-back-btn { flex:0 0 auto; border:1px solid var(--gb); color:var(--text-m); background:rgba(255,255,255,0.04); border-radius:999px; padding:0.5rem 0.85rem; font-family:var(--font); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.08em; cursor:pointer; }

.hw-select-title { font-size:1.05rem; font-weight:900; letter-spacing:0.18em; text-transform:uppercase; }
.hw-route-cards  { display:flex; flex-direction:column; gap:1rem; }
.hw-route-card   { padding:1.5rem 1.25rem; border-radius:20px; cursor:pointer; position:relative; overflow:hidden; background:rgba(255,255,255,0.03); border:1.5px solid rgba(255,255,255,0.1); display:flex; flex-direction:column; gap:0.45rem; -webkit-tap-highlight-color:transparent; transition:transform 0.15s; }
.hw-route-card:active { transform:scale(0.98); }
.hw-route-glow   { position:absolute; inset:-40%; border-radius:50%; opacity:0.13; pointer-events:none; }
.hw-route-badge  { font-size:0.6rem; font-weight:700; letter-spacing:0.2em; text-transform:uppercase; opacity:0.65; }
.hw-route-name   { font-size:1.55rem; font-weight:900; letter-spacing:0.1em; text-transform:uppercase; line-height:1.05; }
.hw-route-tag    { font-size:0.78rem; opacity:0.6; }
.hw-step-chips   { display:flex; gap:0.4rem; flex-wrap:wrap; margin-top:0.35rem; }
.hw-step-chip    { font-size:0.6rem; font-family:var(--mono); letter-spacing:0.05em; padding:0.22rem 0.55rem; border-radius:999px; background:rgba(255,255,255,0.06); color:var(--text-m); border:1px solid rgba(255,255,255,0.1); }

.hw-map-route-name { font-size:1.4rem; font-weight:900; letter-spacing:0.12em; text-transform:uppercase; }
.hw-map-route-tag  { font-size:0.78rem; opacity:0.58; margin-top:0.1rem; }
.hw-node-list { display:flex; flex-direction:column; padding:0 6px; margin:0 auto; max-width:380px; width:100%; }
.hw-node-row  { display:flex; align-items:flex-start; gap:1rem; -webkit-tap-highlight-color:transparent; }
.hw-node-row.active { cursor:pointer; }
.hw-node-row.active:active { opacity:0.72; }
.hw-node-spine { display:flex; flex-direction:column; align-items:center; flex-shrink:0; width:44px; }
.hw-node-circle { width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.1rem; font-weight:900; border:2px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.04); flex-shrink:0; position:relative; z-index:1; }
.hw-node-circle.done   { background:rgba(0,219,233,0.18); border-color:rgba(0,219,233,0.6); color:#00DBE9; }
.hw-node-circle.active { animation:hw-pulse 2.2s ease-in-out infinite; }
.hw-node-circle.locked { opacity:0.3; cursor:not-allowed; }
@keyframes hw-pulse { 0%,100%{transform:scale(1);box-shadow:0 0 0 0 currentColor} 50%{transform:scale(1.07);box-shadow:0 0 16px 4px currentColor} }
.hw-node-line   { width:2px; flex:1; min-height:28px; margin:2px 0; background:rgba(255,255,255,0.1); }
.hw-node-line.done-line { background:rgba(0,219,233,0.4); }
.hw-node-info   { flex:1; padding:0.7rem 0; }
.hw-node-label  { font-size:1rem; font-weight:800; letter-spacing:0.03em; }
.hw-node-label.locked { opacity:0.3; }
.hw-node-meta   { font-size:0.7rem; font-family:var(--mono); color:var(--text-m); margin-top:0.18rem; letter-spacing:0.04em; }
.hw-node-tap    { font-size:0.6rem; text-transform:uppercase; letter-spacing:0.14em; margin-top:0.28rem; opacity:0.7; animation:hw-blink 1.8s ease-in-out infinite; }
@keyframes hw-blink { 0%,100%{opacity:0.7} 50%{opacity:1} }

.hw-kini-section { display:flex; flex-direction:column; align-items:center; gap:0.65rem; padding:0.25rem 0; }
.hw-kini-bubble  { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); border-radius:18px; border-bottom-left-radius:4px; padding:0.8rem 1rem; font-size:0.88rem; line-height:1.5; max-width:290px; width:100%; position:relative; }
.hw-kini-bubble::after { content:""; position:absolute; bottom:-8px; left:18px; border:8px solid transparent; border-top-color:rgba(255,255,255,0.12); border-bottom:none; border-left:none; }
.hw-kini-name   { font-size:0.6rem; font-weight:700; letter-spacing:0.16em; text-transform:uppercase; color:#00DBE9; margin-bottom:0.28rem; }

.hw-between-big  { font-size:2rem; font-weight:900; letter-spacing:0.07em; text-transform:uppercase; line-height:1.05; }
.hw-between-sub  { font-size:0.82rem; opacity:0.6; margin-top:0.15rem; }
.hw-next-card    { background:rgba(255,255,255,0.04); border:1.5px solid rgba(255,255,255,0.1); border-radius:16px; padding:1rem 1.2rem; display:flex; flex-direction:column; gap:0.22rem; }
.hw-next-lbl     { font-size:0.62rem; letter-spacing:0.16em; text-transform:uppercase; opacity:0.5; }
.hw-next-name    { font-size:1.05rem; font-weight:800; }
.hw-next-meta    { font-size:0.7rem; font-family:var(--mono); opacity:0.55; margin-top:0.08rem; }

.hw-reward-hero  { text-align:center; padding:0.75rem 0 0.25rem; }
.hw-reward-title { font-size:2rem; font-weight:900; letter-spacing:0.1em; text-transform:uppercase; line-height:1.1; background:linear-gradient(135deg,#00DBE9,#A855F7 55%,#FF4FF0); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.hw-reward-sub   { font-size:0.82rem; opacity:0.58; margin-top:0.35rem; }
.hw-stats-row    { display:flex; gap:0.7rem; }
.hw-stat-block   { flex:1; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:14px; padding:0.8rem 0.6rem; text-align:center; }
.hw-stat-val     { font-size:1.55rem; font-weight:900; font-family:var(--mono); }
.hw-stat-lbl     { font-size:0.6rem; letter-spacing:0.14em; text-transform:uppercase; opacity:0.5; margin-top:0.18rem; }
.hw-muscle-panel { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:1rem 1.1rem; display:flex; flex-direction:column; gap:0.6rem; }
.hw-muscle-ptitle{ font-size:0.62rem; letter-spacing:0.16em; text-transform:uppercase; opacity:0.5; }
.hw-muscle-row   { display:flex; align-items:center; gap:0.6rem; }
.hw-muscle-mname { font-size:0.7rem; font-family:var(--mono); width:88px; flex-shrink:0; opacity:0.78; text-transform:capitalize; }
.hw-muscle-track { flex:1; height:6px; border-radius:3px; background:rgba(255,255,255,0.08); overflow:hidden; }
.hw-muscle-fill  { height:100%; border-radius:3px; background:linear-gradient(90deg,#00DBE9,#A855F7); box-shadow:0 0 8px rgba(0,219,233,0.45); transition:width 1.1s cubic-bezier(0.22,1,0.36,1); }
.hw-collect-btn  { width:100%; padding:1.05rem; font-size:0.82rem; font-weight:900; letter-spacing:0.18em; text-transform:uppercase; font-family:var(--font); background:linear-gradient(135deg,#00DBE9,#A855F7); color:#030508; border:none; border-radius:16px; cursor:pointer; box-shadow:0 0 28px rgba(0,219,233,0.3); transition:transform 0.15s; }
.hw-collect-btn:active { transform:scale(0.97); }

.cardio-wrap  { flex:1; min-height:0; display:flex; flex-direction:column; padding:1.5rem 0 calc(var(--bottom-nav-h,76px) + 1rem); gap:1rem; align-items:center; overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; }
.cardio-wrap > * { flex-shrink:0; }
.cardio-cam-embed { width:72%; aspect-ratio:3/4; border-radius:16px; overflow:hidden; position:relative; background:#050c14; flex-shrink:0; }
.cardio-cam-ph { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:#050c14; }
.cardio-header { align-self:stretch; }
.cardio-fig    { flex:1; width:100%; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.02); border-radius:20px; border:1px solid rgba(255,255,255,0.06); min-height:160px; max-height:280px; overflow:hidden; }
.cardio-sway   { animation:cardio-sway 1.8s ease-in-out infinite; }
.cardio-sway.paused { animation-play-state:paused; opacity:0.4; }
@keyframes cardio-sway { 0%,100%{transform:rotate(-3deg) translateY(0)} 50%{transform:rotate(3deg) translateY(-5px)} }
.cardio-timer-block { text-align:center; }
.cardio-timer  { font-size:4.5rem; font-weight:900; font-family:var(--mono); letter-spacing:0.04em; line-height:1; transition:color 0.5s; }
.cardio-timer.warn   { color:#FFA040; }
.cardio-timer.urgent { color:#FF3020; }
.cardio-phrase { font-size:1.2rem; font-weight:900; letter-spacing:0.13em; text-transform:uppercase; min-height:1.7rem; text-align:center; margin-top:0.3rem; animation:phrase-pop 0.35s cubic-bezier(0.22,1,0.36,1); }
@keyframes phrase-pop { from{transform:scale(0.6);opacity:0} to{transform:scale(1);opacity:1} }
.cardio-status { display:flex; align-items:center; justify-content:center; gap:0.45rem; font-size:0.7rem; letter-spacing:0.12em; text-transform:uppercase; opacity:0.65; }
.cardio-dot    { width:7px; height:7px; border-radius:50%; background:#00DBE9; animation:dot-blink 1.2s ease-in-out infinite; }
.cardio-dot.paused { background:#FFA040; animation:none; }
@keyframes dot-blink { 0%,100%{opacity:1} 50%{opacity:0.25} }

.hw-live-overlay { position:absolute; inset:0; pointer-events:none; z-index:20; display:flex; align-items:flex-end; justify-content:center; padding-bottom:5.5rem; }
.hw-live-word    { font-size:2.6rem; font-weight:900; letter-spacing:0.1em; text-transform:uppercase; text-shadow:0 0 32px currentColor; animation:hw-word-pop 1.4s cubic-bezier(0.22,1,0.36,1) forwards; line-height:1; text-align:center; }
@keyframes hw-word-pop { 0%{transform:scale(0.5);opacity:0} 20%{transform:scale(1.12);opacity:1} 45%{transform:scale(1);opacity:1} 78%{opacity:1} 100%{transform:scale(0.88);opacity:0} }
.hw-rep-big      { font-size:5rem; font-weight:900; font-family:var(--mono); letter-spacing:-0.02em; line-height:1; text-align:center; }
.hw-rep-lbl      { font-size:0.7rem; letter-spacing:0.22em; text-transform:uppercase; opacity:0.5; text-align:center; margin-top:0.12rem; }

/* ── Home Workout colour tokens ── */
:root {
  --hw-a: #00DBE9; --hw-b: #A855F7;
  --hw-a-dim: rgba(0,219,233,0.27); --hw-b-dim: rgba(168,85,247,0.27);
  --hw-card: rgba(255,255,255,0.04); --hw-border: rgba(255,255,255,0.1);
  --hw-em: #00DBE9; --hw-text: var(--text);
}
[data-theme="sunset"] {
  --hw-a: #FF7A35; --hw-b: #FF3D6E;
  --hw-a-dim: rgba(255,122,53,0.3); --hw-b-dim: rgba(255,61,110,0.3);
  --hw-card: rgba(120,40,5,0.14); --hw-border: rgba(200,80,20,0.28);
  --hw-em: #FF7A35; --hw-text: rgba(32,14,6,0.92);
}
[data-theme="sunset"] .hw-route-card     { background:var(--hw-card); border-color:var(--hw-border); }
[data-theme="sunset"] .hw-next-card      { background:var(--hw-card); border-color:var(--hw-border); }
[data-theme="sunset"] .hw-stat-block     { background:var(--hw-card); border-color:var(--hw-border); }
[data-theme="sunset"] .hw-muscle-panel   { background:var(--hw-card); border-color:var(--hw-border); }
[data-theme="sunset"] .hw-kini-bubble    { background:rgba(120,40,5,0.12); border-color:rgba(200,80,20,0.25); color:var(--hw-text); }
[data-theme="sunset"] .hw-kini-name      { color:var(--hw-em); }
[data-theme="sunset"] .hw-collect-btn    { background:linear-gradient(135deg,var(--hw-a),var(--hw-b)); color:rgba(32,14,6,0.95); }
[data-theme="sunset"] .hw-between-big   { color:var(--hw-text); }
[data-theme="sunset"] .hw-reward-title  { background:linear-gradient(135deg,var(--hw-a),var(--hw-b)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
[data-theme="sunset"] .cardio-fig       { background:rgba(120,40,5,0.1); border-color:rgba(200,80,20,0.18); }
[data-theme="sunset"] .hw-node-line       { background:rgba(200,80,20,0.18); }
[data-theme="sunset"] .hw-node-line.done-line { background:rgba(255,122,53,0.45); }
[data-theme="sunset"] .hw-node-circle.done    { background:rgba(255,122,53,0.18); border-color:rgba(255,122,53,0.65); color:var(--hw-a); }
[data-theme="sunset"] .hw-node-label   { color:var(--hw-text); }
[data-theme="sunset"] .hw-node-meta    { color:rgba(60,24,6,0.55); }
[data-theme="sunset"] .hw-node-tap     { opacity:0.85; }
[data-theme="sunset"] .hw-select-title { color:var(--hw-text); }
[data-theme="sunset"] .hw-map-route-tag { color:rgba(60,24,6,0.58); }
[data-theme="sunset"] .hw-back-btn     { color:var(--hw-text); border-color:rgba(120,50,10,0.35); background:rgba(120,40,5,0.1); }
[data-theme="sunset"] .hw-step-chip    { background:rgba(120,40,5,0.12); border-color:rgba(200,80,20,0.22); color:rgba(60,24,6,0.72); }
[data-theme="sunset"] .cardio-wrap     { color:var(--hw-text); }

/* ── Lottie containers ── */
.hw-lottie-demo  { display:flex; justify-content:center; align-items:center; }
.hw-lottie-rest  { display:flex; justify-content:center; align-items:center; }
.hw-lottie-top   { display:flex; justify-content:center; pointer-events:none; }
.core-thinking-row { display:flex; align-items:center; gap:0.5rem; padding:0.35rem 0 0.1rem 0.5rem; opacity:0.65; }
.core-thinking-label { font-size:0.7rem; font-family:var(--mono); letter-spacing:0.1em; color:var(--text-m); }

/* ── Inter-set rest + exercise-done screens ── */
.hw-set-header   { text-align:center; padding:0.5rem 0; }
.hw-set-badge    { font-size:0.62rem; font-weight:700; letter-spacing:0.2em; text-transform:uppercase; opacity:0.55; }
.hw-set-big      { font-size:2.2rem; font-weight:900; letter-spacing:0.07em; text-transform:uppercase; margin-top:0.2rem; line-height:1.05; }
.hw-dtw-card     { background:var(--hw-card); border:1px solid var(--hw-border); border-radius:18px; padding:1.2rem; text-align:center; }
.hw-dtw-score    { font-size:3.8rem; font-weight:900; font-family:var(--mono); line-height:1; }
.hw-dtw-label    { font-size:0.78rem; opacity:0.6; margin-top:0.2rem; }
.hw-dtw-bar      { height:6px; border-radius:3px; background:rgba(255,255,255,0.1); margin-top:0.75rem; overflow:hidden; }
.hw-dtw-fill     { height:100%; border-radius:3px; background:linear-gradient(90deg,var(--hw-a),var(--hw-b)); box-shadow:0 0 8px rgba(0,219,233,0.4); }
.hw-set-dots     { display:flex; gap:0.45rem; justify-content:center; }
.hw-set-dot      { height:6px; border-radius:3px; transition:background 0.3s; }
.hw-rest-block   { text-align:center; }
.hw-rest-label   { font-size:0.62rem; letter-spacing:0.18em; text-transform:uppercase; opacity:0.5; margin-bottom:0.25rem; }
.hw-rest-timer   { font-size:4.2rem; font-weight:900; font-family:var(--mono); line-height:1; }
.hw-per-set-row  { display:flex; gap:0.5rem; }
.hw-per-set-item { flex:1; text-align:center; background:var(--hw-card); border:1px solid var(--hw-border); border-radius:12px; padding:0.65rem 0.4rem; }
.hw-per-set-val  { font-size:1.2rem; font-weight:800; font-family:var(--mono); }
.hw-per-set-lbl  { font-size:0.58rem; letter-spacing:0.12em; text-transform:uppercase; opacity:0.5; margin-top:0.12rem; }
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
      // base drift velocity (much slower than before — sinusoid does the work)
      vx: (Math.random() - 0.5) * 0.06,
      vy: (Math.random() - 0.5) * 0.06,
      r: Math.random() * 1.5 + 0.25,
      depth: Math.random() * 0.6 + 0.2,
      // four independent random phases for sinusoidal drift (mirrors the GLSL random.xyzw)
      rnd: [Math.random(), Math.random(), Math.random(), Math.random()],
      // amplitude of sinusoidal drift in pixels (scaled by screen size on use)
      amp: Math.random() * 0.5 + 0.15,
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

      const elapsed = isFinite(nowSec) ? nowSec : 0;
      const safeDt  = isFinite(dt) ? dt : 0;
      particlesRef.current.forEach((p, i) => {
        if (!frozen) {
          const [r0, r1, r2, r3] = p.rnd;
          const scale = turbulent ? 2.8 : 1.0;
          const speedMult = turbulent ? 3.5 : 1.0;

          // sinusoidal drift — mirrors the vertex shader formula from the Particles component:
          //   pos.x += sin(t * rnd.z + 6.28 * rnd.w) * mix(0.1, 1.5, rnd.x)
          // here we compute per-frame delta (derivative * safeDt) to stay frame-rate independent
          const sineAmpX = p.amp * Math.min(W, H) * 0.04 * scale;
          const sineAmpY = p.amp * Math.min(W, H) * 0.04 * scale;
          const dxSine = Math.cos(elapsed * r2 * 0.8 + 6.28 * r3) * r0 * sineAmpX * safeDt;
          const dySine = Math.cos(elapsed * r1 * 0.8 + 6.28 * r0) * r3 * sineAmpY * safeDt;

          p.x += (p.vx + dxSine) * speedMult;
          p.y += (p.vy + dySine) * speedMult;
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

    rafRef.current = requestAnimationFrame(tick);
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
    { muscle: "shoulders", type: "path", attrs: { d: "M64 92 C72 82 88 82 98 92 C96 106 86 116 70 118 C61 111 57 101 64 92Z" } },
    { muscle: "shoulders", type: "path", attrs: { d: "M156 92 C148 82 132 82 122 92 C124 106 134 116 150 118 C159 111 163 101 156 92Z" } },
    { muscle: "chest", type: "path", attrs: { d: "M82 113 C91 100 104 99 109 115 C108 136 101 149 86 151 C78 139 77 124 82 113Z" } },
    { muscle: "chest", type: "path", attrs: { d: "M138 113 C129 100 116 99 111 115 C112 136 119 149 134 151 C142 139 143 124 138 113Z" } },
    { muscle: "biceps", type: "path", attrs: { d: "M52 116 C40 134 35 160 39 187 C54 182 64 154 70 125 C66 119 58 115 52 116Z" } },
    { muscle: "biceps", type: "path", attrs: { d: "M168 116 C180 134 185 160 181 187 C166 182 156 154 150 125 C154 119 162 115 168 116Z" } },
    { muscle: "core", type: "path", attrs: { d: "M91 153 C101 158 119 158 129 153 L125 228 C117 234 103 234 95 228Z" } },
    { muscle: "core", type: "path", attrs: { d: "M88 161 C78 180 78 205 91 229 L99 224 C92 201 94 178 103 161Z" } },
    { muscle: "core", type: "path", attrs: { d: "M132 161 C142 180 142 205 129 229 L121 224 C128 201 126 178 117 161Z" } },
    { muscle: "quads", type: "path", attrs: { d: "M80 238 C88 236 98 249 97 276 L89 337 C78 332 74 312 77 288Z" } },
    { muscle: "quads", type: "path", attrs: { d: "M102 239 C109 249 109 281 100 337 C93 324 92 291 95 267 C97 252 100 244 102 239Z" } },
    { muscle: "quads", type: "path", attrs: { d: "M140 238 C132 236 122 249 123 276 L131 337 C142 332 146 312 143 288Z" } },
    { muscle: "quads", type: "path", attrs: { d: "M118 239 C111 249 111 281 120 337 C127 324 128 291 125 267 C123 252 120 244 118 239Z" } },
    { muscle: "front_calves", type: "path", attrs: { d: "M78 337 C88 338 95 354 91 384 C89 397 83 404 76 404 C70 381 72 357 78 337Z" } },
    { muscle: "front_calves", type: "path", attrs: { d: "M142 337 C132 338 125 354 129 384 C131 397 137 404 144 404 C150 381 148 357 142 337Z" } },
  ],
  back: [
    { muscle: "shoulders", type: "path", attrs: { d: "M64 92 C72 82 88 82 98 92 C96 107 86 118 70 119 C61 111 57 101 64 92Z" } },
    { muscle: "shoulders", type: "path", attrs: { d: "M156 92 C148 82 132 82 122 92 C124 107 134 118 150 119 C159 111 163 101 156 92Z" } },
    { muscle: "upper_back", type: "path", attrs: { d: "M77 113 C91 98 129 98 143 113 C139 139 128 157 110 162 C92 157 81 139 77 113Z" } },
    { muscle: "upper_back", type: "path", attrs: { d: "M80 126 C93 141 100 168 97 194 C84 186 73 152 72 128Z" } },
    { muscle: "upper_back", type: "path", attrs: { d: "M140 126 C127 141 120 168 123 194 C136 186 147 152 148 128Z" } },
    { muscle: "lower_back", type: "path", attrs: { d: "M96 164 C104 169 116 169 124 164 L129 221 C121 229 99 229 91 221Z" } },
    { muscle: "triceps", type: "path", attrs: { d: "M52 117 C40 136 35 166 41 199 C56 192 66 157 70 126 C66 120 58 116 52 117Z" } },
    { muscle: "triceps", type: "path", attrs: { d: "M168 117 C180 136 185 166 179 199 C164 192 154 157 150 126 C154 120 162 116 168 117Z" } },
    { muscle: "hamstrings", type: "path", attrs: { d: "M80 239 C88 236 98 249 97 277 L89 337 C78 332 74 311 77 288Z" } },
    { muscle: "hamstrings", type: "path", attrs: { d: "M102 240 C110 250 111 283 100 338 C93 325 92 292 96 269 C98 254 100 245 102 240Z" } },
    { muscle: "hamstrings", type: "path", attrs: { d: "M140 239 C132 236 122 249 123 277 L131 337 C142 332 147 311 143 288Z" } },
    { muscle: "hamstrings", type: "path", attrs: { d: "M118 240 C110 250 109 283 120 338 C128 325 130 292 126 269 C124 254 120 245 118 240Z" } },
    { muscle: "rear_calves", type: "path", attrs: { d: "M78 337 C88 338 96 355 93 383 C91 397 85 405 78 405 C72 381 72 357 78 337Z" } },
    { muscle: "rear_calves", type: "path", attrs: { d: "M142 337 C132 338 124 355 127 383 C129 397 135 405 142 405 C148 381 148 357 142 337Z" } },
  ],
};

function BodySilhouette({ view }) {
  return (
    <g aria-hidden="true">
      <path className="body-silhouette head" d="M91 42 C91 26 99 17 110 17 C121 17 129 26 129 42 C129 58 121 68 110 68 C99 68 91 58 91 42Z" />
      <path className="body-silhouette ear-l" d="M91 39 C84 39 83 54 91 56" />
      <path className="body-silhouette ear-r" d="M129 39 C136 39 137 54 129 56" />
      <path className="body-silhouette torso-legs" d="M96 68 C101 78 119 78 124 68 C131 86 148 88 161 98 C151 110 146 125 145 147 L140 222 C133 229 124 234 118 237 L142 337 L150 399 C147 408 138 410 132 400 L120 337 L118 237 L102 237 L100 337 L88 400 C82 410 73 408 70 399 L78 337 L80 222 L75 147 C74 125 69 110 59 98 C72 88 89 86 96 68Z" />
      <path className="body-silhouette arm-l" d="M59 98 C42 109 33 135 31 166 C25 181 16 204 8 226 C3 239 10 249 22 245 C34 231 50 209 58 190 C68 165 76 127 76 108 C71 102 65 98 59 98Z" />
      <path className="body-silhouette arm-r" d="M161 98 C178 109 187 135 189 166 C195 181 204 204 212 226 C217 239 210 249 198 245 C186 231 170 209 162 190 C152 165 144 127 144 108 C149 102 155 98 161 98Z" />
      <path className="body-silhouette foot-l" d="M70 399 C62 406 58 413 65 419 L90 419 C97 415 96 407 88 401Z" />
      <path className="body-silhouette foot-r" d="M150 399 C158 406 162 413 155 419 L130 419 C123 415 124 407 132 401Z" />
      {view === "front" && (
        <>
          <path className="body-face-line" d="M111 42 C108 47 108 51 111 53" />
          <path className="body-face-line" d="M103 58 C107 61 113 61 117 58" />
        </>
      )}
      <path className="body-guide" d="M83 111 C96 101 124 101 137 111" />
      <path className="body-guide" d="M88 230 C101 238 119 238 132 230" />
      <path className="body-guide" d={view === "back" ? "M110 76 L110 226" : "M110 112 L110 226"} />
    </g>
  );
}

function BodyAnatomyLines({ view }) {
  const lines = view === "back"
    ? [
        "M79 115 C92 104 128 104 141 115",
        "M82 126 C92 145 99 168 96 194",
        "M138 126 C128 145 121 168 124 194",
        "M92 166 C102 174 118 174 128 166",
        "M92 222 C102 231 118 231 128 222",
        "M68 121 C51 143 43 172 37 201",
        "M152 121 C169 143 177 172 183 201",
        "M80 241 C90 268 89 304 82 336",
        "M140 241 C130 268 131 304 138 336",
        "M78 337 C84 356 84 383 72 406",
        "M142 337 C136 356 136 383 148 406",
      ]
    : [
        "M76 112 C91 102 129 102 144 112",
        "M82 122 C96 115 104 116 109 128",
        "M138 122 C124 115 116 116 111 128",
        "M88 153 C101 160 119 160 132 153",
        "M110 119 L110 226",
        "M98 166 C94 181 94 207 99 225",
        "M122 166 C126 181 126 207 121 225",
        "M70 121 C58 141 51 168 39 193",
        "M150 121 C162 141 169 168 181 193",
        "M80 242 C90 268 89 304 82 335",
        "M140 242 C130 268 131 304 138 335",
        "M78 337 C84 356 84 383 72 406",
        "M142 337 C136 356 136 383 148 406",
      ];
  return (
    <g aria-hidden="true">
      {lines.map((d, index) => (
        <path key={`${view}-line-${index}`} className="body-anatomy-line" d={d} />
      ))}
    </g>
  );
}

function MuscleElement({ segment, attrs }) {
  if (segment.type === "ellipse") return <ellipse {...attrs} />;
  if (segment.type === "rect") return <rect {...attrs} />;
  return <path {...attrs} />;
}

function MuscleShape({ segment, load, target, selected, onToggle, theme }) {
  const attrs = {
    ...segment.attrs,
    className: `muscle-shape ${target > 0 ? "target" : ""} ${selected ? "selected" : ""}`,
    style: {
      fill: muscleHeatColor(load, target, theme),
      opacity: muscleHeatOpacity(load, target),
    },
    onClick: () => onToggle?.(segment.muscle),
  };
  const ringAttrs = {
    ...segment.attrs,
    className: "muscle-selection-ring",
  };

  return (
    <g>
      <MuscleElement segment={segment} attrs={attrs} />
      {selected && <MuscleElement segment={segment} attrs={ringAttrs} />}
    </g>
  );
}

function MuscleBodyMap({
  muscleStatus,
  targetMuscles,
  selectedMuscles,
  onToggle,
  title = "Muscle Heatmap",
  subtitle = "Tap a region to inspect or add focus.",
  hideLabels = false,
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
          <BodySilhouette view={view} />
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
          <BodyAnatomyLines view={view} />
        </svg>
      </div>

      {!hideLabels && visibleLabels.length > 0 && (
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
  const form = profile?.averageForm ?? 0;
  const stages = [
    { label: "Seed",     at: 0,  formReq: 0,  copy: "Initialize profile" },
    { label: "Baseline", at: 3,  formReq: 0,  copy: "Complete first sessions" },
    { label: "Rhythm",   at: 8,  formReq: 50, copy: "Build consistency · 50% form" },
    { label: "Control",  at: 16, formReq: 65, copy: "Refine movement · 65% form" },
    { label: "Mastery",  at: 28, formReq: 78, copy: "Advanced load · 78% form" },
  ];
  const activeIndex = stages.reduce(
    (acc, stage, idx) => (sessions >= stage.at && form >= stage.formReq ? idx : acc), 0
  );
  const isMax = activeIndex === stages.length - 1;
  const nextStage = stages[Math.min(activeIndex + 1, stages.length - 1)];
  const sessionsLeft = Math.max(0, nextStage.at - sessions);
  const formLeft = Math.max(0, nextStage.formReq - form);
  const subText = isMax
    ? "Peak phase reached"
    : sessionsLeft > 0 && formLeft > 0
      ? `${sessionsLeft} sessions · +${formLeft}% form → ${nextStage.label}`
      : sessionsLeft > 0
        ? `${sessionsLeft} more sessions → ${nextStage.label}`
        : formLeft > 0
          ? `Avg form needs +${formLeft}% → ${nextStage.label}`
          : `${nextStage.label} unlocked`;

  return (
    <motion.div className="glass journey-card" custom={6} variants={panelVariants} initial="hidden" animate="visible">
      <div className="journey-head">
        <div>
          <div className="journey-title">Journey Progress</div>
          <div className="journey-sub">{subText}</div>
        </div>
        <div className="journey-score" style={{ textAlign: "right" }}>
          <div>{sessions}<span style={{ fontSize: "0.6rem", opacity: 0.65, marginLeft: 2 }}>S</span></div>
          <div style={{ fontSize: "0.68rem", color: form >= 65 ? "var(--em-b)" : "var(--text-m)", marginTop: "0.1rem" }}>
            {form}% form
          </div>
        </div>
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
  const previewProfile = trimmed ? loadProfile(trimmed) : profile;

  return (
    <div className="screen-pad">
      <div className="auth-wrap">
        <div className="auth-logo-block">
          <div className="auth-logo-icon">
            <div className="auth-logo-mark" />
          </div>
          <div className="auth-logo-text">Kinetic Life</div>
          <div className="auth-logo-sub">Edge AI Intelligent Fitness Assistant</div>
        </div>

        <div className="glass auth-card">
          <div className="auth-card-title">Create Your Fitness Profile</div>
          <div className="auth-card-sub">Set up your training profile to begin.</div>
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
              <div className="auth-stat-val">{previewProfile?.sessionsCount ?? 0}</div>
              <div className="auth-stat-label">Sessions</div>
            </div>
            <div className="auth-stat">
              <div className="auth-stat-val">{previewProfile?.averageForm ?? 0}%</div>
              <div className="auth-stat-label">Avg Form</div>
            </div>
            <div className="auth-stat">
              <div className="auth-stat-val">{previewProfile?.streakDays ?? 0}</div>
              <div className="auth-stat-label">Day Streak</div>
            </div>
          </div>
          <div style={{ height: "1rem" }} />
          <div className="sys-label" style={{ textAlign: "center" }}>
            Powered by On-Device Edge AI
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bento Artwork ───────────────────────────────────────────────────────────

function BentoArtwork({ type, theme }) {
  const themeKey = theme === "sunset" ? "sunset" : "deep_space";
  const src = HOME_ENTRY_IMAGES[themeKey][type];
  return (
    <img
      className={`bento-illus bento-illus-img bento-illus-${type}`}
      src={src}
      alt=""
      aria-hidden="true"
      decoding="async"
      draggable="false"
    />
  );
}

// ─── DashboardScreen ─────────────────────────────────────────────────────────

function DashboardScreen({ profile, onJumpIn, onPlan, onHomeWorkout, lastDevice, theme }) {
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
            <BentoArtwork type="jump" theme={theme} />
            <div className="bento-overlay">
              <div className="bento-tag">Jump-In · Auto Detect</div>
              <div className="bento-label">Start Instantly</div>
            </div>
          </motion.div>

          <motion.div
            className="glass bento-card"
            custom={4} variants={panelVariants} initial="hidden" animate="visible"
            onClick={onPlan}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <BentoArtwork type="plan" theme={theme} />
            <div className="bento-overlay">
              <div className="bento-tag">AI Plan</div>
              <div className="bento-label">Training Plan</div>
            </div>
          </motion.div>

          <motion.div
            className="glass bento-card"
            custom={5} variants={panelVariants} initial="hidden" animate="visible"
            onClick={onHomeWorkout}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <BentoArtwork type="home" theme={theme} />
            <div className="bento-overlay">
              <div className="bento-tag">Home Mode</div>
              <div className="bento-label">Home Workout</div>
            </div>
          </motion.div>
        </div>

        <JourneyPanel profile={profile} />

        <motion.div className="glass" custom={7} variants={panelVariants} initial="hidden" animate="visible"
          style={{ padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}
        >
          <span className="bento-icon" style={{ width: 30, height: 30 }}><IconEdgeNode className="bento-icon-svg" /></span>
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
      const base = normalizeDeviceHttpUrl(deviceUrl);
      if (!base) {
        setError("Enter a camera address first.");
        setConnState("idle");
        return;
      }
      try {
        const res = await fetch(`${base}/hello`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json().catch(() => ({}));
        if (d.ws_token) localStorage.setItem("kl-ws-token", d.ws_token);
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

function PlanConfigScreen({ onBegin, onBack, muscleStatus, theme, userName, onPlanGenerated }) {
  const [aiProfile, setAiProfile] = useState(() => loadAiCoreProfile(userName));
  const [draft, setDraft] = useState(() => loadAiCoreProfile(userName));
  const [focus, setFocus] = useState(() => new Set(loadAiCoreProfile(userName).focusTags));
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
      saveAiCoreProfile(updated, userName);
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
    saveAiCoreProfile(updated, userName);
    const decision = generateAiCorePlan({ profile: updated, muscleStatus, focusTags: updated.focusTags });
    onPlanGenerated?.(decision);
  }

  return (
    <div className="screen-pad">
      <div className="plan-wrap">
        <div className="connect-header" style={{ paddingBottom: "0.5rem" }}>
          <button className="back-btn" onClick={onBack}>←</button>
          <h2 className="ath-title" style={{ fontSize: "1.2rem" }}>Training Plan</h2>
        </div>

        <motion.div className="glass plan-ai-card" custom={0} variants={panelVariants} initial="hidden" animate="visible">
          <div className="plan-ai-header">
            <span className="plan-ai-icon"><Lottie animationData={lottieAiCore} loop={true} style={{ width:20, height:20 }} /></span>
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
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="sys-label">Target Route</div>
                <div className="ai-route-row">
                  <div className="ai-core-route">{aiDecision.payload.target_muscle_group}</div>
                  {(() => {
                    const tags = aiDecision.payload.decisionTags;
                    const shown = tags.slice(0, 2);
                    const overflow = tags.length - shown.length;
                    return <>
                      {shown.length ? shown.map((tag, i) => (
                        <span key={i} className={`ai-chip readonly ai-chip-xs ${tag.type === "injury" || tag.type === "fatigue" ? "warn" : "active"}`}>
                          {tag.label}
                        </span>
                      )) : <span className="ai-chip readonly ai-chip-xs active">Balanced</span>}
                      {overflow > 0 && <span className="ai-chip readonly ai-chip-xs" style={{ opacity: 0.55 }}>+{overflow}</span>}
                    </>;
                  })()}
                </div>
              </div>
              <button className="ai-core-reset" onClick={() => { setDraft(aiProfile); setEditingCore(true); }}>Edit Profile</button>
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
            {buildWeekSchedule(aiProfile.trainingDaysPerWeek, muscleStatus, focusTags, aiProfile.injuryTags).map(({ dow, label, isTraining, isToday, isPast, exercise }) => {
              if (!isTraining) {
                return (
                  <div key={dow} className={`plan-item plan-item-rest ${isToday ? "today" : ""} ${isPast ? "past" : ""}`}>
                    <span className="plan-day-chip rest">{label}</span>
                    <span className="plan-rest-label">Rest</span>
                  </div>
                );
              }
              if (!exercise) {
                return (
                  <div key={dow} className={`plan-item ${isToday ? "today" : ""} ${isPast ? "past" : ""}`}>
                    <span className="plan-day-chip">{label}</span>
                    <div className="plan-item-main">
                      <div className="plan-item-name" style={{ color: "var(--text-d)" }}>Training Day</div>
                    </div>
                  </div>
                );
              }
              const ex = exerciseById(exercise.exerciseId);
              return (
                <div
                  key={dow}
                  className={`plan-item ${selectedEx?.id === ex.id ? "sel" : ""} ${isToday ? "today" : ""} ${isPast ? "past" : ""}`}
                  onClick={() => {
                    if (isPast) return;
                    setSelectedEx(ex);
                    if (isToday) onBegin(ex);
                  }}
                >
                  <span className={`plan-day-chip ${isToday ? "active" : ""}`}>{label}</span>
                  <div className="plan-item-main">
                    <div className="plan-item-name">{ex.label}</div>
                    <div className="plan-item-reason">{exercise.reason}</div>
                  </div>
                  {isToday
                    ? <span className="plan-today-cta">▶ Start</span>
                    : <div className="plan-item-meta">{exercise.sets}×{exercise.targetReps}</div>}
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
                <span className="ex-code"><BaseBadge code={ex.short} className="action-badge-svg" /></span>
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
      <div className="plan-wrap">
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

// ─── Home Workout ─────────────────────────────────────────────────────────────

function pickKiniLine(screen) {
  const arr = KINI_LINES[screen] ?? KINI_LINES.selection;
  return arr[Math.floor(Math.random() * arr.length)];
}

const MUSCLE_LABEL = {
  biceps: "Biceps", shoulders: "Shoulders", triceps: "Triceps", core: "Core",
  quads: "Quads", hamstrings: "Hamstrings", lower_back: "Lower back",
  rear_calves: "Calves", upper_back: "Upper back", chest: "Chest",
  front_calves: "Calves",
};

function pickKiniLineForSelection(muscleStatus) {
  const ms = muscleStatus ?? {};
  const avg = (keys) => keys.reduce((s, k) => s + (ms[k] ?? 0), 0) / keys.length;
  const cap = (s) => (MUSCLE_LABEL[s] ?? (s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ")));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const upperKeys = ["biceps", "shoulders", "triceps"];
  const lowerKeys = ["quads", "hamstrings", "lower_back"];
  const upperLoad = avg(upperKeys);
  const lowerLoad = avg(lowerKeys);
  const allVals = Object.values(ms);

  if (allVals.length === 0 || allVals.every((v) => v < 0.08)) {
    return pick([
      "Fresh body, zero excuses. Which flavour of suffering today? 😄",
      "No soreness detected. I'm almost suspicious. Pick a protocol!",
      "You're fully recovered. Both options are wide open — dangerous situation.",
    ]);
  }

  const sorted = Object.entries(ms).sort(([, a], [, b]) => b - a);
  const sore  = sorted.filter(([, v]) => v > 0.65).map(([k]) => k);
  const fresh = sorted.filter(([, v]) => v < 0.22).reverse().map(([k]) => k);

  if (sore.length && fresh.length) {
    return pick([
      `${cap(sore[0])} is still grumpy from last time. ${cap(fresh[0])} is fully rested and ready to suffer again.`,
      `Your ${cap(sore[0])} filed a complaint. Your ${cap(fresh[0])} filed zero complaints. I know which one to trust.`,
    ]);
  }

  if (sore.length) {
    return pick([
      `${cap(sore[0])} is at ${Math.round((ms[sore[0]] ?? 0) * 100)}% load. It's whispering "please be gentle." I'd listen.`,
      `Heads up — ${cap(sore[0])} is still recovering. Control the reps. Quality > ego today.`,
    ]);
  }

  if (upperLoad < lowerLoad - 0.18) {
    return pick([
      `Legs are at ${Math.round(lowerLoad * 100)}% load. Arms are just chilling at ${Math.round(upperLoad * 100)}%. APEX is calling.`,
      `Your lower body needs rest more than your arms do. APEX protocol is the smart pick here.`,
    ]);
  }
  if (lowerLoad < upperLoad - 0.18) {
    return pick([
      `Arms at ${Math.round(upperLoad * 100)}% load, legs at ${Math.round(lowerLoad * 100)}%. Your quads are literally begging to be used.`,
      `Upper body says "not today." Lower body is suspiciously fresh. FORGE it is.`,
    ]);
  }

  const overall = allVals.reduce((s, v) => s + v, 0) / allVals.length;
  if (overall > 0.55) {
    return pick([
      `Overall load is at ${Math.round(overall * 100)}%. You're not fragile, but maybe don't go feral today.`,
      `High systemic load detected. Still doing it? Respect. Just keep the quality up.`,
    ]);
  }

  return pick([
    "Everything looks balanced. Suspicious. Pick a protocol before I do.",
    "Recovery data is green across the board. You've run out of excuses!",
    "Both groups are recovered. The real question is: which do YOU want to work?",
  ]);
}

function pickKiniLineForMap(routeId, muscleStatus) {
  const ms = muscleStatus ?? {};
  const avg = (keys) => keys.reduce((s, k) => s + (ms[k] ?? 0), 0) / keys.length;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const isUpper = routeId === "upper";
  const routeKeys   = isUpper ? ["biceps", "shoulders", "triceps"] : ["quads", "hamstrings", "lower_back"];
  const routeName   = isUpper ? "APEX" : "FORGE";
  const muscleGroup = isUpper ? "arms" : "legs";
  const routeLoad   = avg(routeKeys);

  if (routeLoad > 0.7) {
    return pick([
      `Bold choice. Your ${muscleGroup} are at ${Math.round(routeLoad * 100)}% load. ${routeName} Protocol doesn't care. Let's go.`,
      `Your ${muscleGroup} are tired and you picked ${routeName}. That's either brave or chaotic. I respect both.`,
      `${Math.round(routeLoad * 100)}% load on your ${muscleGroup} and you still chose this. I admire the audacity.`,
    ]);
  }

  if (routeLoad < 0.2) {
    return pick([
      `${routeName} Protocol — great call. Your ${muscleGroup} are basically screaming "we're ready!" 💪`,
      `Your ${muscleGroup} are fully recovered at ${Math.round(routeLoad * 100)}% load. They signed up for this. Let's deliver.`,
      `Data agrees: ${muscleGroup} are fresh, ${routeName} is the right call. I like when humans make smart choices.`,
    ]);
  }

  return pick([
    isUpper
      ? "APEX Protocol locked in. Biceps, shoulders, triceps — the whole upper party is invited."
      : "FORGE Protocol locked in. Quads, hamstrings, posterior chain — nobody gets the day off.",
    `${routeName} Protocol. ${Math.round(routeLoad * 100)}% load on your ${muscleGroup}. Manageable. Let's make it count.`,
    isUpper
      ? "Arms selected. This is going to be a good kind of sore tomorrow."
      : "Leg day selected. Future you is already not happy. Present you doesn't care. Perfect.",
  ]);
}

function KiniAvatar({ pose = "wave", size = 110 }) {
  const poses = {
    wave:      { lArm:"M28,58 L14,42 L9,32", lHand:"M9,32 L5,26 M9,32 L4,30", rArm:"M52,58 L62,72", mouth:"M33,33 Q40,39 47,33", er:3.8 },
    proud:     { lArm:"M28,58 L18,52 L14,62", lHand:"", rArm:"M52,58 L62,64 L58,74", mouth:"M33,33 Q40,41 47,33", er:3.8 },
    celebrate: { lArm:"M28,58 L14,38 L8,24", lHand:"M8,24 L4,18 M8,24 L12,18", rArm:"M52,58 L66,38 L72,24", mouth:"M31,32 Q40,43 49,32", er:4.2 },
    cheer:     { lArm:"M28,58 L16,48 L12,36", lHand:"", rArm:"M52,58 L64,72", mouth:"M32,33 Q40,40 48,33", er:3.8 },
  };
  const p = poses[pose] ?? poses.wave;
  return (
    <svg viewBox="0 0 80 104" width={size} height={Math.round(size * 104 / 80)}
      aria-hidden="true" style={{ display:"block", filter:"drop-shadow(0 0 14px rgba(0,219,233,0.45))" }}>
      <ellipse cx="40" cy="30" rx="28" ry="28" fill="rgba(0,219,233,0.06)" />
      <line x1="40" y1="8" x2="40" y2="2" stroke="#00DBE9" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="40" cy="1.2" r="2.2" fill="#00DBE9" />
      <circle cx="40" cy="30" r="22" fill="#060C18" stroke="#00DBE9" strokeWidth="2" />
      <circle cx="33" cy="27" r={p.er} fill="#00DBE9" />
      <circle cx="47" cy="27" r={p.er} fill="#00DBE9" />
      <circle cx="34" cy="26" r="1.2" fill="white" opacity="0.7" />
      <circle cx="48" cy="26" r="1.2" fill="white" opacity="0.7" />
      <path d={p.mouth} stroke="#00DBE9" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="28" y="54" width="24" height="22" rx="8" fill="#060C18" stroke="#00DBE9" strokeWidth="2" />
      <rect x="33" y="59" width="14" height="8" rx="3" fill="rgba(0,219,233,0.14)" stroke="rgba(0,219,233,0.38)" strokeWidth="1" />
      <path d={p.lArm} stroke="#00DBE9" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {p.lHand && <path d={p.lHand} stroke="#00DBE9" strokeWidth="2" fill="none" strokeLinecap="round" />}
      <path d={p.rArm} stroke="#00DBE9" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M35,76 L31,96" stroke="#00DBE9" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M45,76 L49,96" stroke="#00DBE9" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M31,96 L22,96" stroke="#00DBE9" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M49,96 L58,96" stroke="#00DBE9" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function HomeCardioPreviewScreen({ step, lottieData, route, onReady }) {
  const [played, setPlayed] = useState(false);
  const accentVar = `var(--hw-${route?.varKey || "b"})`;
  return (
    <div className="screen-pad">
      <div className="hw-wrap" style={{ alignItems:"center", justifyContent:"center", gap:"1.5rem" }}>
        <div style={{ textAlign:"center" }}>
          <div className="hw-set-badge">Up Next</div>
          <div className="hw-set-big" style={{ color: accentVar }}>{step.label}</div>
          <div style={{ fontSize:"0.78rem", opacity:0.55, marginTop:"0.25rem" }}>
            {step.duration}s — no form check, just move
          </div>
        </div>

        <div className="hw-lottie-demo" style={{ height:220, width:"100%", maxWidth:280 }}>
          <Lottie
            animationData={lottieData}
            loop={false}
            onComplete={() => setPlayed(true)}
            style={{ width:"100%", height:"100%" }}
          />
        </div>

        <div className="hw-kini-bubble" style={{ textAlign:"center", maxWidth:280 }}>
          <div className="hw-kini-name">Kini</div>
          Watch the movement, then give it your all!
        </div>

        <button
          className="hw-collect-btn"
          style={{ background: `linear-gradient(135deg, var(--hw-a), var(--hw-b))`, opacity: played ? 1 : 0.45, pointerEvents: played ? "auto" : "none" }}
          onClick={onReady}
        >
          {played ? "Let's Go →" : "Watch first..."}
        </button>
      </div>
    </div>
  );
}

function CardioCountdownScreen({ duration = 30, iotConnRef, onComplete, label = "Active Burn", lottieData = null, demoFirst = false }) {
  // Intro phase: 5-second preview so user can see the movement before timer starts
  const [intro, setIntro]         = useState(lottieData ? 5 : 0); // counts 5→0
  const [remaining, setRemaining] = useState(duration);
  const [isMoving, setIsMoving]   = useState(true);
  const [phrase, setPhrase]       = useState(null);
  const shownRef = useRef(new Set());
  const inIntro = intro > 0;
  const pct = remaining / duration;

  // Intro countdown 5→0
  useEffect(() => {
    if (!inIntro) return;
    const t = setTimeout(() => setIntro(i => i - 1), 1000);
    return () => clearTimeout(t);
  }, [intro, inIntro]);

  // Active countdown
  useEffect(() => {
    if (inIntro) return;
    if (remaining <= 0) { onComplete(); return; }
    if (!isMoving) return;
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, isMoving, onComplete, inIntro]);

  useEffect(() => {
    if (inIntro) return;
    for (const m of CARDIO_MILESTONES) {
      if (pct <= m.pct && !shownRef.current.has(m.pct)) {
        shownRef.current.add(m.pct);
        setPhrase(m);
        break;
      }
    }
  }, [pct, inIntro]);

  const mins = String(Math.floor(remaining / 60)).padStart(1, "0");
  const secs = String(remaining % 60).padStart(2, "0");
  const timerCls = remaining <= 5 ? "urgent" : remaining <= 10 ? "warn" : "";

  // ── Intro phase: large Lottie + exercise hint + 5s countdown ──
  if (inIntro && lottieData) {
    return (
      <div className="screen-pad">
        <div className="cardio-wrap" style={{ justifyContent:"center", gap:"1.2rem" }}>
          <div style={{ textAlign:"center" }}>
            <div className="sys-label-em" style={{ fontSize:"1.1rem" }}>{label}</div>
            <div style={{ fontSize:"0.82rem", opacity:0.58, marginTop:"0.3rem" }}>
              Watch the movement — starting in
            </div>
          </div>

          <div style={{ display:"flex", justifyContent:"center" }}>
            <Lottie animationData={lottieData} loop={true} style={{ height:240, width:"auto" }} />
          </div>

          <div style={{ textAlign:"center" }}>
            <div style={{
              fontSize:"4.5rem", fontWeight:900, fontFamily:"var(--mono)",
              lineHeight:1, color:"var(--em-a)",
              textShadow:"0 0 28px color-mix(in srgb, var(--em-a) 60%, transparent)",
            }}>
              {intro}
            </div>
            <div style={{ fontSize:"0.7rem", letterSpacing:"0.22em", textTransform:"uppercase", opacity:0.42, marginTop:"0.4rem" }}>
              seconds
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Active phase: LiveScreen skeleton + Lottie + timer ──
  return (
    <div className="screen-pad">
      <div className="cardio-wrap">
        <div className="cardio-header">
          <div className="sys-label-em">{label}</div>
          <div style={{ fontSize:"0.78rem", opacity:0.58, marginTop:"0.15rem" }}>
            Keep any joint moving
          </div>
        </div>

        {lottieData && (
          <div style={{ display:"flex", justifyContent:"center" }}>
            <Lottie animationData={lottieData} loop={true} style={{ height:120, width:"auto" }} />
          </div>
        )}

        <LiveScreen
          exercise={null}
          onFinish={() => {}}
          onVisualState={() => {}}
          iotConnRef={iotConnRef}
          cardioMode={true}
          onMotionChange={setIsMoving}
        />

        <div className="cardio-timer-block">
          <div className={`cardio-timer ${timerCls}`}>{mins}:{secs}</div>
          {phrase && (
            <div key={phrase.pct} className="cardio-phrase" style={{ color:phrase.color }}>
              {phrase.text}
            </div>
          )}
        </div>

        <div className="cardio-status">
          <div className={`cardio-dot${isMoving ? "" : " paused"}`} />
          <span>{isMoving ? "Movement detected" : "KEEP MOVING ↓"}</span>
        </div>

        <button className="hw-collect-btn" style={{ opacity:0.72 }} onClick={onComplete}>
          End Cardio →
        </button>
      </div>
    </div>
  );
}

function HomeSetRestScreen({ ctx, route, onStartNext }) {
  const [countdown, setCountdown] = useState(15);
  const [setClearDone, setSetClearDone] = useState(false);
  const step = route.steps[ctx.stepIdx - 1] ?? route.steps[0];
  const completedSet = ctx.currentSet - 1;
  const totalSets = ctx.totalSets;
  const dtw = ctx.lastSetDtw ?? 0.5;
  const dtwPct = Math.round(dtw * 100);
  const dtwLabel = dtw >= 0.85 ? "Excellent" : dtw >= 0.70 ? "Good" : dtw >= 0.55 ? "Fair" : "Needs Work";

  useEffect(() => {
    if (countdown <= 0) { onStartNext(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, onStartNext]);

  return (
    <div className="screen-pad">
      <div className="hw-wrap">
        <div className="hw-set-header">
          <div className="hw-set-badge">Set Complete</div>
          <div className="hw-set-big">
            {completedSet} <span style={{ opacity:0.45, fontSize:"1.1rem" }}>of</span> {totalSets}
          </div>
        </div>

        <div className="hw-dtw-card">
          <div className="hw-dtw-score" style={{ color:`var(--hw-a)` }}>{dtwPct}%</div>
          <div className="hw-dtw-label">{dtwLabel} Form — {step.reps} reps</div>
          <div className="hw-dtw-bar">
            <motion.div className="hw-dtw-fill" initial={{ width:"0%" }}
              animate={{ width:`${dtwPct}%` }} transition={{ duration:0.9, ease:[0.22,1,0.36,1] }} />
          </div>
        </div>

        <div className="hw-set-dots">
          {Array.from({ length: totalSets }, (_, i) => (
            <div key={i} className="hw-set-dot" style={{
              width: `${Math.min(60, 160 / totalSets)}px`,
              background: i < completedSet ? "var(--hw-a)" : "rgba(255,255,255,0.12)",
            }} />
          ))}
        </div>

        <div className="hw-kini-section">
          {!setClearDone ? (
            <Lottie animationData={lottieSetClear} loop={false}
              onComplete={() => setSetClearDone(true)} style={{ height:120 }} />
          ) : (
            <Lottie animationData={lottieSqurtWalking} loop={true} style={{ height:120 }} />
          )}
          <div className="hw-kini-bubble">
            <div className="hw-kini-name">Kini</div>
            {ctx.kiniLine}
          </div>
        </div>

        <div className="hw-rest-block">
          <div className="hw-rest-label">Next set in</div>
          <div className="hw-rest-timer" style={{ color: countdown <= 5 ? "var(--hw-a)" : undefined }}>
            {countdown}
          </div>
        </div>

        <button className="hw-collect-btn" onClick={onStartNext}>Start Now →</button>
      </div>
    </div>
  );
}

function HomeExerciseDoneScreen({ ctx, route, onContinue }) {
  const [pathClearDone, setPathClearDone] = useState(false);
  const results = ctx.setResults ?? [];
  const avgDtw = results.length ? results.reduce((s, r) => s + r.dtw, 0) / results.length : 0;
  const avgPct = Math.round(avgDtw * 100);
  const stepIdx = ctx.stepIdx - 1;
  const step = route.steps[stepIdx] ?? route.steps[0];
  const ex = step.type === "exercise" ? exerciseById(step.exerciseId) : null;
  const nextStep = route.steps[ctx.stepIdx];
  const nextLabel = nextStep?.type === "cardio" ? (nextStep.label ?? "Active Burn") : (nextStep ? exerciseById(nextStep.exerciseId).label : null);
  const adviceText = avgDtw >= 0.85
    ? "Excellent consistency. Keep that controlled pattern."
    : avgDtw >= 0.70
    ? "Good technique. Focus on keeping every rep identical."
    : "Room to improve. Slow the movement down next time.";

  return (
    <div className="screen-pad">
      <div className="hw-wrap">
        <div className="hw-set-header">
          <div className="hw-set-badge">Exercise Complete</div>
          <motion.div className="hw-set-big" initial={{ opacity:0, y:18 }}
            animate={{ opacity:1, y:0 }} transition={{ duration:0.5, ease:[0.22,1,0.36,1] }}>
            {ex?.label ?? "Done"}
          </motion.div>
        </div>

        <div className="hw-dtw-card">
          <div style={{ fontSize:"0.6rem", letterSpacing:"0.18em", textTransform:"uppercase", opacity:0.5, marginBottom:"0.4rem" }}>
            Avg Form Score — {results.length} sets
          </div>
          <div className="hw-dtw-score" style={{ color:`var(--hw-a)` }}>{avgPct}%</div>
          <div className="hw-dtw-bar">
            <motion.div className="hw-dtw-fill" initial={{ width:"0%" }}
              animate={{ width:`${avgPct}%` }} transition={{ delay:0.2, duration:1, ease:[0.22,1,0.36,1] }} />
          </div>
          <div className="hw-per-set-row" style={{ marginTop:"0.85rem" }}>
            {results.map((r, i) => (
              <div key={i} className="hw-per-set-item">
                <div className="hw-per-set-val">{Math.round(r.dtw * 100)}%</div>
                <div className="hw-per-set-lbl">Set {i + 1}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="hw-kini-section">
          {!pathClearDone ? (
            <Lottie animationData={lottiePathClear} loop={false}
              onComplete={() => setPathClearDone(true)} style={{ height:110 }} />
          ) : (
            <Lottie animationData={lottieSqurtWalking} loop={true} style={{ height:110 }} />
          )}
          <div className="hw-kini-bubble">
            <div className="hw-kini-name">Kini</div>
            {adviceText}
          </div>
        </div>

        {nextStep && (
          <div className="hw-next-card" style={{ borderColor:`color-mix(in srgb,var(--hw-a) 30%,transparent)` }}>
            <div className="hw-next-lbl">Up Next</div>
            <div className="hw-next-name" style={{ color:"var(--hw-a)" }}>{nextLabel}</div>
            <div className="hw-next-meta">
              {nextStep.type === "cardio" ? `${nextStep.duration}s countdown` : `${nextStep.sets} sets × ${nextStep.reps} reps`}
            </div>
          </div>
        )}

        <button className="hw-collect-btn" onClick={onContinue}>
          {nextStep ? "Next Exercise →" : "Finish Workout →"}
        </button>
      </div>
    </div>
  );
}

function HomeRewardScreen({ ctx, route, onCollectReward }) {
  const [showTrophy, setShowTrophy] = useState(false);

  // Start trophy at the halfway point of cheering_ribbons
  useEffect(() => {
    const fr  = lottieCheeringRibbons.fr ?? 30;
    const op  = lottieCheeringRibbons.op ?? 90;
    const ip  = lottieCheeringRibbons.ip ?? 0;
    const halfMs = ((op - ip) / fr) * 500; // half duration in ms
    const t = setTimeout(() => setShowTrophy(true), halfMs);
    return () => clearTimeout(t);
  }, []);

  const elapsed = ctx.startTime ? Math.round((Date.now() - ctx.startTime) / 1000) : 0;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const totalReps = ctx.totalReps ?? 0;
  const topMuscles = Object.entries(route.muscles).sort(([, a], [, b]) => b - a).slice(0, 5);

  return (
    <div className="screen-pad">
      <div className="hw-wrap">
        <div className="hw-reward-hero">
          <motion.div className="hw-reward-title"
            initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }}
            transition={{ duration:0.6, ease:[0.22,1,0.36,1] }}>
            QUEST<br />COMPLETE
          </motion.div>
          <div className="hw-reward-sub">{route.name} · {route.tagline}</div>
        </div>

        <div className="hw-kini-section">
          {/* Cheering + Trophy overlay: trophy starts at halfway point of cheering */}
          <div style={{ position:"relative", height:160, width:"100%", display:"flex", justifyContent:"center" }}>
            <Lottie animationData={lottieCheeringRibbons} loop={false} style={{ height:160 }} />
            {showTrophy && (
              <div style={{ position:"absolute", inset:0, zIndex:2, display:"flex", justifyContent:"center", alignItems:"center" }}>
                <Lottie animationData={lottieTrophy} loop={false} style={{ height:160 }} />
              </div>
            )}
          </div>
          <div className="hw-kini-bubble">
            <div className="hw-kini-name">Kini</div>
            {ctx.kiniLine}
          </div>
        </div>

        <div className="hw-stats-row">
          <div className="hw-stat-block">
            <div className="hw-stat-val">{totalReps}</div>
            <div className="hw-stat-lbl">Total Reps</div>
          </div>
          <div className="hw-stat-block">
            <div className="hw-stat-val">{mins}:{String(secs).padStart(2,"0")}</div>
            <div className="hw-stat-lbl">Duration</div>
          </div>
          <div className="hw-stat-block">
            <div className="hw-stat-val">{Math.round(totalReps * 0.4 + elapsed * 0.05)}</div>
            <div className="hw-stat-lbl">Cal (est.)</div>
          </div>
        </div>

        <div className="hw-muscle-panel">
          <div className="hw-muscle-ptitle">Muscles Trained — System Updated</div>
          <div>
            {topMuscles.map(([muscle, intensity]) => (
              <div key={muscle} className="hw-muscle-row">
                <div className="hw-muscle-mname">{muscle.replace(/_/g," ")}</div>
                <div className="hw-muscle-track">
                  <motion.div className="hw-muscle-fill"
                    initial={{ width:"0%" }}
                    animate={{ width:`${Math.round(intensity * 100)}%` }}
                    transition={{ delay:0.3, duration:1.1, ease:[0.22,1,0.36,1] }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <button className="hw-collect-btn" onClick={onCollectReward}>
          COLLECT REWARD & RETURN
        </button>
      </div>
    </div>
  );
}

function HomeWorkoutContainer({ ctx, onSelectRoute, onNodeTap, onContinueBetween, onCardioDone, onCollectReward, onExit, onStartNextSet, onExerciseContinue, onCardioPreviewReady, iotConnRef }) {
  const sub = ctx?.hwSub ?? "select";
  const route = ctx?.routeId ? HOME_ROUTES[ctx.routeId] : null;

  // helper: resolve lottie data from step.lottie key
  const cardioLottie = (step) => {
    if (!step?.lottie) return null;
    if (step.lottie === "jumping_jack") return lottieJumpingJack;
    if (step.lottie === "squat_kick")  return lottieSquatKick;
    return null;
  };

  // ── Inter-set rest ──
  if (sub === "set_rest" && route) {
    return <HomeSetRestScreen ctx={ctx} route={route} onStartNext={onStartNextSet} />;
  }

  // ── Exercise done (all sets) ──
  if (sub === "exercise_done" && route) {
    return <HomeExerciseDoneScreen ctx={ctx} route={route} onContinue={onExerciseContinue} />;
  }

  // ── Cardio exercise preview (play once before countdown) ──
  if (sub === "cardio_preview" && route) {
    const step = route.steps[ctx.stepIdx];
    return <HomeCardioPreviewScreen step={step} lottieData={cardioLottie(step)} route={route} onReady={onCardioPreviewReady} />;
  }

  // ── Route selection ──
  if (sub === "select") {
    return (
      <div className="screen-pad">
        <div className="hw-wrap">
          <div className="hw-header">
            <button className="hw-back-btn" onClick={onExit}>← Back</button>
            <div>
              <div className="sys-label-em">Home Workout</div>
              <div style={{ fontSize:"0.78rem", opacity:0.55, marginTop:"0.1rem" }}>No equipment required</div>
            </div>
          </div>

          <div className="hw-kini-section">
            <div className="hw-kini-bubble">
              <div className="hw-kini-name">Kini</div>
              {ctx?.kiniLine ?? pickKiniLine("selection")}
            </div>
            <Lottie animationData={lottieAvocadoWalking} loop={true} style={{ height:180, width:180 }} />
          </div>

          <div className="hw-select-title">Choose Protocol</div>

          <div className="hw-route-cards">
            {Object.values(HOME_ROUTES).map((r) => (
              <motion.div
                key={r.name}
                className="hw-route-card"
                style={{ borderColor: `var(--hw-${r.varKey}-dim)` }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectRoute(r.name === "APEX PROTOCOL" ? "upper" : "lower")}
              >
                <div className="hw-route-glow" style={{ background: `radial-gradient(circle, var(--hw-${r.varKey}), transparent 70%)` }} />
                <div className="hw-route-badge" style={{ color: `var(--hw-${r.varKey})` }}>Home Protocol</div>
                <div className="hw-route-name" style={{ color: `var(--hw-${r.varKey})` }}>{r.name}</div>
                <div className="hw-route-tag">{r.tagline}</div>
                <div className="hw-step-chips">
                  {r.steps.map((s, i) => (
                    <span key={i} className="hw-step-chip">
                      {s.type === "cardio" ? `⏱ ${s.label ?? "Cardio"}` : `${exerciseById(s.exerciseId).short} ${s.sets}×${s.reps}`}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </div>
    );
  }

  // ── Quest node map ──
  if (sub === "map" && route) {
    const stepIdx = ctx.stepIdx;
    const accentVar = `var(--hw-${route.varKey || "a"})`;
    return (
      <div className="screen-pad">
        <div className="hw-wrap">
          <div className="hw-header">
            <button className="hw-back-btn" onClick={onExit}>← Exit</button>
            <div>
              <div className="hw-map-route-name" style={{ color: accentVar }}>{route.name}</div>
              <div className="hw-map-route-tag">{route.tagline}</div>
            </div>
          </div>

          <div className="hw-kini-section">
            <div className="hw-kini-bubble">
              <div className="hw-kini-name">Kini</div>
              {ctx.mapKiniLine ?? pickKiniLineForMap(ctx.routeId, {})}
            </div>
            <Lottie animationData={lottieAvocadoWalking} loop={true} style={{ height:180, width:180 }} />
          </div>

          <div className="hw-node-list">
            {route.steps.map((step, i) => {
              const isDone   = i < stepIdx;
              const isActive = i === stepIdx;
              const isLocked = i > stepIdx;
              const ex = step.type === "exercise" ? exerciseById(step.exerciseId) : null;
              const label = step.type === "cardio" ? "Active Burn" : ex.label;
              const meta  = step.type === "cardio"
                ? `${step.duration}s countdown`
                : `${step.sets} sets × ${step.reps} reps`;
              const icon = isDone ? "✓" : step.type === "cardio" ? "⏱" : String(i + 1);
              return (
                <div key={i}
                  className={`hw-node-row${isActive ? " active" : ""}`}
                  onClick={() => isActive && onNodeTap(i)}
                >
                  <div className="hw-node-spine">
                    <div
                      className={`hw-node-circle ${isDone ? "done" : isActive ? "active" : "locked"}`}
                      style={{ color: isActive ? accentVar : isDone ? accentVar : "var(--text-d)" }}
                    >
                      {icon}
                    </div>
                    {i < route.steps.length - 1 && (
                      <div className={`hw-node-line ${isDone ? "done-line" : ""}`} />
                    )}
                  </div>
                  <div className="hw-node-info">
                    <div className={`hw-node-label ${isLocked ? "locked" : ""}`}
                      style={{ color: isActive ? accentVar : undefined }}>
                      {label}
                    </div>
                    <div className="hw-node-meta">{meta}</div>
                    {isActive && (
                      <div className="hw-node-tap" style={{ color: accentVar }}>
                        Tap to begin →
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Between exercises ──
  if (sub === "between" && route) {
    const nextStep = route.steps[ctx.stepIdx];
    const nextEx = nextStep?.type === "exercise" ? exerciseById(nextStep.exerciseId) : null;
    const nextLabel = nextStep?.type === "cardio" ? "Active Burn" : (nextEx?.label ?? "");
    const nextMeta  = nextStep?.type === "cardio"
      ? `${nextStep.duration}s cardio countdown`
      : `${nextStep.sets} sets × ${nextStep.reps} reps`;
    return (
      <div className="screen-pad">
        <div className="hw-wrap">
          <div className="hw-header">
            <button className="hw-back-btn" onClick={onExit}>← Exit</button>
            <div style={{ fontSize:"0.78rem", opacity:0.55 }}>Step {ctx.stepIdx} complete</div>
          </div>

          <div className="hw-kini-section">
            <KiniAvatar pose="proud" size={100} />
            <div className="hw-kini-bubble">
              <div className="hw-kini-name">Kini</div>
              {ctx.kiniLine}
            </div>
          </div>

          {/* blue_jumping: celebration animation between exercises */}
          <div style={{ display:"flex", justifyContent:"center" }}>
            <Lottie animationData={lottieBlueJumping} loop={true} style={{ height:110, width:110 }} />
          </div>

          <div>
            <div className="hw-between-big">
              {ctx.stepIdx === route.steps.length ? "All Done!" : "Rest Up"}
            </div>
            <div className="hw-between-sub">Take a breath — next challenge is ready</div>
          </div>

          {nextStep && (
            <div className="hw-next-card" style={{ borderColor: `var(--hw-${route.varKey || "a"}-dim)` }}>
              <div className="hw-next-lbl">Up Next</div>
              <div className="hw-next-name" style={{ color: `var(--hw-${route.varKey || "a"})` }}>{nextLabel}</div>
              <div className="hw-next-meta">{nextMeta}</div>
            </div>
          )}

          <button className="hw-collect-btn" style={{ background: `linear-gradient(135deg, var(--hw-a), var(--hw-b))` }}
            onClick={onContinueBetween}>
            {nextStep?.type === "cardio" ? `Start ${nextLabel} →` : "Start Next Exercise →"}
          </button>
        </div>
      </div>
    );
  }

  // ── Cardio countdown ──
  if (sub === "cardio" && route) {
    const step = route.steps[ctx.stepIdx];
    const ld = cardioLottie(step);
    return (
      <CardioCountdownScreen
        duration={step?.duration ?? 30}
        label={step?.label ?? "Active Burn"}
        lottieData={ld}
        demoFirst={false}
        iotConnRef={iotConnRef}
        onComplete={onCardioDone}
      />
    );
  }

  // ── Reward ──
  if (sub === "reward" && route) {
    return <HomeRewardScreen ctx={ctx} route={route} onCollectReward={onCollectReward} />;
  }

  return null;
}

// ─── LiveScreen ───────────────────────────────────────────────────────────────

// Module-level MediaPipe singleton — survives StrictMode double-mount and screen transitions.
// Never closed so re-entry is instant; only one PoseLandmarker instance ever exists per page.
let _mpLandmarkerPromise = null;

function LiveScreen({ exercise, onFinish, onVisualState, iotConnRef, theme, homeMode = false, targetReps = null, cardioMode = false, onMotionChange = null }) {
  const [reps, setReps] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [hint, setHint] = useState(null);
  const [dtw, setDtw] = useState(0.5);
  const [repCharge, setRepCharge] = useState({ value: 0, resetting: false });
  const [isReady, setIsReady] = useState(false);
  const [hwWord, setHwWord] = useState(null); // { text, color, key }
  const autoFinishedRef = useRef(false);
  const onMotionChangeRef = useRef(onMotionChange);
  useEffect(() => { onMotionChangeRef.current = onMotionChange; }, [onMotionChange]);
  const repsRef = useRef(0);
  const dtwRef = useRef(0.5);
  const elapsedRef = useRef(0);
  useEffect(() => { repsRef.current = reps; }, [reps]);
  useEffect(() => { dtwRef.current = dtw; }, [dtw]);
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);
  // "loading" = MP WASM not yet ready; "ready" = MP loaded, waiting for first frame
  const [mpStatus, setMpStatus] = useState(() => _mpLandmarkerPromise ? "ready" : "loading");
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
    if (!homeMode || reps === 0) return;
    const w = HOME_LIVE_WORDS[Math.floor(Math.random() * HOME_LIVE_WORDS.length)];
    setHwWord({ ...w, key: Date.now() });
    const t = setTimeout(() => setHwWord(null), 1450);
    return () => clearTimeout(t);
  }, [reps, homeMode]);

  // Auto-finish set when targetReps reached in homeMode
  useEffect(() => {
    if (!homeMode || !targetReps || reps < targetReps || autoFinishedRef.current) return;
    const t = setTimeout(() => {
      if (autoFinishedRef.current) return; // guard against double-fire
      autoFinishedRef.current = true;
      onFinish({
        reps: repsRef.current, elapsed: elapsedRef.current, dtw: dtwRef.current,
        keyAngles: keyAnglesRef.current.slice(),
        exerciseId: classificationRef.current.id,
        classification: {
          mode: autoMode ? "auto" : "manual",
          exerciseId: classificationRef.current.id,
          confidence: classificationRef.current.confidence,
          status: classificationRef.current.id ? "assigned" : "unassigned",
          repsByExercise: { ...repsByExerciseRef.current },
          actionRows: autoActionRowsRef.current.map(r => ({
            exerciseId: r.exerciseId, reps: r.reps, confirmed: r.confirmed, required: r.required,
          })),
          stats: { totalFrames: classifierStatsRef.current.totalFrames, classifiedFrames: classifierStatsRef.current.classifiedFrames },
        },
      });
    }, 900);
    return () => clearTimeout(t);
  }, [reps, homeMode, targetReps, onFinish, autoMode]);

  const _vsRef = useRef(null);
  useEffect(() => {
    const good = dtw > 0.85;
    const warn = dtw < 0.65;
    const vs = good ? "live_good" : warn ? "live_warning" : "idle";
    if (vs !== _vsRef.current) { _vsRef.current = vs; onVisualState?.(vs); }
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
    let lastDisplayLm = null;      // landmarks from most recent inference
    let prevDisplayLm = null;      // landmarks from inference before last (for lerp)
    let lastErrorBoneSet = new Set();
    let lastInferenceTs = 0;       // timestamp of most recent inference
    let prevInferenceTs = 0;       // timestamp of inference before last (for lerp)
    const INFERENCE_INTERVAL_MS = 80; // ~7 fps inference
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
    let prevCardioLm = null;
    let cardioStaleTimer = null;
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

    // ── Lens undistortion — Web Worker path (fisheye theta model) ───────────
    // LUT is built inside the worker; main thread only does getImageData + putImageData.
    const _D = { k1:-0.38, k2:0.18, k3:0, p1:0, p2:0, fx:250, fy:250, cx:60, cy:80 };
    const _undistCanvas = document.createElement("canvas");
    _undistCanvas.width = 120; _undistCanvas.height = 160;
    const _undistCtx = _undistCanvas.getContext("2d", { willReadFrequently: true });

    let _workerReady = false;
    let _workerCallId = 0;
    const _workerPending = new Map();
    const _undistWorker = new Worker("/undistort.worker.js");
    _undistWorker.onmessage = ({ data }) => {
      if (data.type === "ready") { _workerReady = true; return; }
      if (data.type === "result") {
        const cb = _workerPending.get(data.id);
        if (cb) { _workerPending.delete(data.id); cb(data.dstBuf); }
      }
    };
    _undistWorker.postMessage({ type: "init", params: _D });

    function _applyDistLUTAsync() {
      const src = inferCtx.getImageData(0, 0, 120, 160);
      if (!_workerReady) {
        // Worker not yet initialised — skip undistortion this frame
        _undistCtx.putImageData(src, 0, 0);
        return Promise.resolve();
      }
      const srcBuf = src.data.buffer; // zero-copy transfer
      const id = ++_workerCallId;
      return new Promise((resolve) => {
        _workerPending.set(id, (dstBuf) => {
          _undistCtx.putImageData(new ImageData(new Uint8ClampedArray(dstBuf), 120, 160), 0, 0);
          resolve();
        });
        _undistWorker.postMessage({ type: "undistort", id, srcBuf }, [srcBuf]);
      });
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

        const lsc = (THEME_COLORS[theme] ?? THEME_COLORS.deep_space).skeleton;

        // ── MediaPipe inference (skips silently until landmarker ready) ──────
        // Time-gated: run inference at most every INFERENCE_INTERVAL_MS (≤4 fps).
        // On skipped frames re-draw skeleton from cached landmarks — no GPU work needed.
        const nowTs = performance.now();
        const runInference = landmarker && smoother && drawSkeleton && exMap &&
                             (nowTs - lastInferenceTs >= INFERENCE_INTERVAL_MS);
        if (landmarker && smoother && drawSkeleton && exMap) {
          // Pre-compute vidTransform here so both inference and cached-skeleton paths can use it
          const effW = 120, effH = 160;
          const skScale = Math.max(W / effW, H / effH);
          const sdw = effW * skScale, sdh = effH * skScale;
          const vt = { dx: (W - sdw) / 2, dy: (H - sdh) / 2, dw: sdw, dh: sdh };
          const activeRulesForRender = activeExerciseId ? exMap[activeExerciseId] : exRules;

          // Draw background + cached skeleton BEFORE starting inference.
          // Fills the ~200ms async gap so the user sees skeleton instead of blank screen.
          ctx.clearRect(0, 0, W, H);
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = lsc.bg;
          ctx.fillRect(0, 0, W, H);
          if (lastDisplayLm) {
            // Lerp between the two most recent inference results to smooth across the inference gap.
            // t animates prev→last within the elapsed interval; clamps to 1.0 (hold-last) after.
            const intervalMs = lastInferenceTs - prevInferenceTs;
            const interpLm = (prevDisplayLm && intervalMs > 0)
              ? lastDisplayLm.map((lm, i) => {
                  const p = prevDisplayLm[i];
                  const t = Math.min(1.0, (nowTs - prevInferenceTs) / intervalMs);
                  return { x: p.x + t*(lm.x-p.x), y: p.y + t*(lm.y-p.y),
                           z: p.z + t*(lm.z-p.z), visibility: p.visibility + t*(lm.visibility-p.visibility) };
                })
              : lastDisplayLm;
            const cachedOpts = {
              dtw: lastDtwScore, comboActive, frame: hudFrame, targetProgress,
              errorBoneSet: lastErrorBoneSet,
              keyJoints: (activeRulesForRender?.displayAngles ?? []).map((a) => a.joint).filter(Boolean),
              colors: (THEME_COLORS[theme] ?? THEME_COLORS.deep_space).renderer,
            };
            drawSkeleton(ctx, vt, interpLm, lastErrorBoneSet, cachedOpts);
            if (!cardioMode && drawAngle && activeRulesForRender?.displayAngles?.length) {
              drawAngle(ctx, vt, interpLm, activeRulesForRender, cachedOpts);
            }
          }

          if (!runInference) {
            bmp.close();
            return;
          }

          // Canvas already shows cached skeleton — async inference gap is now covered.
          // Rotate source into portrait inferCanvas and undistort (inference frames only)
          inferCtx.clearRect(0, 0, 120, 160);
          inferCtx.save();
          inferCtx.translate(120, 0);
          inferCtx.rotate(Math.PI / 2);
          inferCtx.drawImage(bmp, 0, 0, 160, 120);
          inferCtx.restore();

          await _applyDistLUTAsync();
          if (cancelled) { bmp.close(); return; }

          lastInferenceTs = performance.now();
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

            if (autoMode && !cardioMode) {
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

            const activeRules = activeRulesForRender;
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
                    const nextConfirmed = Math.min(AUTO_REP_CONFIRMATIONS_REQUIRED, confirmed + 1);
                    autoConfirmationsByExercise[activeExerciseId] = nextConfirmed;
                    if (nextConfirmed >= AUTO_REP_CONFIRMATIONS_REQUIRED) {
                      const credit = AUTO_REP_CONFIRMATIONS_REQUIRED;
                      repsByExerciseRef.current[activeExerciseId] = (repsByExerciseRef.current[activeExerciseId] ?? 0) + credit;
                      setReps((r) => {
                        if (navigator.vibrate) navigator.vibrate(50);
                        return r + credit;
                      });
                    }
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
            // Live DTW proxy: form-check pass/fail smoothed with EMA (α=0.15).
            // Raw random jitter removed — was causing comboActive/aurora to oscillate
            // every few frames even when form was stable.
            const rawDtw = frameErr ? 0.42 : 0.82;
            lastDtwScore = lastDtwScore * 0.85 + rawDtw * 0.15;
            highDtwStreak = lastDtwScore > 0.88 ? Math.min(6, highDtwStreak + 1) : Math.max(0, highDtwStreak - 1);
            comboActive = highDtwStreak >= 5;
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

            // vt is computed above (shared with cached-skeleton path)
            const hudOpts = {
              dtw: lastDtwScore,
              comboActive,
              frame: hudFrame,
              targetProgress,
              errorBoneSet,
              keyJoints: (activeRules?.displayAngles ?? []).map((angle) => angle.joint).filter((joint) => joint != null),
              colors: (THEME_COLORS[theme] ?? THEME_COLORS.deep_space).renderer,
            };
            prevDisplayLm = lastDisplayLm;
            prevInferenceTs = lastInferenceTs;
            lastDisplayLm = displayLm;
            lastErrorBoneSet = errorBoneSet;
            // Redraw background to replace the pre-inference cached skeleton with fresh result
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = lsc.bg;
            ctx.fillRect(0, 0, W, H);
            drawSkeleton(ctx, vt, displayLm, errorBoneSet, hudOpts);
            if (!cardioMode && drawAngle && activeRules?.displayAngles?.length) drawAngle(ctx, vt, displayLm, activeRules, hudOpts);

            // Cardio mode: motion detection via key-landmark displacement
            // Only check wrists(15,16), ankles(27,28), hips(23,24) — 6 landmarks that
            // move most during cardio. Stationary jitter on these is ~0.01-0.02/frame;
            // actual cardio movement is > 0.04/frame on average for these points.
            if (cardioMode && onMotionChangeRef.current) {
              if (prevCardioLm) {
                const KEY_LM = [15, 16, 23, 24, 27, 28];
                let disp = 0;
                for (const i of KEY_LM) {
                  if (rawLm[i] && prevCardioLm[i]) {
                    disp += Math.abs(rawLm[i].x - prevCardioLm[i].x) + Math.abs(rawLm[i].y - prevCardioLm[i].y);
                  }
                }
                if (disp / KEY_LM.length > 0.028) {
                  onMotionChangeRef.current(true);
                  clearTimeout(cardioStaleTimer);
                  cardioStaleTimer = setTimeout(() => onMotionChangeRef.current?.(false), 2500);
                }
              }
              prevCardioLm = rawLm;
            }
          }
        } else {
          // MP not loaded yet — ensure a dark background is always shown
          if (!comboActive) ctx.clearRect(0, 0, W, H);
          ctx.fillStyle = lsc.bg;
          ctx.fillRect(0, 0, W, H);
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
      if (cardioMode) {
        // Cardio mode: previous exercise LiveScreen already started notifications.
        // Wait 300ms for its bleWrite("stop") cleanup to complete, then just
        // add the event listener and restart the camera (no startNotifications needed).
        const startTimer = setTimeout(() => {
          if (cancelled) return;
          tx.addEventListener("characteristicvaluechanged", onPacket);
          BLE_CAM.reduce((p, cmd) => p.then(() => bleWrite(cmd)), Promise.resolve())
            .catch(() => {});
        }, 300);
        streamCleanup = () => {
          clearTimeout(startTimer);
          tx.removeEventListener("characteristicvaluechanged", onPacket);
          bleWrite("stop").catch(() => {});
        };
      } else {
        // Normal mode: full BLE setup from scratch
        BLE_CAM.reduce((p, cmd) => p.then(() => bleWrite(cmd)), tx.startNotifications().then(() => {
          tx.addEventListener("characteristicvaluechanged", onPacket);
        })).catch((e) => console.error("[LiveScreen] BLE start:", e));

        streamCleanup = () => {
          tx.removeEventListener("characteristicvaluechanged", onPacket);
          bleWrite("stop").catch(() => {});
          if (hintTimer) clearTimeout(hintTimer);
        };
      }

    } else if (conn.mode === "wifi" && conn.url) {
      // 50 ms delay avoids React StrictMode double-mount closing a CONNECTING socket.
      const WIFI_CAM = "res=320x240&q=40&brightness=0&contrast=1&saturation=0&sharpness=1&ae_level=0&vflip=1&hmirror=0";
      const wsToken = localStorage.getItem("kl-ws-token") || "";
      const wsUrl = conn.url.replace(/^http(s?):\/\//i, (_, s) => `ws${s}://`) + "/ws" + (wsToken ? `?token=${wsToken}` : "");

      // Latest-frame ref: onmessage just stores the newest blob; rAF drain loop consumes it.
      const latestBlobRef = { current: null };
      let sock = null;
      let frameTimeoutId = null;
      let retryCount = 0;

      function openSock() {
        if (cancelled) return;
        // HTTPS → ws:// is blocked as mixed content on both Safari and Firefox iOS.
        if (window.location.protocol === "https:" && wsUrl.startsWith("ws://")) {
          setHint("HTTPS blocks camera stream (ws://). Use BLE or open the app over HTTP.");
          return;
        }
        try {
          sock = new WebSocket(wsUrl);
        } catch {
          setHint("WebSocket blocked (mixed content). Try BLE or serve app over HTTP.");
          return;
        }
        sock.binaryType = "arraybuffer";

        let lastFrameAt = 0; // tracks actual frame receipt time (latestBlobRef is cleared by drainLoop)

        sock.onopen = () => {
          // Re-send cam config — the /cam fetch before WS open may arrive before camera is ready.
          fetch(`${conn.url}/cam?${WIFI_CAM}`, { signal: AbortSignal.timeout(3000) }).catch(() => {});
          // If no frame arrives within 10 s, retry the WebSocket.
          clearTimeout(frameTimeoutId);
          frameTimeoutId = setTimeout(() => {
            if (cancelled || lastFrameAt > 0) return;
            retryCount++;
            sock.onmessage = sock.onerror = sock.onclose = null;
            sock.close();
            if (retryCount <= 2) {
              setHint(retryCount === 1 ? "Camera starting… retrying stream" : "Stream slow — reconnecting…");
              setTimeout(openSock, 800);
            } else {
              setHint("No video from camera. Check device WiFi, then go Back and retry.");
            }
          }, 10000);
        };

        sock.onmessage = ({ data }) => {
          lastFrameAt = performance.now(); // first frame — stream is healthy
          clearTimeout(frameTimeoutId);
          latestBlobRef.current = new Blob([data], { type: "image/jpeg" });
        };
        sock.onerror = () => { if (!cancelled) console.warn("[LiveScreen] WS error"); };
      }

      const wsTimer = setTimeout(() => {
        if (cancelled) return;
        fetch(`${conn.url}/cam?${WIFI_CAM}`, { signal: AbortSignal.timeout(3000) }).catch(() => {});
        openSock();
      }, 50);

      // rAF drain — picks up only the newest frame when main thread is free
      (function drainLoop() {
        if (!cancelled) requestAnimationFrame(drainLoop);
        const blob = latestBlobRef.current;
        if (blob && !processing && !cancelled) {
          latestBlobRef.current = null;
          onFrame(blob);
        }
      })();

      streamCleanup = () => {
        clearTimeout(wsTimer);
        clearTimeout(frameTimeoutId);
        latestBlobRef.current = null;
        if (sock) {
          sock.onmessage = sock.onerror = sock.onclose = null;
          if (sock.readyState === WebSocket.OPEN || sock.readyState === WebSocket.CONNECTING) sock.close();
        }
        if (hintTimer) clearTimeout(hintTimer);
      };
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

      if (!_mpLandmarkerPromise) {
        const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        _mpLandmarkerPromise = PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "/mediapipe/models/pose_landmarker_lite.task", delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      }
      const lm = await _mpLandmarkerPromise;
      if (cancelled) return; // singleton — never close
      landmarker = lm;
      landmarkerRef.current = lm;
      setMpStatus("ready");
    }

    loadMP().catch((e) => {
      console.error("[LiveScreen] MP load:", e);
      _mpLandmarkerPromise = null; // reset so next mount can retry
    });

    return () => {
      cancelled = true;
      streamCleanup();
      if (chargeResetTimer) clearTimeout(chargeResetTimer);
      if (cardioStaleTimer) clearTimeout(cardioStaleTimer);
      _undistWorker.terminate();
      landmarkerRef.current = null; // singleton lives at module level — never close
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleAutoActionRows = autoActionRows.slice(0, AUTO_ACTION_ROW_LIMIT);
  const hiddenAutoActionRows = Math.max(0, autoActionRows.length - visibleAutoActionRows.length);

  // Cardio mode: render only the camera+skeleton canvas, no rep HUD or session bar
  if (cardioMode) {
    return (
      <div className="cardio-cam-embed">
        {!isReady && (
          <div className="cardio-cam-ph">
            <div className={`cam-init-spinner ${mpStatus === "loading" ? "active" : "dim"}`} />
          </div>
        )}
        <canvas ref={canvasRef} style={{ width:"100%", height:"100%", display:"block" }} />
      </div>
    );
  }

  return (
    <div className="live-root">
      <div className="cam-area">
        <div className={`cam-aurora ${auroraClass}`} />
        {!isReady && (
          <div className="cam-placeholder" style={{ position: "relative", zIndex: 2 }}>
            <div className="cam-init-overlay">
              <div className={`cam-init-spinner ${mpStatus === "loading" ? "active" : "dim"}`} />
              <div className="cam-init-label">
                {mpStatus === "loading" ? "Initializing Kinetic Vision…" : "Connecting stream…"}
              </div>
              {mpStatus === "loading" && (
                <div className="cam-init-sub">AI vision model loading · first launch only</div>
              )}
              {mpStatus !== "loading" && (
                <div className="cam-init-sub">Waiting for camera feed · ensure same WiFi</div>
              )}
            </div>
          </div>
        )}
        <canvas ref={canvasRef} className="cam-canvas" />
        {homeMode && hwWord && (
          <div className="hw-live-overlay">
            <div key={hwWord.key} className="hw-live-word" style={{ color: hwWord.color }}>
              {hwWord.text}
            </div>
          </div>
        )}
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
          {classification.id === "bicep_curl" && (
            <div className="arm-hint-badge right">
              <span className="arm-hint-label">YOUR RIGHT</span>
              <span className="arm-hint-arrow">→</span>
            </div>
          )}
          {classification.id === "right_bicep_curl" && (
            <div className="arm-hint-badge left">
              <span className="arm-hint-arrow">←</span>
              <span className="arm-hint-label">YOUR LEFT</span>
            </div>
          )}
        </div>
      </div>
      {autoMode ? (
        <div className="action-rep-stack" aria-label="Detected action rep counters">
          {visibleAutoActionRows.length ? visibleAutoActionRows.map((row) => {
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
                      {row.exerciseId === "bicep_curl" && <div className="action-arm-hint">YOUR RIGHT → screen right</div>}
                      {row.exerciseId === "right_bicep_curl" && <div className="action-arm-hint">← screen left YOUR LEFT</div>}
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
          {hiddenAutoActionRows > 0 && (
            <div className="action-hidden-count">+{hiddenAutoActionRows} buffered actions</div>
          )}
        </div>
      ) : homeMode ? (
        <div className={`rep-hud ${repNearComplete ? "near" : ""} ${repLocked ? "locked" : ""} ${repCharge.resetting ? "resetting" : ""}`}
          style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"0.25rem", padding:"0.75rem 1rem" }}>
          <div className="hw-rep-big" style={{ color: repLocked ? "var(--em-b)" : repNearComplete ? "var(--em-a)" : "var(--text)" }}>
            {reps}
          </div>
          <div className="hw-rep-lbl">Reps</div>
          <div className="rep-progress-track" style={{ width:"100%", marginTop:"0.4rem" }} aria-label="Movement progress">
            <div className="rep-progress-fill" style={{ width: `${repProgressPct}%` }} />
          </div>
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
  both_bicep_curl: { min: 75, max: 160, rest: 148, work: 85 },
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
  const isCurl = ex === "bicep_curl" || ex === "right_bicep_curl" || ex === "both_bicep_curl";
  if (dtw >= 0.85) return "Excellent form consistency. Rhythm and depth are well-controlled — push rep count next set.";
  if (ex === "deadlift_side") return dtw >= 0.70
    ? "Good hinge pattern. Keep knees quieter than a squat and finish each rep with a strong lockout."
    : "Hinge pattern is unstable. Push hips back, brace the trunk, and keep the knees from turning it into a squat.";
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

function AnalysisScreen({ result, onNewSet, onDone, onShareCheckIn, theme }) {
  const [selectedMood, setSelectedMood] = useState("satisfied");
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
                <span className="classification-action-code"><BaseBadge code={row.short} className="action-badge-svg" /></span>
                <span className="classification-action-name">{row.label}</span>
                <span className="classification-action-reps">{row.reps} reps</span>
              </div>
            )) : (
              <div className="classification-action-row">
                <span className="classification-action-code"><BaseBadge code="--" className="action-badge-svg" /></span>
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

        <motion.div className="glass nexus-share-panel" custom={7} variants={panelVariants} initial="hidden" animate="visible">
          <div>
            <div className="nexus-share-title">Nexus Check-in</div>
            <div className="nexus-share-sub">Share today's progress as an anonymous support signal.</div>
          </div>
          <div className="mood-picker" aria-label="Choose today's mood">
            {NEXUS_MOODS.map((mood) => (
              <button
                key={mood.id}
                className={`mood-chip ${selectedMood === mood.id ? "active" : ""}`}
                style={{ "--mood": mood.tone }}
                onClick={() => setSelectedMood(mood.id)}
                type="button"
              >
                <MoodAvatar mood={mood.id} size={28} />
                <span>{mood.label}</span>
              </button>
            ))}
          </div>
          <button className="btn-init nexus-share-btn" onClick={() => onShareCheckIn?.(selectedMood)}>
            Share Check-in
          </button>
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
            <div className="profile-meta" style={{ marginTop: "0.2rem", opacity: 0.72 }}>
              Avg load {avgLoad}%
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
            subtitle={<span className="focus-pill active" style={{ display: "inline-flex", marginTop: "0.3rem" }}>{selected.label} · {selectedLoad}%</span>}
            hideLabels
            theme={theme}
          />
        </motion.div>

        <motion.div className="glass recovery-detail" custom={2} variants={panelVariants} initial="hidden" animate="visible">
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

function SettingsScreen({ profile, deviceUrl, setDeviceUrl, connMode, setConnMode, theme, setTheme, onSwitchUser }) {
  const [probeState, setProbeState] = useState("idle"); // "idle" | "checking" | "ok" | "err"
  const [probeInfo, setProbeInfo]   = useState(null);

  function describeProbeError(error) {
    const message = error?.message || String(error || "request failed");
    if (error?.name === "AbortError" || error?.name === "TimeoutError") return "request timed out";
    if (/failed to fetch|networkerror|load failed/i.test(message)) {
      return "browser blocked the request or the device is unreachable";
    }
    return message;
  }

  async function probeDevice(url) {
    const base = normalizeDeviceHttpUrl(url);
    if (!base) return;
    setProbeState("checking");
    setProbeInfo(null);
    try {
      const r = await fetch(`${base}/hello`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (d.ws_token) localStorage.setItem("kl-ws-token", d.ws_token);
      setDeviceUrl(base);
      setProbeState("ok");
      setProbeInfo(`${d.device_id || base} · ${d.cam_model || "camera"} · fw ${d.fw_version || "?"}`);
    } catch (error) {
      setProbeState("err");
      setProbeInfo(describeProbeError(error));
    }
  }

  // Auto-probe saved address on mount
  useEffect(() => {
    if (deviceUrl) probeDevice(deviceUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const probeDot = probeState === "ok" ? "var(--em-b)" : probeState === "err" ? "var(--am-a)" : probeState === "checking" ? "#6b7280" : "transparent";

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
          <div className="settings-section-title">WiFi Device</div>
          <div>
            <label className="ath-field-label" htmlFor="device-url">Camera Address</label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                id="device-url"
                className="ath-input"
                style={{ flex: 1, margin: 0 }}
                value={deviceUrl}
                onChange={(e) => { setDeviceUrl(e.target.value); setProbeState("idle"); }}
                placeholder="http://fitcam-xxxxxx.local or IP"
              />
              <button
                className="mode-btn"
                style={{ whiteSpace: "nowrap", padding: "0.45rem 0.9rem" }}
                onClick={() => probeDevice(deviceUrl)}
                disabled={probeState === "checking"}
              >
                {probeState === "checking" ? "…" : "Test"}
              </button>
            </div>
          </div>
          {/* Connection status */}
          <div className="settings-row" style={{ marginTop: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: probeDot, display: "inline-block", flexShrink: 0 }} />
              <span className="settings-sub" style={{ color: probeState === "ok" ? "var(--em-b)" : probeState === "err" ? "var(--am-a)" : undefined }}>
                {probeState === "idle"     && "Device not checked"}
                {probeState === "checking" && "Reaching device…"}
                {probeState === "ok"       && (probeInfo || "Device online")}
                {probeState === "err"      && `No response — ${probeInfo || "check address and WiFi"}`}
              </span>
            </div>
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
          <div className="settings-section-title">User State</div>
          <div className="settings-row">
            <div>
              <div className="settings-label">Active User</div>
              <div className="settings-sub">{profile?.name || "No user selected"} · settings and Core memory are local to this profile</div>
            </div>
            <button className="mode-btn" onClick={onSwitchUser}>Switch</button>
          </div>
        </motion.div>

        <motion.div className="glass settings-section" custom={4} variants={panelVariants} initial="hidden" animate="visible">
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
                  <span className="core-plan-code"><BaseBadge code={ex.short} className="action-badge-svg" /></span>
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
              <span className="core-plan-code"><BaseBadge code={message.payload?.exerciseShort ?? "AI"} className="action-badge-svg" /></span>
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

function CoreScreen({ messages, onSend, onExecutePlan, onQuickPlan, isThinking = false }) {
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
          {isThinking && (
            <div className="core-thinking-row">
              <Lottie animationData={lottieAiCore} loop={true} style={{ width:120, height:120 }} />
              <span className="core-thinking-label">Kinetic Core thinking...</span>
            </div>
          )}
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

// ─── Nexus Check-ins ─────────────────────────────────────────────────────────

function NexusNodeAvatar({ id, mood = "satisfied", size = 58, isMine = false }) {
  const seed = String(id ?? "athlete")
    .replace("mock_", "")
    .replace(/^me_\d+$/, isMine ? "you" : "athlete");
  const moodColor = NEXUS_MOOD_BY_ID[mood]?.tone ?? "#00FF9D";
  const avatarUri = useMemo(
    () => createAvatar(thumbs, { seed }).toDataUri(),
    [seed],
  );
  return (
    <span
      className="nexus-avatar-wrap"
      style={{ "--mood": moodColor, width: `${size}px`, height: `${size}px` }}
    >
      <img
        src={avatarUri}
        width={size}
        height={size}
        className="nexus-avatar-img"
        alt=""
        aria-hidden="true"
      />
      <span className="nexus-avatar-dot" />
    </span>
  );
}

function MoodAvatar({ mood = "satisfied", size = 54, className = "" }) {
  const meta = NEXUS_MOOD_BY_ID[mood] ?? NEXUS_MOOD_BY_ID.satisfied;
  const face = meta.face;
  const mouth = face === "laughing"
    ? <path d="M18 31c3.2 4 8.8 4 12 0" />
    : face === "happy"
    ? <path d="M18 31c3 2.8 8.5 2.8 12 0" />
    : face === "satisfied"
    ? <path d="M19 31c2.5 1.6 7.5 1.6 10 0" />
    : face === "sleepy"
    ? <path d="M19 32h10" />
    : <path d="M19 33c2.4-1.2 7.6-1.2 10 0" />;
  const eyes = face === "sleepy"
    ? <><path d="M16 23h6" /><path d="M26 23h6" /></>
    : face === "laughing"
    ? <><path d="M16 22l5 3" /><path d="M32 22l-5 3" /></>
    : <><circle cx="19" cy="23" r="1.6" /><circle cx="29" cy="23" r="1.6" /></>;

  return (
    <svg className={`mood-avatar ${className}`} width={size} height={size} viewBox="0 0 48 48" fill="none" style={{ "--mood": meta.tone }}>
      <circle cx="24" cy="24" r="18" fill="rgba(255,255,255,0.08)" stroke="var(--mood)" strokeWidth="2" />
      <path d="M15 39c2.5-5 15.5-5 18 0" stroke="var(--mood)" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <g stroke="var(--mood)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {eyes}
        {mouth}
      </g>
      {face === "tired" && <path d="M34 26c2 2 2 4 0 6" stroke="var(--mood)" strokeWidth="1.7" strokeLinecap="round" opacity="0.8" />}
    </svg>
  );
}

function NexusCheckInScreen({ checkins, onBack }) {
  const [selectedId, setSelectedId] = useState(() => checkins[0]?.id ?? NEXUS_MOCK_CHECKINS[0].id);
  const [boosts, setBoosts] = useState({});
  const [tapId, setTapId] = useState(null);
  const [resonateKey, setResonateKey] = useState(0);
  const [resonatingTo, setResonatingTo] = useState(null);
  const [burstIds, setBurstIds] = useState({});
  const [btnFiring, setBtnFiring] = useState(false);

  // Only the most recent check-in is shown as "You" — older ones are history
  const owned = checkins.slice(0, 1).map((item) => ({
    ...item,
    isMine: true,
    x: 50,
    y: 52,
  }));
  const nodes = [...owned, ...NEXUS_MOCK_CHECKINS];
  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0];
  const selectedExercise = exerciseById(selected?.exerciseId);
  const selectedMood = NEXUS_MOOD_BY_ID[selected?.mood] ?? NEXUS_MOOD_BY_ID.satisfied;
  const selectedResonance = (selected?.resonance ?? 0) + (boosts[selected?.id] ?? 0);
  const mine = nodes.find((node) => node.isMine) ?? nodes[0];

  useEffect(() => {
    if (checkins[0]?.id) setSelectedId(checkins[0].id);
  }, [checkins]);

  function handleNodeClick(id) {
    setSelectedId(id);
    setTapId(id);
    setTimeout(() => setTapId(null), 450);
  }

  function resonate(id) {
    const target = nodes.find((n) => n.id === id);
    setBoosts((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
    setBtnFiring(true);
    setTimeout(() => setBtnFiring(false), 600);
    if (target && mine) {
      setResonatingTo(target);
      setResonateKey((k) => k + 1);
      setTimeout(() => {
        setResonatingTo(null);
        setBurstIds((prev) => ({ ...prev, [id]: true }));
        setTimeout(() => setBurstIds((prev) => { const n = { ...prev }; delete n[id]; return n; }), 2000);
      }, 700);
    }
  }

  return (
    <div className="screen-pad">
      <div className="nexus-wrap">
        <div className="nexus-header">
          <button className="nexus-back" type="button" onClick={onBack}>Back</button>
          <div>
            <div className="sys-label-em">Mutual Check-ins</div>
            <h2 className="ath-title" style={{ fontSize: "1.3rem", marginTop: "0.25rem" }}>Nexus Room</h2>
          </div>
        </div>

        <motion.div className="glass nexus-stage" variants={panelVariants} initial="hidden" animate="visible">
          <div className="nexus-stage-pulse" />

          <svg className="nexus-links" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <filter id="nexus-glow-filter" x="-120%" y="-120%" width="340%" height="340%">
                <feGaussianBlur stdDeviation="2.2" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            {nodes.filter((node) => node.id !== mine?.id).map((node, index) => {
              const isActive = node.id === selected?.id;
              const supportNeed = Math.max(0, 1 - (node.dtwAvg ?? 100) / 100);
              const lineStyle = {
                animationDelay: `${index * 0.15}s`,
                ...(!isActive ? {
                  strokeWidth: (0.22 + supportNeed * 0.95).toFixed(2),
                  // low-DTW lines: amber override works in both themes
                  // high-DTW lines: NO inline stroke — let CSS theme rule control color
                  ...(node.dtwAvg < 82 ? {
                    stroke: `rgba(255,184,0,${(0.18 + supportNeed * 0.58).toFixed(2)})`,
                    strokeDasharray: "2 3",
                  } : {}),
                } : {}),
              };
              return (
                <line
                  key={node.id}
                  x1={mine?.x ?? 50} y1={mine?.y ?? 52}
                  x2={node.x} y2={node.y}
                  className={isActive ? "active" : ""}
                  style={lineStyle}
                />
              );
            })}
            {resonatingTo && mine && (
              <g key={resonateKey} filter="url(#nexus-glow-filter)">
                <circle r="1.8" fill={resonatingTo.dtwAvg < 82 ? "#FFB800" : "#00FF9D"}>
                  <animateMotion
                    dur="0.68s" fill="freeze"
                    path={`M${mine.x},${mine.y} L${resonatingTo.x},${resonatingTo.y}`}
                  />
                  <animate attributeName="r"       dur="0.68s" values="1;2.6;2;3.8" fill="freeze" />
                  <animate attributeName="opacity" dur="0.68s" values="0;1;1;0.1"   fill="freeze" />
                </circle>
              </g>
            )}
          </svg>

          {nodes.map((node, index) => {
            const mood = NEXUS_MOOD_BY_ID[node.mood] ?? NEXUS_MOOD_BY_ID.satisfied;
            const ex = exerciseById(node.exerciseId);
            const active = node.id === selected?.id;
            const needsBoost = !node.isMine && (node.dtwAvg ?? 100) < 82;
            const shining = !node.isMine && (node.dtwAvg ?? 0) >= 88;
            return (
              <button
                key={node.id}
                className={[
                  "nexus-node",
                  node.isMine ? "mine" : "",
                  active ? "active" : "",
                  tapId === node.id ? "tapping" : "",
                  needsBoost ? "needs-boost" : "",
                  shining ? "shining" : "",
                ].filter(Boolean).join(" ")}
                style={{
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  "--mood": mood.tone,
                  animationDelay: `${index * 0.22}s`,
                }}
                onClick={() => handleNodeClick(node.id)}
                type="button"
              >
                <span className={`nexus-node-burst ${burstIds[node.id] ? "active" : ""}`} style={{ "--mood": mood.tone }} />
                {needsBoost && <span className="nexus-boost-badge" />}
                <NexusNodeAvatar id={node.id} mood={node.mood} size={node.isMine ? 70 : 58} isMine={!!node.isMine} />
                <span className="nexus-node-name">{node.isMine ? "You" : node.name.replace("Athlete_", "")}</span>
                <span className="nexus-node-meta">{ex.short} · {node.dtwAvg}%</span>
              </button>
            );
          })}
        </motion.div>

        {(() => {
          const targetNeedsBoost = !selected?.isMine && (selected?.dtwAvg ?? 100) < 82;
          const resonateLabel = selected?.isMine
            ? "Your check-in"
            : targetNeedsBoost ? "Boost Signal" : "Send Resonance";
          const resonateBtnLabel = targetNeedsBoost ? "Send Boost" : "Send Resonance";
          const supportHint = targetNeedsBoost
            ? `${selected?.dtwAvg ?? 0}% form — a signal keeps the chain going.`
            : selected?.isMine
              ? `Your signal. ${selectedResonance} resonance received.`
              : `${selected?.dtwAvg ?? 0}% form — strong session.`;
          return (
            <motion.div className="glass nexus-detail" custom={1} variants={panelVariants} initial="hidden" animate="visible">
              <div className="nexus-detail-main">
                <MoodAvatar mood={selected?.mood} size={58} />
                <div>
                  <div className="nexus-detail-name">
                    {selected?.isMine ? "Your check-in" : (selected?.name?.replace("Athlete_", "") ?? "—")}
                    {targetNeedsBoost && <span className="nexus-boost-tag">Needs Boost</span>}
                  </div>
                  <div className="nexus-detail-sub">{selectedExercise.label} · {selected?.reps ?? 0} reps</div>
                  <div className="nexus-detail-sub" style={{ marginTop: "0.18rem", opacity: 0.72 }}>{supportHint}</div>
                </div>
              </div>
              <div className="nexus-mood-line">
                <span style={{ color: selectedMood.tone }}>{selectedMood.label}</span>
                <span>{selectedResonance} resonance</span>
              </div>
              {!selected?.isMine && (
                <button
                  className={`nexus-resonate ${btnFiring ? "firing" : ""} ${targetNeedsBoost ? "boost-mode" : ""}`}
                  type="button"
                  style={{ "--mood": targetNeedsBoost ? "#FFB800" : selectedMood.tone }}
                  onClick={() => resonate(selected.id)}
                >
                  {resonateBtnLabel}
                </button>
              )}
            </motion.div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── BottomNav ────────────────────────────────────────────────────────────────

const BaseBadge = ({ code, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="6 2, 18 2, 22 6, 22 18, 18 22, 6 22, 2 18, 2 6" />
    <path d="M2 10v4" /><path d="M22 10v4" />
    <text x="12" y="16" textAnchor="middle" fill="currentColor" stroke="none" fontSize="10" fontWeight="900" fontFamily="system-ui,-apple-system,sans-serif" letterSpacing="0.5">{code}</text>
  </svg>
);

const IconKineticCore = ({ className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 22v-8" />
    <path d="M10.27 11L3.5 7.5" />
    <path d="M13.73 11L20.5 7.5" />
  </svg>
);

const IconEdgeNode = ({ className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <path d="M9 2v4" /><path d="M15 2v4" />
    <path d="M9 22v-4" /><path d="M15 22v-4" />
    <path d="M2 9h4" /><path d="M2 15h4" />
    <path d="M22 9h-4" /><path d="M22 15h-4" />
  </svg>
);

const IconJumpIn = ({ className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const IconAIPlan = ({ className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M10 3L11.8 7.2L16 9L11.8 10.8L10 15L8.2 10.8L4 9L8.2 7.2L10 3Z" />
    <path d="M18 14L18.9 16.1L21 17L18.9 17.9L18 20L17.1 17.9L15 17L17.1 16.1L18 14Z" />
  </svg>
);

const IconHomeMode = ({ className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="7" y1="12" x2="17" y2="12" />
    <rect x="4" y="6" width="3" height="12" rx="0.5" />
    <rect x="17" y="6" width="3" height="12" rx="0.5" />
    <path d="M4 9H2.5C2.22386 9 2 9.22386 2 9.5V14.5C2 14.7761 2.22386 15 2.5 15H4" />
    <path d="M20 9H21.5C21.7761 9 22 9.22386 22 9.5V14.5C22 14.7761 21.7761 15 21.5 15H20" />
  </svg>
);

const IconHome = ({ className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const IconCore = ({ className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v7" />
    <path d="M12 15v7" />
    <path d="M22 12h-7" />
    <path d="M9 12H2" />
    <circle cx="12" cy="2" r="1" />
    <circle cx="12" cy="22" r="1" />
    <circle cx="22" cy="12" r="1" />
    <circle cx="2" cy="12" r="1" />
  </svg>
);

const IconNexus = ({ className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="2.6" />
    <circle cx="5" cy="7" r="2" />
    <circle cx="19" cy="7" r="2" />
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="18" r="2" />
    <path d="M7 8.2l3.1 2.1" />
    <path d="M17 8.2l-3.1 2.1" />
    <path d="M7.8 17l2.4-3.1" />
    <path d="M16.2 17l-2.4-3.1" />
  </svg>
);

const IconProfile = ({ className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconSetup = ({ className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

function BottomNav({ tab, onChange, aiUnread }) {
  const items = [
    { id: "home",    label: "Home",    Icon: IconHome },
    { id: "core",    label: "Core",    Icon: IconCore },
    { id: "nexus",   label: "Nexus",   Icon: IconNexus },
    { id: "profile", label: "Profile", Icon: IconProfile },
    { id: "setup",   label: "Setup",   Icon: IconSetup },
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
            <item.Icon className="nav-icon-svg" />
            {item.id === "core" && aiUnread && <span className="nav-unread-dot" />}
          </span>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function KineticLifeApp() {
  useEffect(() => { clearLegacySingleUserKeys(); }, []);

  const [screen, setScreen] = useState("auth");
  const [navTab, setNavTab] = useState("home");
  const [currentUser, setCurrentUser] = useState(() => getActiveUserName());
  const [profile, setProfile] = useState(() => loadProfile());
  const [muscleStatus, setMuscleStatus] = useState(() => loadMuscleStatus());
  const [exercise, setExercise] = useState(null);
  const [sessionResult, setSessionResult] = useState(null);
  const [visualState, setVisualState] = useState("auth");
  const [flowMode, setFlowMode] = useState(null);
  const [homeWorkoutCtx, setHomeWorkoutCtx] = useState(null);
  const [coreThinking, setCoreThinking] = useState(false);
  // homeWorkoutCtx shape: { routeId, stepIdx, lastDoneIdx, hwSub, totalReps, startTime, kiniLine }
  const [deviceUrl, setDeviceUrl] = useState(() => loadDeviceUrl());
  const [connMode, setConnMode] = useState(() => loadConnMode());
  const [lastDevice, setLastDevice] = useState(() => loadLastDevice());
  const [theme, setTheme] = useState(() => loadTheme());
  const [aiMessages, setAiMessages] = useState(() => loadAiMessages());
  const [aiUnread, setAiUnread] = useState(() => loadAiUnread());
  const [nexusCheckins, setNexusCheckins] = useState(() => loadNexusCheckins());
  const iotConnRef = useRef(null);
  const screenLayerRef = useRef(null);

  useEffect(() => { saveDeviceUrl(deviceUrl, currentUser); }, [deviceUrl, currentUser]);
  useEffect(() => { saveConnMode(connMode, currentUser); }, [connMode, currentUser]);
  useEffect(() => { saveTheme(theme, currentUser); }, [theme, currentUser]);

  const NAV_SCREENS = ["dashboard", "core", "nexus", "profile", "settings"];
  const showNav = NAV_SCREENS.includes(screen);

  useEffect(() => {
    const root = document.documentElement;
    const updateViewportMetrics = () => {
      const visualViewport = window.visualViewport;
      const height = visualViewport?.height || window.innerHeight;
      const nav = document.querySelector(".bottom-nav");
      root.style.setProperty("--app-height", `${Math.round(height)}px`);
      if (nav) root.style.setProperty("--bottom-nav-h", `${Math.ceil(nav.getBoundingClientRect().height)}px`);
      else root.style.setProperty("--bottom-nav-h", "76px");
    };

    updateViewportMetrics();
    window.addEventListener("resize", updateViewportMetrics);
    window.addEventListener("orientationchange", updateViewportMetrics);
    window.visualViewport?.addEventListener("resize", updateViewportMetrics);
    window.visualViewport?.addEventListener("scroll", updateViewportMetrics);
    return () => {
      window.removeEventListener("resize", updateViewportMetrics);
      window.removeEventListener("orientationchange", updateViewportMetrics);
      window.visualViewport?.removeEventListener("resize", updateViewportMetrics);
      window.visualViewport?.removeEventListener("scroll", updateViewportMetrics);
    };
  }, [showNav]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const layer = screenLayerRef.current;
      if (!layer) return;
      const scrollables = layer.querySelectorAll(
        ".auth-wrap,.dash-wrap,.connect-wrap,.classify-wrap,.live-root,.analysis-wrap,.nexus-wrap,.profile-wrap,.settings-wrap,.plan-wrap,.core-timeline,.hw-wrap,.cardio-wrap"
      );
      scrollables.forEach((el) => {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [screen]);

  function appendAiMessage(message, { unread = true } = {}) {
    setAiMessages((prev) => {
      const next = [...prev, message].slice(-60);
      saveAiMessages(next, currentUser);
      return next;
    });
    if (unread && screen !== "core") {
      setAiUnread(true);
      saveAiUnread(true, currentUser);
    }
  }

  function clearAiUnread() {
    setAiUnread(false);
    saveAiUnread(false, currentUser);
  }

  function clearActiveConnection() {
    const conn = iotConnRef.current;
    try {
      const gatt = conn?.bleTxChar?.service?.device?.gatt;
      if (gatt?.connected) gatt.disconnect();
    } catch {}
    iotConnRef.current = null;
  }

  function handleEnter(name) {
    const userName = String(name ?? "").trim();
    const switchingUser = normalizeUserId(userName) !== normalizeUserId(currentUser);

    const nextProfile = loadProfile(userName);
    const nextMuscleStatus = loadMuscleStatus(userName);
    const nextAiMessages = loadAiMessages(userName);
    const nextAiUnread = loadAiUnread(userName);
    const nextNexusCheckins = loadNexusCheckins(userName);
    const nextDeviceUrl = loadDeviceUrl(userName);
    const nextConnMode = loadConnMode(userName);
    const nextLastDevice = loadLastDevice(userName);
    const nextTheme = loadTheme(userName);

    if (switchingUser) {
      clearActiveConnection();
      setExercise(null);
      setSessionResult(null);
      setFlowMode(null);
    }

    setActiveUserName(userName);
    setCurrentUser(userName);
    setProfile(nextProfile);
    setMuscleStatus(nextMuscleStatus);
    setAiMessages(nextAiMessages);
    setAiUnread(nextAiUnread);
    setNexusCheckins(nextNexusCheckins);
    setDeviceUrl(nextDeviceUrl);
    setConnMode(nextConnMode);
    setLastDevice(nextLastDevice);
    setTheme(nextTheme);
    saveProfile(nextProfile);
    saveMuscleStatus(nextMuscleStatus, userName);
    saveAiMessages(nextAiMessages, userName);
    saveAiUnread(nextAiUnread, userName);
    saveNexusCheckins(nextNexusCheckins, userName);
    saveDeviceUrl(nextDeviceUrl, userName);
    saveConnMode(nextConnMode, userName);
    saveTheme(nextTheme, userName);
    setScreen("dashboard");
    setVisualState("idle");
    setNavTab("home");
  }

  function handleSwitchUser() {
    clearActiveConnection();
    setExercise(null);
    setSessionResult(null);
    setFlowMode(null);
    setScreen("auth");
    setVisualState("auth");
    setNavTab("home");
  }

  function handleNavTab(tab) {
    setNavTab(tab);
    if (tab === "home") { setScreen("dashboard"); setVisualState("idle"); }
    if (tab === "core") { setScreen("core"); setVisualState("idle"); clearAiUnread(); }
    if (tab === "nexus") { setScreen("nexus"); setVisualState("idle"); }
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
    setHomeWorkoutCtx({
      routeId:null, stepIdx:0, lastDoneIdx:-1, hwSub:"select",
      totalReps:0, startTime:null, kiniLine:pickKiniLineForSelection(muscleStatus),
      currentSet:1, totalSets:0, targetReps:0, setResults:[],
    });
    setScreen("home_workout");
    setVisualState("idle");
  }

  function handleHomeSelectRoute(routeId) {
    setHomeWorkoutCtx(prev => ({
      ...prev, routeId, hwSub:"map", startTime: Date.now(),
      mapKiniLine: pickKiniLineForMap(routeId, muscleStatus),
    }));
  }

  function handleHomeNodeTap(stepIdx) {
    const route = HOME_ROUTES[homeWorkoutCtx.routeId];
    const step = route.steps[stepIdx];
    if (step.type === "cardio") {
      setHomeWorkoutCtx(prev => ({ ...prev, stepIdx, hwSub: "cardio", kiniLine: pickKiniLine("cardio") }));
    } else {
      setHomeWorkoutCtx(prev => ({
        ...prev, stepIdx,
        currentSet:1, totalSets:step.sets, targetReps:step.reps, setResults:[],
      }));
      goLive(exerciseById(step.exerciseId));
    }
  }

  function handleHomeStartNextSet() {
    const route = HOME_ROUTES[homeWorkoutCtx.routeId];
    const step = route.steps[homeWorkoutCtx.stepIdx];
    goLive(exerciseById(step.exerciseId));
  }

  function handleHomeExerciseContinue() {
    const route = HOME_ROUTES[homeWorkoutCtx.routeId];
    const nextIdx = homeWorkoutCtx.stepIdx;
    if (nextIdx >= route.steps.length) {
      setHomeWorkoutCtx(prev => ({ ...prev, hwSub:"reward", kiniLine:pickKiniLine("reward") }));
    } else {
      const nextStep = route.steps[nextIdx];
      if (nextStep.type === "cardio") {
        setHomeWorkoutCtx(prev => ({ ...prev, hwSub: "cardio", kiniLine: pickKiniLine("cardio") }));
      } else {
        setHomeWorkoutCtx(prev => ({
          ...prev, hwSub:"map",
          currentSet:1, totalSets:nextStep.sets, targetReps:nextStep.reps, setResults:[],
        }));
      }
    }
  }

  function handleHomeCardioPreviewReady() {
    setHomeWorkoutCtx(prev => ({ ...prev, hwSub: "cardio" }));
  }

  function handleHomeBetweenContinue() {
    const route = HOME_ROUTES[homeWorkoutCtx.routeId];
    const step = route.steps[homeWorkoutCtx.stepIdx];
    if (step?.type === "cardio") {
      setHomeWorkoutCtx(prev => ({ ...prev, hwSub: "cardio", kiniLine: pickKiniLine("cardio") }));
    } else {
      setHomeWorkoutCtx(prev => ({ ...prev, hwSub:"map" }));
    }
  }

  function handleHomeCardioDone() {
    const route = HOME_ROUTES[homeWorkoutCtx.routeId];
    const updated = { ...muscleStatus };
    Object.entries(route.muscles).forEach(([muscle, intensity]) => {
      updated[muscle] = Math.min(1, (updated[muscle] ?? 0) + intensity * 0.15);
    });
    setMuscleStatus(updated);
    saveMuscleStatus(updated, currentUser);
    setHomeWorkoutCtx(prev => ({ ...prev, hwSub:"reward", kiniLine:pickKiniLine("reward") }));
  }

  function handleHomeCollectReward() {
    // Post AI Core summary before clearing ctx
    if (homeWorkoutCtx) {
      const route = HOME_ROUTES[homeWorkoutCtx.routeId];
      const totalReps = homeWorkoutCtx.totalReps ?? 0;
      const elapsed   = homeWorkoutCtx.startTime ? Math.round((Date.now() - homeWorkoutCtx.startTime) / 1000) : 0;
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      const results  = homeWorkoutCtx.setResults ?? [];
      const avgDtw   = results.length ? results.reduce((s, r) => s + (r.dtw ?? 0), 0) / results.length : 0.5;
      const accuracy = Math.round(avgDtw * 100);
      const isUpper  = homeWorkoutCtx.routeId === "upper";
      const topMuscles = Object.entries(route.muscles)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([m]) => m.replace(/_/g, " "))
        .join(", ");
      const dtwLabel = accuracy >= 85 ? "Excellent form consistency" : accuracy >= 70 ? "Good technique" : "Form had room to improve";

      appendAiMessage(makeAiMessage({
        type: "post_workout",
        content: `${route.name} complete — ${totalReps} reps · ${mins}m ${String(secs).padStart(2,"0")}s · avg form ${accuracy}%. ${dtwLabel}. Primary load: ${topMuscles}. Recovery status updated.`,
        payload: {
          accuracy,
          reps: totalReps,
          elapsed,
          exerciseId: homeWorkoutCtx.routeId === "upper" ? "both_bicep_curl" : "squat",
          exerciseLabel: route.name,
          exerciseShort: isUpper ? "APX" : "FRG",
        },
      }));
    }

    setHomeWorkoutCtx(null);
    setFlowMode(null);
    setScreen("dashboard");
    setNavTab("home");
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
    // ── Always update profile & muscle status ──────────────────────────────
    setSessionResult(data);
    const updProf = {
      ...profile,
      sessionsCount: (profile.sessionsCount ?? 0) + 1,
      averageForm: Math.round(((profile.averageForm ?? 0) + (data.dtw ?? 0.5) * 100) / 2),
    };
    setProfile(updProf); saveProfile(updProf);
    const repEntries2 = Object.entries(data.classification?.repsByExercise ?? {})
      .filter(([, c]) => Number(c) > 0);
    const trainedEntries2 = repEntries2.length
      ? repEntries2 : data.exerciseId ? [[data.exerciseId, Math.max(1, data.reps ?? 1)]] : [];
    if (trainedEntries2.length) {
      const ms2 = { ...muscleStatus };
      const tot2 = trainedEntries2.reduce((s,[,c]) => s + Math.max(0, Number(c)||0), 0);
      trainedEntries2.forEach(([eid, cnt]) => {
        const tgts = getExerciseTargets(eid);
        const share = tot2 > 0 ? Math.max(0.25, (Number(cnt)||0)/tot2) : 1;
        Object.entries(tgts).forEach(([m, iv]) => {
          ms2[m] = Math.min(1, (ms2[m] ?? 0) + (0.10 + iv * 0.18) * share);
        });
      });
      setMuscleStatus(ms2); saveMuscleStatus(ms2, currentUser);
    }

    // ── Home workout: skip analysis, route to set_rest / exercise_done ──────
    if (homeWorkoutCtx) {
      const dtw  = data.dtw  ?? 0.5;
      const reps = data.reps ?? 0;
      const newResults = [...(homeWorkoutCtx.setResults ?? []), { dtw, reps }];
      const nextSet    = homeWorkoutCtx.currentSet + 1;
      const allDone    = nextSet > homeWorkoutCtx.totalSets;
      const nextStepIdx = homeWorkoutCtx.stepIdx + 1;

      if (!allDone) {
        setHomeWorkoutCtx(prev => ({
          ...prev,
          currentSet: nextSet, setResults: newResults,
          totalReps: (prev.totalReps ?? 0) + reps,
          hwSub: "set_rest", lastSetDtw: dtw,
          kiniLine: pickKiniLine("set_rest"),
        }));
      } else {
        const avgDtw = newResults.reduce((s, r) => s + r.dtw, 0) / newResults.length;
        setHomeWorkoutCtx(prev => ({
          ...prev,
          setResults: newResults, stepIdx: nextStepIdx,
          totalReps: (prev.totalReps ?? 0) + reps,
          hwSub: "exercise_done", lastSetDtw: avgDtw,
          kiniLine: pickKiniLine("exercise_done"),
        }));
      }
      setScreen("home_workout");
      setVisualState("idle");
      return;
    }

    // ── Standard gym mode ──────────────────────────────────────────────────
    // Gym mode: show analysis + AI message
    const finishedExercise = data.exerciseId ? exerciseById(data.exerciseId) : null;
    const accuracy = Math.round((data.dtw ?? 0) * 100);
    appendAiMessage(makeAiMessage({
      type: "post_workout",
      content: finishedExercise
        ? `Training complete. ${finishedExercise.label} finished at ${accuracy}% DTW alignment. Recovery load has been updated.`
        : `Training complete. No library movement was confidently assigned; Core stored this as an unassigned session note.`,
      payload: {
        accuracy, reps: data.reps ?? 0, elapsed: data.elapsed ?? 0,
        exerciseId: data.exerciseId ?? null,
        exerciseLabel: finishedExercise?.label ?? "Unassigned Session",
        exerciseShort: finishedExercise?.short ?? "--",
      },
    }));
    setScreen("analysis");
    setVisualState("idle");
  }

  function handleShareCheckIn(mood) {
    const exerciseId = sessionResult?.exerciseId ?? exercise?.id ?? "squat";
    const checkIn = {
      id: `me_${Date.now()}`,
      name: profile?.name ? `${profile.name}` : "You",
      exerciseId,
      reps: sessionResult?.reps ?? 0,
      dtwAvg: Math.round((sessionResult?.dtw ?? 0.74) * 100),
      mood: NEXUS_MOOD_BY_ID[mood] ? mood : "satisfied",
      resonance: 1,
      timestamp: Date.now(),
    };
    const next = [checkIn, ...nexusCheckins].slice(0, 6);
    setNexusCheckins(next);
    saveNexusCheckins(next, currentUser);
    setScreen("nexus");
    setNavTab("nexus");
    setVisualState("idle");
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
    if (homeWorkoutCtx) {
      const route = HOME_ROUTES[homeWorkoutCtx.routeId];
      const nextStepIdx = homeWorkoutCtx.stepIdx + 1;
      if (nextStepIdx >= route.steps.length) {
        setHomeWorkoutCtx(prev => ({ ...prev, hwSub:"reward", kiniLine:pickKiniLine("reward") }));
      } else {
        setHomeWorkoutCtx(prev => ({ ...prev, stepIdx:nextStepIdx, lastDoneIdx:prev.stepIdx, hwSub:"between", kiniLine:pickKiniLine("between") }));
      }
      setScreen("home_workout");
      setVisualState("idle");
      return;
    }
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
    setCoreThinking(true);

    const delay = 500 + Math.random() * 2500;
    setTimeout(() => {
      try {
      const inferred = inferInjuryTagsFromText(text);
      if (inferred.length) {
        const current = loadAiCoreProfile(currentUser);
        const merged = normalizeTags([...(current.injuryTags ?? []), ...inferred]);
        saveAiCoreProfile({ ...current, injuryTags: merged, updatedAt: Date.now() }, currentUser);
        const labels = inferred.map((id) => AI_CORE_INJURY_OPTIONS.find((item) => item.id === id)?.label ?? id).join(", ");
        appendAiMessage(makeAiMessage({
          type: "text",
          content: pickReply(CORE_REPLIES.injury, "injury")(labels),
          payload: { injuryTags: inferred },
        }), { unread: false });
        return;
      }

      const lower = text.toLowerCase();

      if (lower.includes("generate") || lower.includes("plan") || lower.includes("workout") ||
          (lower.includes("today") && (lower.includes("train") || lower.includes("session") || lower.includes("exercise")))) {
        const coreProfile = loadAiCoreProfile(currentUser);
        const decision = generateAiCorePlan({ profile: coreProfile, muscleStatus, focusTags: coreProfile.focusTags ?? [] });
        appendAiMessage(makeAiMessage({ type: "daily_plan", content: decision.dialogue, payload: decision.payload }));
        return;
      }

      if (lower.includes("tired") || lower.includes("fatigue") || lower.includes("exhausted") ||
          lower.includes("sore") || lower.includes("aching") || lower.includes("beat")) {
        const todayStart = new Date().setHours(0, 0, 0, 0);
        const todayWorkouts = aiMessages.filter((m) => m.type === "post_workout" && m.timestamp >= todayStart);
        if (todayWorkouts.length > 0) {
          const lineStr = todayWorkouts.map((m) =>
            `${m.payload?.exerciseLabel ?? "Session"} — ${m.payload?.reps ?? 0} reps, ${m.payload?.accuracy ?? 0}% alignment`
          ).join("\n");
          appendAiMessage(makeAiMessage({ type: "text", content: pickReply(CORE_REPLIES.tired_with, "tired_with")(lineStr) }));
        } else {
          appendAiMessage(makeAiMessage({ type: "text", content: pickReply(CORE_REPLIES.tired_none, "tired_none") }));
        }
        return;
      }

      if (lower.includes("progress") || lower.includes("how am i") || lower.includes("stats") ||
          lower.includes("status") || lower.includes("how many") || lower.includes("summary")) {
        const sessions = profile?.sessionsCount ?? 0;
        const form = profile?.averageForm ?? 0;
        appendAiMessage(makeAiMessage({ type: "text", content: pickReply(CORE_REPLIES.progress, "progress")(sessions, form) }));
        return;
      }

      if (lower.includes("motivat") || lower.includes("struggling") || lower.includes("give up") ||
          lower.includes("hard") || lower.includes("can't") || lower.includes("ready") ||
          lower.includes("let's go") || lower.includes("lets go") || lower.includes("pumped")) {
        appendAiMessage(makeAiMessage({ type: "text", content: pickReply(CORE_REPLIES.motivation, "motivation") }));
        return;
      }

      if (lower.includes("form") || lower.includes("technique") || lower.includes("how to") ||
          lower.includes("correct") || lower.includes("posture") || lower.includes("align") ||
          lower.includes("wrong") || lower.includes("angle")) {
        appendAiMessage(makeAiMessage({ type: "text", content: pickReply(CORE_REPLIES.technique, "technique") }));
        return;
      }

      if (lower.includes("sleep") || lower.includes("recover") || lower.includes("stretch") ||
          lower.includes("rest day") || lower.includes("mobility") || lower.includes("doms") ||
          lower.includes("massage") || lower.includes("off day")) {
        appendAiMessage(makeAiMessage({ type: "text", content: pickReply(CORE_REPLIES.recovery, "recovery") }));
        return;
      }

      if (lower.includes("eat") || lower.includes("protein") || lower.includes("diet") ||
          lower.includes("food") || lower.includes("nutrition") || lower.includes("calor") ||
          lower.includes("hydrat") || lower.includes("water") || lower.includes("pre-workout") ||
          lower.includes("post-workout") || lower.includes("supplement")) {
        appendAiMessage(makeAiMessage({ type: "text", content: pickReply(CORE_REPLIES.nutrition, "nutrition") }));
        return;
      }

      appendAiMessage(makeAiMessage({ type: "text", content: pickReply(CORE_REPLIES.default, "default") }));
      } finally {
        setCoreThinking(false);
      }
    }, delay);
  }

  const handleConnectedCallback = useCallback((deviceInfo) => {
    if (deviceInfo) {
      iotConnRef.current = deviceInfo;
      const meta = { mode: deviceInfo.mode, name: deviceInfo.name, id: deviceInfo.id, url: deviceInfo.url, connectedAt: Date.now() };
      setLastDevice(meta);
      saveLastDevice(meta, currentUser);
    }
    setScreen("live");
    setVisualState("connected");
    setTimeout(() => setVisualState("idle"), 1000);
  }, [currentUser]);

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
            theme={theme}
          />
        );
      case "auto_classify":
        return <AutoClassifyScreen onClassified={handleClassified} onBack={handleBack} />;
      case "plan_config":
        return <PlanConfigScreen onBegin={handlePlanBegin} onBack={handleBack} muscleStatus={muscleStatus} theme={theme} userName={currentUser} onPlanGenerated={handlePlanGenerated} />;
      case "home_coach":
        return <HomeCoachScreen onBegin={handleCoachBegin} onBack={handleBack} />;
      case "home_workout":
        return (
          <HomeWorkoutContainer
            ctx={homeWorkoutCtx}
            onSelectRoute={handleHomeSelectRoute}
            onNodeTap={handleHomeNodeTap}
            onContinueBetween={handleHomeBetweenContinue}
            onCardioDone={handleHomeCardioDone}
            onCollectReward={handleHomeCollectReward}
            onExit={handleHomeCollectReward}
            onStartNextSet={handleHomeStartNextSet}
            onExerciseContinue={handleHomeExerciseContinue}
            onCardioPreviewReady={handleHomeCardioPreviewReady}
            iotConnRef={iotConnRef}
          />
        );
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
            homeMode={!!homeWorkoutCtx}
            targetReps={homeWorkoutCtx?.targetReps ?? null}
          />
        );
      case "analysis":
        return (
          <AnalysisScreen
            result={sessionResult}
            onNewSet={handleNewSet}
            onDone={handleDone}
            onShareCheckIn={handleShareCheckIn}
            theme={theme}
          />
        );
      case "nexus":
        return (
          <NexusCheckInScreen
            checkins={nexusCheckins}
            onBack={handleDone}
          />
        );
      case "core":
        return (
          <CoreScreen
            messages={aiMessages}
            onSend={handleCoreSend}
            onExecutePlan={handlePlan}
            onQuickPlan={handlePlan}
            isThinking={coreThinking}
          />
        );
      case "profile":
        return <ProfileScreen profile={profile} muscleStatus={muscleStatus} theme={theme} />;
      case "settings":
        return (
          <SettingsScreen
            profile={profile}
            deviceUrl={deviceUrl}
            setDeviceUrl={setDeviceUrl}
            connMode={connMode}
            setConnMode={setConnMode}
            theme={theme}
            setTheme={setTheme}
            onSwitchUser={handleSwitchUser}
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

        <div ref={screenLayerRef} className="ath-screen-host">
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
        </div>

        {showNav && <BottomNav tab={navTab} onChange={handleNavTab} aiUnread={aiUnread} />}
      </div>
    </>
  );
}
