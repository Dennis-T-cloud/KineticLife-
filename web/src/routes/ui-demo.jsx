import { useState, useEffect, useRef } from "react";

const EXERCISES = [
  { id: "squat", label: "Bodyweight Squat", icon: "🦵", joints: ["left_knee", "right_knee"] },
  { id: "curl", label: "Dumbbell Curl", icon: "💪", joints: ["right_elbow"] },
  { id: "lateral_raise", label: "Lateral Raise", icon: "🙌", joints: ["left_shoulder", "right_shoulder"] },
];

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
    overflow: hidden;
  }

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

  /* WELCOME */
  .welcome-wrap {
    flex: 1; display: flex; flex-direction: column;
    justify-content: space-between;
    padding: 3.5rem 0 2.5rem;
  }

  .logo-mark {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 0.5rem;
  }

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

  .logo-text {
    font-family: var(--font-display);
    font-size: 1.6rem; letter-spacing: 0.08em;
    color: var(--green);
  }

  .welcome-hero { padding: 2rem 0; }

  .welcome-eyebrow {
    font-size: 0.72rem; letter-spacing: 0.2em; text-transform: uppercase;
    color: var(--green-dim); margin-bottom: 0.75rem;
  }

  .welcome-heading {
    font-family: var(--font-display);
    font-size: 4.2rem; line-height: 0.95;
    letter-spacing: 0.02em;
    color: var(--text);
  }

  .welcome-heading span { color: var(--green); }

  .welcome-sub {
    margin-top: 1.25rem;
    font-size: 0.9rem; line-height: 1.65;
    color: var(--text-muted);
    max-width: 300px;
  }

  .stat-row {
    display: flex; gap: 1rem; margin-top: 2rem;
  }

  .stat-pill {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.6rem 1rem;
    font-size: 0.8rem; color: var(--text-muted);
  }

  .stat-pill strong { display: block; font-size: 1.1rem; font-weight: 500; color: var(--green); }

  /* BUTTONS */
  .btn-primary {
    width: 100%;
    background: var(--green);
    color: var(--black);
    border: none;
    border-radius: 10px;
    padding: 1rem 1.5rem;
    font-family: var(--font-display);
    font-size: 1.3rem;
    letter-spacing: 0.08em;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
  }

  .btn-primary:hover { opacity: 0.88; }
  .btn-primary:active { transform: scale(0.98); }
  .btn-primary:disabled { opacity: 0.35; cursor: not-allowed; }

  .btn-ghost {
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.85rem 1.5rem;
    font-family: var(--font-body);
    font-size: 0.9rem;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
    width: 100%;
  }

  .btn-ghost:hover { border-color: var(--border-bright); color: var(--text); }

  /* CONNECT SCREEN */
  .screen-header {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 2rem 0 1.5rem;
  }

  .back-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    width: 36px; height: 36px;
    display: flex; align-items: center; justify-content: center;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 1.1rem;
    transition: border-color 0.15s;
    flex-shrink: 0;
  }

  .back-btn:hover { border-color: var(--border-bright); }

  .screen-title {
    font-family: var(--font-display);
    font-size: 1.8rem; letter-spacing: 0.05em;
    color: var(--text);
  }

  .section-label {
    font-size: 0.7rem; letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--green-dim); margin-bottom: 0.6rem;
  }

  .input-field {
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.85rem 1rem;
    color: var(--text);
    font-family: var(--font-body);
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.15s;
  }

  .input-field::placeholder { color: var(--text-muted); }
  .input-field:focus { border-color: var(--border-bright); }

  .input-hint {
    font-size: 0.75rem; color: var(--text-muted);
    margin-top: 0.5rem; line-height: 1.5;
  }

  /* EXERCISE PICKER */
  .exercise-grid { display: flex; flex-direction: column; gap: 0.6rem; }

  .exercise-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1rem 1.1rem;
    display: flex; align-items: center; gap: 0.9rem;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .exercise-card:hover { border-color: var(--border-bright); }
  .exercise-card.selected { border-color: var(--green); background: rgba(127,255,0,0.06); }

  .ex-icon { font-size: 1.4rem; }
  .ex-label { font-size: 0.9rem; font-weight: 500; color: var(--text); }

  .ex-check {
    margin-left: auto;
    width: 20px; height: 20px;
    border-radius: 50%;
    border: 1.5px solid var(--border-bright);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.7rem; color: transparent;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .exercise-card.selected .ex-check {
    background: var(--green);
    border-color: var(--green);
    color: var(--black);
  }

  .connect-status {
    display: flex; align-items: center; gap: 0.5rem;
    font-size: 0.78rem;
    margin-top: 0.75rem;
  }

  .status-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--green-dim);
    flex-shrink: 0;
  }

  .status-dot.live { background: var(--green); animation: pulse 1.6s ease-in-out infinite; }
  .status-dot.error { background: var(--red); }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }

  .spacer { flex: 1; }

  /* LIVE SESSION */
  .live-screen {
    position: relative; z-index: 1;
    flex: 1; display: flex; flex-direction: column;
    background: #000;
    max-width: 420px; margin: 0 auto; width: 100%;
  }

  .cam-area {
    flex: 1;
    background: #000;
    position: relative;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
    min-height: 300px;
  }

  .cam-placeholder {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 0.75rem;
    color: var(--text-muted);
  }

  .cam-placeholder-icon {
    font-size: 3rem; opacity: 0.4;
  }

  .cam-placeholder p { font-size: 0.85rem; }

  .cam-overlay {
    position: absolute; inset: 0;
    pointer-events: none;
  }

  .cam-corner {
    position: absolute;
    width: 22px; height: 22px;
    border-color: var(--green);
    border-style: solid;
    opacity: 0.7;
  }

  .cam-corner.tl { top: 12px; left: 12px; border-width: 2px 0 0 2px; }
  .cam-corner.tr { top: 12px; right: 12px; border-width: 2px 2px 0 0; }
  .cam-corner.bl { bottom: 12px; left: 12px; border-width: 0 0 2px 2px; }
  .cam-corner.br { bottom: 12px; right: 12px; border-width: 0 2px 2px 0; }

  .live-badge {
    position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,0.7);
    border: 1px solid rgba(255,68,68,0.5);
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 0.7rem; letter-spacing: 0.14em;
    color: var(--red);
    display: flex; align-items: center; gap: 5px;
  }

  .live-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--red);
    animation: pulse 1s ease-in-out infinite;
  }

  .rep-counter {
    position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
    text-align: center;
  }

  .rep-num {
    font-family: var(--font-display);
    font-size: 5rem; line-height: 1;
    color: var(--green);
    text-shadow: 0 0 20px rgba(127,255,0,0.4);
  }

  .rep-label {
    font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase;
    color: var(--text-muted); margin-top: 2px;
  }

  .form-hint {
    position: absolute; bottom: 90px; left: 0; right: 0;
    display: flex; justify-content: center;
    padding: 0 1rem;
  }

  .hint-pill {
    background: rgba(255,68,68,0.15);
    border: 1px solid rgba(255,68,68,0.4);
    border-radius: 20px;
    padding: 5px 12px;
    font-size: 0.78rem; color: #ff8888;
    max-width: 260px; text-align: center;
    animation: fadeInUp 0.3s ease;
  }

  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .session-bar {
    background: var(--surface);
    border-top: 1px solid var(--border);
    padding: 1rem 1.5rem;
    display: flex; flex-direction: column; gap: 0.75rem;
  }

  .session-meta {
    display: flex; justify-content: space-between; align-items: center;
  }

  .session-exercise {
    font-size: 0.8rem; font-weight: 500; color: var(--text-muted);
  }

  .session-timer {
    font-family: var(--font-display);
    font-size: 1.1rem; color: var(--green); letter-spacing: 0.05em;
  }

  .finish-btn {
    background: transparent;
    border: 1.5px solid var(--green);
    border-radius: 10px;
    padding: 0.85rem;
    font-family: var(--font-display);
    font-size: 1.25rem; letter-spacing: 0.1em;
    color: var(--green);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    width: 100%;
  }

  .finish-btn:hover { background: rgba(127,255,0,0.1); }

  /* ANALYSIS */
  .analysis-wrap {
    flex: 1; display: flex; flex-direction: column;
    padding-bottom: 2rem;
    overflow-y: auto;
  }

  .score-hero {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 1.5rem;
    margin-bottom: 1rem;
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .score-hero::before {
    content: '';
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at 50% 0%, rgba(127,255,0,0.07) 0%, transparent 70%);
    pointer-events: none;
  }

  .score-label {
    font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase;
    color: var(--green-dim); margin-bottom: 0.5rem;
  }

  .score-ring-wrap {
    display: flex; align-items: center; justify-content: center;
    margin: 0.75rem 0;
  }

  .score-ring {
    position: relative; width: 110px; height: 110px;
  }

  .score-ring svg { transform: rotate(-90deg); }

  .score-center {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
  }

  .score-pct {
    font-family: var(--font-display);
    font-size: 2.2rem; line-height: 1;
    color: var(--green);
  }

  .score-pct-label {
    font-size: 0.65rem; color: var(--text-muted);
    letter-spacing: 0.12em; text-transform: uppercase;
  }

  .score-verdict {
    font-size: 0.85rem; color: var(--text-muted);
    margin-top: 0.25rem;
  }

  .score-verdict strong { color: var(--text); }

  .stats-row {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: 0.6rem; margin-bottom: 1rem;
  }

  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.75rem;
    text-align: center;
  }

  .stat-card-val {
    font-family: var(--font-display);
    font-size: 1.5rem; color: var(--text);
  }

  .stat-card-label {
    font-size: 0.68rem; color: var(--text-muted);
    text-transform: uppercase; letter-spacing: 0.12em;
    margin-top: 2px;
  }

  .section-block {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 1.1rem 1.25rem;
    margin-bottom: 1rem;
  }

  .section-block-title {
    font-size: 0.7rem; letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--green-dim); margin-bottom: 0.9rem;
  }

  .joint-row {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 0.55rem 0;
    border-bottom: 1px solid var(--border);
  }

  .joint-row:last-child { border-bottom: none; }

  .joint-name {
    font-size: 0.85rem; font-weight: 500; color: var(--text);
    flex: 1;
    text-transform: capitalize;
  }

  .joint-issue {
    font-size: 0.75rem; color: var(--text-muted);
    flex: 1;
  }

  .severity-bar-wrap {
    width: 60px; height: 5px;
    background: rgba(255,255,255,0.08);
    border-radius: 3px; overflow: hidden;
  }

  .severity-bar {
    height: 100%; border-radius: 3px;
    background: var(--red);
    transition: width 0.6s ease;
  }

  .severity-bar.ok { background: var(--green); }

  .advice-block {
    background: rgba(127,255,0,0.05);
    border: 1px solid var(--border-bright);
    border-radius: 10px;
    padding: 1rem 1.1rem;
    font-size: 0.85rem; line-height: 1.65;
    color: var(--text-muted);
    margin-bottom: 1rem;
  }

  .advice-block strong { color: var(--green); }

  .dtw-note {
    font-size: 0.72rem; color: var(--text-muted);
    text-align: center; margin-bottom: 1rem;
    opacity: 0.6;
  }

  .section-divider {
    height: 1px; background: var(--border);
    margin: 1.25rem 0;
  }

  /* AUTH SCREEN */
  .auth-wrap {
    flex: 1; display: flex; flex-direction: column;
    justify-content: space-between;
    padding: 3.5rem 0 2.5rem;
  }

  .auth-logo-block {
    display: flex; flex-direction: column;
    align-items: center; gap: 0.5rem;
    padding-top: 1rem;
  }

  .auth-logo-icon {
    width: 52px; height: 52px;
    border: 2px solid var(--green);
    border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 0.25rem;
    position: relative;
  }

  .auth-logo-icon::before {
    content: '';
    display: block; width: 18px; height: 26px;
    border-left: 2.5px solid var(--green);
    border-bottom: 2.5px solid var(--green);
    border-radius: 0 0 0 4px;
    margin-left: 5px;
  }

  .auth-logo-text {
    font-family: var(--font-display);
    font-size: 2rem; letter-spacing: 0.1em;
    color: var(--text);
  }

  .auth-logo-sub {
    font-size: 0.65rem; letter-spacing: 0.22em; text-transform: uppercase;
    color: var(--text-muted);
  }

  .auth-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 1.75rem 1.5rem;
  }

  .auth-card-title {
    font-family: var(--font-display);
    font-size: 1.9rem; letter-spacing: 0.04em;
    color: var(--text);
    margin-bottom: 0.3rem;
  }

  .auth-card-sub {
    font-size: 0.8rem; color: var(--text-muted);
    margin-bottom: 1.5rem;
  }

  .auth-field-label {
    font-size: 0.68rem; letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--green-dim); margin-bottom: 0.5rem;
    display: block;
  }

  .auth-footer-stats {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: 0; border-top: 1px solid var(--border);
    padding-top: 1.5rem;
    margin-top: 0.25rem;
  }

  .auth-stat {
    text-align: center;
    padding: 0 0.5rem;
    border-right: 1px solid var(--border);
  }

  .auth-stat:last-child { border-right: none; }

  .auth-stat-val {
    font-family: var(--font-display);
    font-size: 1.6rem; color: var(--text);
    letter-spacing: 0.04em;
  }

  .auth-stat-label {
    font-size: 0.65rem; color: var(--text-muted);
    text-transform: uppercase; letter-spacing: 0.1em;
    margin-top: 1px;
  }

  .auth-powered {
    font-size: 0.65rem; color: var(--text-muted);
    text-align: center; opacity: 0.5;
    letter-spacing: 0.06em;
  }

  .input-field.auth-input {
    font-size: 1rem; font-weight: 500;
    padding: 0.95rem 1rem;
    margin-bottom: 1rem;
    color: var(--text);
  }
`;

function AuthScreen({ onEnter }) {
  const [name, setName] = useState("");
  const trimmed = name.trim();

  function handleSubmit() {
    if (trimmed) onEnter(trimmed);
  }

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
            id="athlete-id"
            className="input-field auth-input"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            autoFocus
          />
          <button
            className="btn-primary"
            disabled={!trimmed}
            onClick={handleSubmit}
          >
            Enter Session →
          </button>
        </div>

        <div>
          <div className="auth-footer-stats">
            <div className="auth-stat">
              <div className="auth-stat-val">47</div>
              <div className="auth-stat-label">Sessions</div>
            </div>
            <div className="auth-stat">
              <div className="auth-stat-val">92%</div>
              <div className="auth-stat-label">Avg Form</div>
            </div>
            <div className="auth-stat">
              <div className="auth-stat-val">12</div>
              <div className="auth-stat-label">Day Streak</div>
            </div>
          </div>
          <div style={{ height: "1rem" }} />
          <p className="auth-powered">Powered by Social Squat Wrist AI · On-Device Inference</p>
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen({ onStart, athlete }) {
  return (
    <div className="screen">
      <div className="welcome-wrap">
        <div>
          <div className="logo-mark">
            <div className="logo-icon" />
            <span className="logo-text">KineticLife</span>
          </div>
        </div>
        <div className="welcome-hero">
          <p className="welcome-eyebrow">Welcome back, {athlete}</p>
          <h1 className="welcome-heading">
            LIFT<br />
            <span>SMARTER.</span>
          </h1>
          <p className="welcome-sub">
            Your ESP32 camera watches your form in real time. Get instant rep-by-rep feedback — no guesswork.
          </p>
          <div className="stat-row">
            <div className="stat-pill"><strong>3</strong>Exercises</div>
            <div className="stat-pill"><strong>14</strong>Joint angles</div>
            <div className="stat-pill"><strong>~9fps</strong>Live feed</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          <button className="btn-primary" onClick={onStart}>
            Start Session →
          </button>
          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textAlign: "center" }}>
            No account needed · data stays on your local network
          </p>
        </div>
      </div>
    </div>
  );
}

function ConnectScreen({ onBegin, onBack }) {
  const [camUrl, setCamUrl] = useState("http://fitcam-d37d7c.local");
  const [exercise, setExercise] = useState("squat");
  const [connStatus, setConnStatus] = useState("idle");

  function handleConnect() {
    setConnStatus("checking");
    setTimeout(() => {
      setConnStatus("live");
    }, 900);
  }

  const canStart = connStatus === "live" && exercise;

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>←</button>
        <span className="screen-title">Setup</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", flex: 1 }}>
        <div>
          <p className="section-label">Device Address</p>
          <input
            className="input-field"
            value={camUrl}
            onChange={e => { setCamUrl(e.target.value); setConnStatus("idle"); }}
            placeholder="http://fitcam-xxxxxx.local or IP"
          />
          <div className="connect-status">
            <div className={`status-dot ${connStatus === "live" ? "live" : connStatus === "error" ? "error" : ""}`} />
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              {connStatus === "idle" && "Enter mDNS address or IP from serial monitor"}
              {connStatus === "checking" && "Connecting…"}
              {connStatus === "live" && "Device found · ready to stream"}
              {connStatus === "error" && "Could not reach device — check address"}
            </span>
          </div>
          {connStatus === "idle" && (
            <button className="btn-ghost" style={{ marginTop: "0.65rem" }} onClick={handleConnect}>
              Test Connection
            </button>
          )}
        </div>
        <div>
          <p className="section-label">Exercise</p>
          <div className="exercise-grid">
            {EXERCISES.map(ex => (
              <div
                key={ex.id}
                className={`exercise-card ${exercise === ex.id ? "selected" : ""}`}
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
        <button
          className="btn-primary"
          disabled={!canStart}
          onClick={() => onBegin({ camUrl, exercise: EXERCISES.find(e => e.id === exercise) })}
        >
          Begin Set →
        </button>
      </div>
    </div>
  );
}

function LiveScreen({ config, onFinish }) {
  const [reps, setReps] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [hint, setHint] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Simulate rep counting + hints for demo
  useEffect(() => {
    const hints = [
      "Squat lower on the left",
      "Uneven leg drive",
      null, null,
      "Squat lower on the right",
    ];
    let i = 0;
    const t = setInterval(() => {
      setReps(r => r + 1);
      setHint(hints[i % hints.length]);
      i++;
      if (hint) setTimeout(() => setHint(null), 3000);
    }, 5500);
    return () => clearInterval(t);
  }, []);

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="live-screen">
      <div className="cam-area">
        {/* Actual MJPEG img tag — will display ESP32 stream if reachable */}
        <img
          ref={imgRef}
          src={`${config.camUrl}/stream`}
          alt="Camera feed"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: isReady ? "block" : "none" }}
          onLoad={() => setIsReady(true)}
          onError={() => setIsReady(false)}
        />
        {!isReady && (
          <div className="cam-placeholder">
            <div className="cam-placeholder-icon">📷</div>
            <p>Connecting to camera…</p>
            <p style={{ fontSize: "0.72rem", opacity: 0.5 }}>{config.camUrl}</p>
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
          {hint && (
            <div className="form-hint">
              <div className="hint-pill">{hint}</div>
            </div>
          )}
          <div className="rep-counter">
            <div className="rep-num">{reps}</div>
            <div className="rep-label">Reps</div>
          </div>
        </div>
      </div>
      <div className="session-bar">
        <div className="session-meta">
          <span className="session-exercise">{config.exercise.label}</span>
          <span className="session-timer">{fmt(elapsed)}</span>
        </div>
        <button className="finish-btn" onClick={() => onFinish({ reps, elapsed })}>
          FINISH SET
        </button>
      </div>
    </div>
  );
}

function AnalysisScreen({ sessionData, onReset }) {
  const accuracy = Math.round(74);
  const completeness = Math.round(MOCK_DTW.completeness * 100);
  const dtwOk = MOCK_DTW.dtw_distance <= MOCK_DTW.dtw_threshold;
  const radius = 46;
  const circ = 2 * Math.PI * radius;
  const dash = (completeness / 100) * circ;

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
            <strong>{MOCK_DTW.correct ? "Good form" : "Needs work"}</strong>
            {" · DTW distance "}
            <strong style={{ color: dtwOk ? "var(--green)" : "var(--red)" }}>
              {MOCK_DTW.dtw_distance.toFixed(2)}
            </strong>
            {" (threshold: "}{MOCK_DTW.dtw_threshold.toFixed(2)}{")"}
          </p>
        </div>

        {/* Stats row */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-card-val">{sessionData.reps}</div>
            <div className="stat-card-label">Reps</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-val">{accuracy}%</div>
            <div className="stat-card-label">Accuracy</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-val">
              {String(Math.floor(sessionData.elapsed / 60)).padStart(2, "0")}:
              {String(sessionData.elapsed % 60).padStart(2, "0")}
            </div>
            <div className="stat-card-label">Duration</div>
          </div>
        </div>

        {/* Problem joints */}
        {MOCK_DTW.problem_joints.length > 0 && (
          <div className="section-block">
            <p className="section-block-title">Problem areas</p>
            {MOCK_DTW.problem_joints.map((pj, i) => (
              <div className="joint-row" key={i}>
                <span className="joint-name">{pj.joint.replace("_", " ")}</span>
                <span className="joint-issue">{ISSUE_LABELS[pj.issue] ?? pj.issue}</span>
                <div className="severity-bar-wrap">
                  <div
                    className="severity-bar"
                    style={{ width: `${Math.round(pj.severity * 100)}%` }}
                  />
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
          {MOCK_DTW.advice}
        </div>

        <p className="dtw-note">Analysis powered by DTW + MediaPipe · data stays on local network</p>

        <button className="btn-primary" onClick={onReset}>
          New Set →
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("auth");
  const [athlete, setAthlete] = useState(null);
  const [config, setConfig] = useState(null);
  const [sessionData, setSessionData] = useState(null);

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="grid-bg" />
        <div className="scanline" />

        {screen === "auth" && (
          <AuthScreen onEnter={name => { setAthlete(name); setScreen("welcome"); }} />
        )}
        {screen === "welcome" && (
          <WelcomeScreen athlete={athlete} onStart={() => setScreen("connect")} />
        )}
        {screen === "connect" && (
          <ConnectScreen
            onBack={() => setScreen("welcome")}
            onBegin={cfg => { setConfig(cfg); setScreen("live"); }}
          />
        )}
        {screen === "live" && config && (
          <LiveScreen
            config={config}
            onFinish={data => { setSessionData(data); setScreen("analysis"); }}
          />
        )}
        {screen === "analysis" && sessionData && (
          <AnalysisScreen
            sessionData={sessionData}
            onReset={() => { setConfig(null); setSessionData(null); setScreen("connect"); }}
          />
        )}
      </div>
    </>
  );
}