/**
 * useIoTConnection — dual-link IoT transport + MediaPipe pose pipeline.
 *
 * Transport layer  : WiFi (WebSocket /ws) and/or BLE (GATT NUS-like service)
 * Inference layer  : MediaPipe PoseLandmarker VIDEO mode, ~25 fps cap
 * Exercise logic   : rep state machine, form checks, key-angle DTW buffer
 * React boundary   : frame bitmaps live in refs (zero re-renders per frame);
 *                    sensorData state is throttled to ≤ 10 updates/sec.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// Shared JS modules — paths are relative from web/src/hooks/ to web/
// @ts-ignore
import { createPoseLandmarkerRuntime } from '../../mediapipe_loader.mjs';
// @ts-ignore
import { EXERCISES, boneKey, VIS } from '../../lib/exercise-rules.js';
// @ts-ignore
import { createSmoother } from '../../lib/landmark-smoothing.js';
// @ts-ignore
import { drawSkeleton, drawAngleOnCanvas } from '../../lib/pose-renderer.js';
// @ts-ignore
import { createFeedbackEffects } from '../../lib/feedback-effects.js';

// ── Public types ────────────────────────────────────────────────────────────

export type WiFiStatus        = 'disconnected' | 'connecting' | 'connected' | 'error';
export type BLEStatus         = 'disconnected' | 'connecting' | 'connected' | 'error';
export type ConnectionStatus  = 'disconnected' | 'ble_only' | 'wifi_only' | 'dual_active';

export interface FormIssue {
  joint:    string;
  severity: number;   // 0-1
  issue:    string;   // human-readable hint text
}

export interface AnalysisResult {
  correct:        boolean;
  completeness:   number;       // 0-1
  dtw_distance:   number;
  dtw_threshold:  number;
  problem_joints: FormIssue[];
  advice:         string;
  accuracy:       number;       // 0-100
  reps:           number;
  elapsed:        number;       // seconds
  source:         'local' | 'server';
  keyAngleBuffer: number[];   // raw key-angle time series for chart
  exKey:          string;     // exercise key used for golden curve
}

export interface SensorData {
  repCount:       number;
  formScore:      number;       // 0-100
  phase:          'neutral' | 'work' | 'rest';
  hints:          string[];     // active form hints this frame
  elapsed:        number;       // seconds since session start
  mpReady:        boolean;
  analysisResult: AnalysisResult | null;
}

export interface IoTConnectionOptions {
  onAutoEnd?: () => void;       // called when rep target is reached
}

export interface IoTConnectionReturn {
  connectionStatus: ConnectionStatus;
  wifiStatus:       WiFiStatus;
  bleStatus:        BLEStatus;
  statusText:       string;
  sensorData:       SensorData;
  liveCanvasRef:    React.RefObject<HTMLCanvasElement>;
  repNumElRef:      React.MutableRefObject<HTMLElement | null>;
  connectWiFi:      (url: string) => Promise<void>;
  connectBLE:       () => Promise<void>;
  disconnectAll:    () => void;
  startSession:     (exerciseKey: string, repsTarget?: number) => void;
  stopSession:      () => void;
  sendBLECommand:   (text: string) => Promise<void>;
}

// ── API constants ───────────────────────────────────────────────────────────

const SERVER_DTW_URL = 'https://api.kineticlife.app/api/actions';

// ── BLE constants ───────────────────────────────────────────────────────────

const BLE_SERVICE_UUID = '9b8f0001-6f4d-4d4f-9c9a-4b4c49464501';
const BLE_TX_UUID      = '9b8f0002-6f4d-4d4f-9c9a-4b4c49464501';
const BLE_RX_UUID      = '9b8f0003-6f4d-4d4f-9c9a-4b4c49464501';

// ── Inference constants ─────────────────────────────────────────────────────

const ERR_DEBOUNCE  = 4;
const FPS_CAP_MS    = 40;   // ~25 fps
const THROTTLE_MS   = 100;  // max React state updates / sec from tick loop

// ── Internal session state (all refs — never trigger re-renders) ────────────

interface SessionState {
  appState:          'idle' | 'recording' | 'done';
  repCount:          number;
  repPhase:          'neutral' | 'work' | 'rest';
  hintCounts:        Record<string, number>;
  totalFrames:       number;
  errorFrames:       number;
  consecErrFrames:   number;
  displayErrSet:     Set<string>;
  keyAngleBuffer:    number[];
  jointAngleFrames:  (number | null)[][];   // [frameIdx][14 angles] for server DTW
  tsStart:           number;                // performance.now() at start
  tsEnd:             number;
  tsStartReal:       number;                // Date.now() at start (for server payload)
  tsEndReal:         number;
}

function freshSession(): SessionState {
  return {
    appState: 'idle', repCount: 0, repPhase: 'neutral',
    hintCounts: {}, totalFrames: 0, errorFrames: 0,
    consecErrFrames: 0, displayErrSet: new Set(),
    keyAngleBuffer: [], jointAngleFrames: [],
    tsStart: 0, tsEnd: 0, tsStartReal: 0, tsEndReal: 0,
  };
}

// ── 14-D joint angle helpers (contract §5) ───────────────────────────────────

// MediaPipe landmark indices
const MP = {
  LS: 11, RS: 12, LE: 13, RE: 14, LW: 15, RW: 16, LI: 19, RI: 20,
  LH: 23, RH: 24, LK: 25, RK: 26, LA: 27, RA: 28, LF: 31, RF: 32,
} as const;

function angle3pt(lm: any[], aIdx: number, bIdx: number, cIdx: number): number | null {
  const a = lm[aIdx], b = lm[bIdx], c = lm[cIdx];
  if (!a || !b || !c) return null;
  if ((a.visibility ?? 1) < 0.3 || (b.visibility ?? 1) < 0.3 || (c.visibility ?? 1) < 0.3) return null;
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const mag = Math.sqrt((v1x*v1x + v1y*v1y) * (v2x*v2x + v2y*v2y));
  if (mag < 1e-9) return null;
  return parseFloat((Math.acos(Math.max(-1, Math.min(1, (v1x*v2x + v1y*v2y) / mag))) * 180 / Math.PI).toFixed(1));
}

function compute14Angles(lm: any[]): (number | null)[] {
  if (!lm || lm.length < 33) return Array(14).fill(null);

  // idx 12: trunk lean — angle of midHip→midShoulder vs vertical (0,-1 in image coords)
  let trunkLean: number | null = null;
  const lhip = lm[MP.LH], rhip = lm[MP.RH], lsho = lm[MP.LS], rsho = lm[MP.RS];
  if (lhip && rhip && lsho && rsho) {
    const vx = (lsho.x + rsho.x) / 2 - (lhip.x + rhip.x) / 2;
    const vy = (lsho.y + rsho.y) / 2 - (lhip.y + rhip.y) / 2;
    const mag = Math.sqrt(vx*vx + vy*vy);
    if (mag > 1e-9) trunkLean = parseFloat((Math.acos(Math.max(-1, Math.min(1, -vy / mag))) * 180 / Math.PI).toFixed(1));
  }

  // idx 13: pelvis tilt — angle of L_HIP→R_HIP vs horizontal (1,0)
  let pelvisTilt: number | null = null;
  if (lhip && rhip) {
    const vx = rhip.x - lhip.x, vy = rhip.y - lhip.y;
    const mag = Math.sqrt(vx*vx + vy*vy);
    if (mag > 1e-9) pelvisTilt = parseFloat((Math.acos(Math.max(-1, Math.min(1, vx / mag))) * 180 / Math.PI).toFixed(1));
  }

  const a = angle3pt;
  return [
    a(lm, MP.LH, MP.LK, MP.LA),   // 0  left_knee
    a(lm, MP.RH, MP.RK, MP.RA),   // 1  right_knee
    a(lm, MP.LS, MP.LE, MP.LW),   // 2  left_elbow
    a(lm, MP.RS, MP.RE, MP.RW),   // 3  right_elbow
    a(lm, MP.LS, MP.LH, MP.LK),   // 4  left_hip
    a(lm, MP.RS, MP.RH, MP.RK),   // 5  right_hip
    a(lm, MP.LH, MP.LS, MP.LE),   // 6  left_shoulder
    a(lm, MP.RH, MP.RS, MP.RE),   // 7  right_shoulder
    a(lm, MP.LK, MP.LA, MP.LF),   // 8  left_ankle
    a(lm, MP.RK, MP.RA, MP.RF),   // 9  right_ankle
    a(lm, MP.LE, MP.LW, MP.LI),   // 10 left_wrist
    a(lm, MP.RE, MP.RW, MP.RI),   // 11 right_wrist
    trunkLean,                      // 12 trunk_lean
    pelvisTilt,                     // 13 pelvis_tilt
  ];
}

function makeSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

async function submitServerDTW(
  frames:      (number | null)[][],
  exerciseKey: string,
  sessionId:   string,
  tsStartMs:   number,
  tsEndMs:     number,
): Promise<any> {
  if (frames.length < 4) throw new Error('too few frames');
  const body = {
    v:             1,
    type:          'client.action_submit',
    session_id:    sessionId,
    action_id:     `act-${Date.now()}`,
    exercise_hint: exerciseKey,
    ts_start_ms:   tsStartMs,
    ts_end_ms:     tsEndMs,
    frames: frames.map((ja, i) => ({
      frame_id:     i,
      ts_ms:        Math.round(tsStartMs + i / (frames.length - 1) * (tsEndMs - tsStartMs)),
      joint_angles: ja,
    })),
  };
  const resp = await fetch(SERVER_DTW_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(8000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

// ── DTW helpers ─────────────────────────────────────────────────────────────

const EX_ANGLE_RANGE: Record<string, { restVal: number; workVal: number }> = {
  squat:         { restVal: 165, workVal: 95 },
  bicep_curl:    { restVal: 160, workVal: 40 },
  lateral_raise: { restVal: 18,  workVal: 78 },
};

function buildGolden(exKey: string, n: number): number[] {
  const r = EX_ANGLE_RANGE[exKey] ?? EX_ANGLE_RANGE.squat;
  const reps = Math.max(1, Math.round(n / 30));
  return Array.from({ length: n }, (_, i) => {
    const frac = 0.5 - 0.5 * Math.cos((i / n) * reps * 2 * Math.PI);
    return r.restVal + (r.workVal - r.restVal) * frac;
  });
}

function computeLocalDTW(buf: number[], exKey: string): number {
  const N = 60;
  if (buf.length < 4) return 3.5;
  const user   = Array.from({ length: N }, (_, i) =>
    buf[Math.round(i / (N - 1) * (buf.length - 1))]);
  const golden = buildGolden(exKey, N);
  const total  = user.reduce((s, v, i) => s + Math.abs(v - golden[i]), 0);
  return parseFloat((total / N / 10).toFixed(2));
}

function generateAdvice(issues: FormIssue[]): string {
  if (issues.length === 0) return 'Excellent form! Consistent technique across all reps.';
  const adviceMap: Record<string, string> = {
    'Squat lower on the left':  'Push your left knee out and drive through the left heel.',
    'Squat lower on the right': 'Push your right knee out and drive through the right heel.',
    'Uneven leg drive':         'Pause at the bottom — consciously balance weight before ascending.',
    'Keep elbow tight':         'Tuck the elbow into your side; avoid swinging the shoulder.',
    'Full range of motion':     'Extend fully at the bottom; squeeze at the top of each curl.',
    'Raise to shoulder height': 'Lead with the pinky; raise until upper arm is parallel to floor.',
    'Control the descent':      'Slow the lowering phase — 2 counts up, 3 counts down.',
  };
  return adviceMap[issues[0].issue]
    ?? `Focus on "${issues[0].issue}". Slow the movement for better control.`;
}

// ── Default sensor data ─────────────────────────────────────────────────────

const INITIAL_SENSOR: SensorData = {
  repCount: 0, formScore: 100, phase: 'neutral',
  hints: [], elapsed: 0, mpReady: false, analysisResult: null,
};

// ── Hook ────────────────────────────────────────────────────────────────────

export function useIoTConnection(
  options: IoTConnectionOptions = {},
): IoTConnectionReturn {

  // ── React state (minimal — re-renders only on connection changes) ─────
  const [wifiStatus, setWifiStatus] = useState<WiFiStatus>('disconnected');
  const [bleStatus,  setBleStatus]  = useState<BLEStatus>('disconnected');
  const [sensorData, setSensorData] = useState<SensorData>(INITIAL_SENSOR);

  // ── Transport refs (frame pipeline — zero React re-renders) ───────────
  const frameRef          = useRef<ImageBitmap | null>(null);
  const wsRef             = useRef<WebSocket | null>(null);
  const wsUrlRef          = useRef('');
  const wsRetryRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const decodePendingRef  = useRef(false);
  const pendingDataRef    = useRef<ArrayBuffer | null>(null);
  const bleDeviceRef      = useRef<BluetoothDevice | null>(null);
  const bleRxRef          = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const bleFrameRef       = useRef({
    expected: 0, received: 0, chunks: [] as Uint8Array<ArrayBuffer>[], id: 0,
  });

  // ── Pose pipeline refs ────────────────────────────────────────────────
  const landmarkerRef     = useRef<any>(null);
  const smootherRef       = useRef(createSmoother(0.45, VIS));
  const sessionRef        = useRef<SessionState>(freshSession());
  const exerciseKeyRef    = useRef('squat');
  const repsTargetRef     = useRef(3);
  const lastTsRef         = useRef(-1);
  const rAFRef            = useRef(0);
  const throttleTsRef     = useRef(0);
  const vidTransformRef   = useRef({ dx: 0, dy: 0, dw: 640, dh: 480 });

  // Inference canvas — lazy-initialized on first tick (avoids SSR issues)
  const inferCanvasRef    = useRef<HTMLCanvasElement | null>(null);
  const inferCtxRef       = useRef<CanvasRenderingContext2D | null>(null);

  // Live canvas ref returned to component (<canvas ref={liveCanvasRef} />)
  const liveCanvasRef     = useRef<HTMLCanvasElement>(null);

  // Session identity — new UUID per startSession call
  const sessionIdRef      = useRef(makeSessionId());

  // Visual feedback effects — wired to the rep-counter DOM element
  const repNumElRef       = useRef<HTMLElement | null>(null);
  const fxRef             = useRef<any>(null);

  // Last known smoothed landmarks — shared between 60fps render and capped inference
  const displayLmRef      = useRef<any[] | null>(null);

  // Keep onAutoEnd current without adding it to any dep array
  const onAutoEndRef      = useRef(options.onAutoEnd);
  onAutoEndRef.current    = options.onAutoEnd;

  // ── Derived: connection status ────────────────────────────────────────
  const connectionStatus = useMemo<ConnectionStatus>(() => {
    const w = wifiStatus === 'connected';
    const b = bleStatus  === 'connected';
    if (w && b) return 'dual_active';
    if (w)      return 'wifi_only';
    if (b)      return 'ble_only';
    return 'disconnected';
  }, [wifiStatus, bleStatus]);

  const statusText = useMemo(() => {
    switch (connectionStatus) {
      case 'dual_active': return 'WiFi + BLE active';
      case 'wifi_only':   return 'WiFi · live';
      case 'ble_only':    return 'BLE · live';
      default:
        if (wifiStatus === 'connecting' || bleStatus === 'connecting') return 'Connecting…';
        if (wifiStatus === 'error')   return 'WiFi error — check address';
        if (bleStatus  === 'error')   return 'BLE error — try again';
        return 'No device connected';
    }
  }, [connectionStatus, wifiStatus, bleStatus]);

  // ── Throttled sensor update (max 10 React re-renders / sec) ──────────
  function pushSensor(patch: Partial<SensorData>) {
    const now = performance.now();
    if (now - throttleTsRef.current < THROTTLE_MS) return;
    throttleTsRef.current = now;
    setSensorData(prev => ({ ...prev, ...patch }));
  }

  // ── WiFi / WebSocket ──────────────────────────────────────────────────
  function startDecode(data: ArrayBuffer) {
    decodePendingRef.current = true;
    pendingDataRef.current   = null;
    createImageBitmap(new Blob([data], { type: 'image/jpeg' })).then(bmp => {
      frameRef.current?.close();
      frameRef.current         = bmp;
      decodePendingRef.current = false;
      if (pendingDataRef.current) startDecode(pendingDataRef.current);
    });
  }

  function openWs(url: string) {
    const base   = url.replace(/\/+$/, '');
    const wsUrl  = base.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://') + '/ws';
    const sock   = new WebSocket(wsUrl);
    wsRef.current = sock;
    sock.binaryType = 'arraybuffer';
    sock.onopen    = () => setWifiStatus('connected');
    sock.onmessage = ({ data }) => {
      if (decodePendingRef.current) { pendingDataRef.current = data; return; }
      startDecode(data);
    };
    sock.onclose   = () => {
      if (wsRef.current !== sock) return;
      wsRef.current = null;
      setWifiStatus('disconnected');
      wsRetryRef.current = setTimeout(() => openWs(wsUrlRef.current), 2000);
    };
    sock.onerror   = () => setWifiStatus('error');
  }

  const connectWiFi = useCallback(async (url: string) => {
    wsRef.current?.close();
    if (wsRetryRef.current) { clearTimeout(wsRetryRef.current); wsRetryRef.current = null; }
    wsUrlRef.current = url;
    setWifiStatus('connecting');
    const base = /^https?:\/\//i.test(url) ? url : `http://${url}`;
    // Apply camera defaults — non-fatal if device not yet reachable
    await fetch(
      `${base.replace(/\/+$/, '')}/cam?res=320x240&q=12&brightness=0&contrast=1&saturation=0&sharpness=1&ae_level=0&vflip=0&hmirror=0`,
      { signal: AbortSignal.timeout(3000) },
    ).catch(() => {});
    openWs(url);
  }, []);

  // ── BLE ───────────────────────────────────────────────────────────────
  function handleBLEPacket(bytes: Uint8Array) {
    const bf = bleFrameRef.current;
    // Header: ASCII "CAM:"
    if (bytes[0] === 67 && bytes[1] === 65 && bytes[2] === 77 && bytes[3] === 58) {
      const parts   = new TextDecoder().decode(bytes).split(':');
      bf.expected   = Number(parts[2]) || 0;
      bf.received   = 0;
      bf.chunks     = [];
      bf.id         = Number(parts[1]) || 0;
      return;
    }
    if (!bf.expected) return;
    const needed = bf.expected - bf.received;
    const chunk  = (bytes.length > needed ? bytes.slice(0, needed) : bytes.slice()) as Uint8Array<ArrayBuffer>;
    bf.chunks.push(chunk);
    bf.received += chunk.byteLength;
    if (bf.received < bf.expected) return;

    const blob = new Blob(bf.chunks as BlobPart[], { type: 'image/jpeg' });
    createImageBitmap(blob).then(bmp => {
      frameRef.current?.close();
      frameRef.current = bmp;
    }).catch(() => {});
    bf.expected = 0; bf.received = 0; bf.chunks = [];
  }

  const sendBLECommand = useCallback(async (text: string) => {
    const rx = bleRxRef.current;
    if (!rx) return;
    const data = new TextEncoder().encode(text);
    await ((rx as any).writeValueWithoutResponse
      ? (rx as any).writeValueWithoutResponse(data)
      : rx.writeValue(data));
  }, []);

  const connectBLE = useCallback(async () => {
    if (!navigator.bluetooth) throw new Error('Web Bluetooth unavailable');
    setBleStatus('connecting');
    try {
      const device = await (navigator.bluetooth as any).requestDevice({
        filters: [{ namePrefix: 'KineticLife-BLE' }],
        optionalServices: [BLE_SERVICE_UUID],
      });
      bleDeviceRef.current = device;
      device.addEventListener('gattserverdisconnected', () => {
        bleRxRef.current = null;
        setBleStatus('disconnected');
      });
      const server  = await device.gatt.connect();
      const service = await server.getPrimaryService(BLE_SERVICE_UUID);
      const tx      = await service.getCharacteristic(BLE_TX_UUID);
      bleRxRef.current = await service.getCharacteristic(BLE_RX_UUID);
      await tx.startNotifications();
      tx.addEventListener('characteristicvaluechanged', (evt: Event) => {
        const v = (evt.target as any).value as DataView;
        handleBLEPacket(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
      });
      setBleStatus('connected');
      await sendBLECommand('size=180');
      await sendBLECommand('gap=12');
      await sendBLECommand('cam=0');
    } catch (e) {
      setBleStatus('error');
      throw e;
    }
  }, [sendBLECommand]);

  // ── Session control ───────────────────────────────────────────────────
  const startSession = useCallback((exerciseKey: string, repsTarget = 3) => {
    exerciseKeyRef.current = exerciseKey;
    repsTargetRef.current  = repsTarget;
    sessionIdRef.current   = makeSessionId();
    const ss               = freshSession();
    ss.appState            = 'recording';
    ss.tsStart             = performance.now();
    ss.tsStartReal         = Date.now();
    sessionRef.current     = ss;
    smootherRef.current.reset();
    throttleTsRef.current  = 0;
    setSensorData({ ...INITIAL_SENSOR, mpReady: landmarkerRef.current !== null });

    // Restart BLE camera stream — stopSession sends 'stop', so every new
    // session must re-arm the camera explicitly.
    sendBLECommand('cam=0').catch(() => {});

    // (Re)create feedback effects bound to the current rep counter element
    fxRef.current = createFeedbackEffects({ repNumEl: repNumElRef.current });
    fxRef.current.reset();

    if (!landmarkerRef.current) {
      createPoseLandmarkerRuntime()
        .then((r: any) => {
          landmarkerRef.current = r.landmarker;
          setSensorData(prev => ({ ...prev, mpReady: true }));
        })
        .catch((e: Error) => console.error('[IoT] MediaPipe load failed:', e));
    }
  }, [sendBLECommand]);

  // stopSession is defined as a plain closure (not useCallback) so that
  // it can be called safely from the RAF loop (stale-closure safe via refs).
  function stopSessionInternal() {
    const ss = sessionRef.current;
    // Allow stopping from 'done' too (auto-end sets appState='done' before calling this).
    // Guard against: never-started ('idle') and already-stopped (tsEnd > 0).
    if (ss.appState === 'idle' || ss.tsEnd > 0) return;
    ss.tsEnd     = performance.now();
    ss.tsEndReal = Date.now();
    ss.appState  = 'done';

    sendBLECommand('stop').catch(() => {});

    const accuracy       = ss.totalFrames > 0
      ? Math.round((1 - ss.errorFrames / ss.totalFrames) * 100) : 100;
    const elapsed        = Math.round((ss.tsEnd - ss.tsStart) / 1000);
    const sorted         = Object.entries(ss.hintCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 3);
    const dtw_threshold  = 3.0;
    const dtw_distance   = computeLocalDTW(ss.keyAngleBuffer, exerciseKeyRef.current);
    const problem_joints: FormIssue[] = sorted.map(([hint, cnt]) => ({
      joint:    hint.toLowerCase().replace(/\s+/g, '_'),
      severity: parseFloat((cnt / Math.max(1, ss.totalFrames)).toFixed(2)),
      issue:    hint,
    }));

    // Show local result immediately — never block the UI on network
    const localResult: AnalysisResult = {
      correct:       dtw_distance <= dtw_threshold,
      completeness:  Math.min(1, ss.repCount / repsTargetRef.current),
      dtw_distance,
      dtw_threshold,
      problem_joints,
      advice:        generateAdvice(problem_joints),
      accuracy,
      reps:          ss.repCount,
      elapsed,
      source:        'local',
      keyAngleBuffer: ss.keyAngleBuffer.slice(),
      exKey:          exerciseKeyRef.current,
    };
    setSensorData(prev => ({ ...prev, analysisResult: localResult }));

    // Async: submit to server DTW; merge result if successful
    const frames      = ss.jointAngleFrames.slice();
    const sessionId   = sessionIdRef.current;
    const tsStartMs   = ss.tsStartReal;
    const tsEndMs     = ss.tsEndReal;
    const exKey       = exerciseKeyRef.current;
    submitServerDTW(frames, exKey, sessionId, tsStartMs, tsEndMs)
      .then((srv: any) => {
        const serverIssues: FormIssue[] = (srv.problem_joints ?? []).map((pj: any) => ({
          joint:    pj.joint    ?? '',
          severity: pj.severity ?? 0,
          issue:    pj.issue    ?? pj.joint ?? '',
        }));
        setSensorData(prev => {
          if (!prev.analysisResult) return prev;
          return {
            ...prev,
            analysisResult: {
              ...prev.analysisResult,
              correct:        srv.correct       ?? prev.analysisResult.correct,
              completeness:   srv.completeness  ?? prev.analysisResult.completeness,
              dtw_distance:   srv.dtw_distance  ?? prev.analysisResult.dtw_distance,
              dtw_threshold:  srv.dtw_threshold ?? prev.analysisResult.dtw_threshold,
              problem_joints: serverIssues.length > 0 ? serverIssues : prev.analysisResult.problem_joints,
              advice:         generateAdvice(serverIssues.length > 0 ? serverIssues : prev.analysisResult.problem_joints),
              source:         'server',
            },
          };
        });
      })
      .catch(() => { /* server unavailable — keep local result */ });
  }

  // Public wrapper — stable reference for component use
  const stopSession = useCallback(() => stopSessionInternal(), []); // eslint-disable-line

  // ── Disconnect all ────────────────────────────────────────────────────
  const disconnectAll = useCallback(() => {
    wsRef.current?.close(); wsRef.current = null;
    if (wsRetryRef.current) { clearTimeout(wsRetryRef.current); wsRetryRef.current = null; }
    (bleDeviceRef.current as any)?.gatt?.disconnect();
    bleRxRef.current = null;
    frameRef.current?.close(); frameRef.current = null;
    sessionRef.current.appState = 'idle';
    fxRef.current?.reset();
    setWifiStatus('disconnected');
    setBleStatus('disconnected');
  }, []);

  // ── Exercise state machine ────────────────────────────────────────────
  function updateSM(angle: number, ex: any) {
    const ss = sessionRef.current;
    if (ex.restCond(angle)) {
      if (ss.repPhase === 'work') {
        ss.repCount++;
        if (ss.repCount >= repsTargetRef.current) {
          ss.appState = 'done';
          // Give the UI one final throttled update before stopping
          setTimeout(() => {
            stopSessionInternal();
            onAutoEndRef.current?.();
          }, 700);
        }
      }
      ss.repPhase = 'rest';
    } else if (ex.workCond(angle)) {
      ss.repPhase = 'work';
    }
  }

  // ── Main RAF tick — render at 60fps, MediaPipe inference capped ────────
  function tick(now: number) {
    rAFRef.current = requestAnimationFrame(tick);

    const canvas = liveCanvasRef.current;
    const ss     = sessionRef.current;
    if (!canvas) return;

    // Size drawing buffer to match the canvas element's actual layout pixels.
    // Using window dimensions would create a mismatch with the cam-area container.
    const cw = canvas.offsetWidth  || window.innerWidth;
    const ch = canvas.offsetHeight || window.innerHeight;
    if (canvas.width  !== cw) canvas.width  = cw;
    if (canvas.height !== ch) canvas.height = ch;

    if (ss.appState !== 'recording') return;

    const W   = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d')!;

    // Portrait virtual dims — HQVGA rotated 90° CW (176×240)
    const vw = 176, vh = 240;
    const scale = Math.max(W / vw, H / vh);
    const dw = vw * scale, dh = vh * scale;
    const dx = (W - dw) / 2, dy = (H - dh) / 2;
    vidTransformRef.current = { dx, dy, dw, dh };

    // ── Render phase (60 fps) — always draw last known pose ──────────────
    ctx.fillStyle = 'rgba(5,9,5,0.12)';   // lower alpha = longer trail = smoother
    ctx.fillRect(0, 0, W, H);

    const lm = displayLmRef.current;
    if (lm) {
      const ex = (EXERCISES as Record<string, any>)[exerciseKeyRef.current];
      if (ex) {
        drawSkeleton(ctx, vidTransformRef.current, lm, ss.displayErrSet);
        drawAngleOnCanvas(ctx, vidTransformRef.current, lm, ex);
        fxRef.current?.draw(ctx, now, vidTransformRef.current, lm, ss.displayErrSet);
      }
    }

    // ── Inference phase (capped at FPS_CAP_MS ~25 fps) ───────────────────
    if (!landmarkerRef.current || !frameRef.current) return;
    if (now - lastTsRef.current < FPS_CAP_MS) return;
    lastTsRef.current = now;

    // Lazy-init portrait inference canvas (176×240 — HQVGA rotated 90° CW)
    if (!inferCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = 176; c.height = 240;
      inferCanvasRef.current = c;
      inferCtxRef.current    = c.getContext('2d');
    }
    const inferCanvas = inferCanvasRef.current;
    const inferCtx    = inferCtxRef.current!;

    // Rotate BLE landscape frame (240×176) 90° CW → portrait (176×240)
    inferCtx.save();
    inferCtx.translate(inferCanvas.width, 0);
    inferCtx.rotate(Math.PI / 2);
    inferCtx.drawImage(frameRef.current, 0, 0, inferCanvas.height, inferCanvas.width);
    inferCtx.restore();

    const result = landmarkerRef.current.detectForVideo(inferCanvas, now);
    if (!result.landmarks.length) return;

    const rawLm     = result.landmarks[0];
    const displayLm = smootherRef.current.smooth(rawLm);
    displayLmRef.current = displayLm;

    const ex = (EXERCISES as Record<string, any>)[exerciseKeyRef.current];
    if (!ex) return;
    const keyAngle = ex.getKeyAngle(rawLm);

    ss.totalFrames++;
    if (ss.totalFrames % 2 === 0) {
      ss.keyAngleBuffer.push(keyAngle);
      ss.jointAngleFrames.push(compute14Angles(rawLm));
    }

    const repBefore = ss.repCount;
    updateSM(keyAngle, ex);
    if (ss.repCount > repBefore && fxRef.current) {
      fxRef.current.onRepCounted({
        repCount:     ss.repCount,
        lm:           displayLm,
        vidTransform: vidTransformRef.current,
        now,
      });
    }

    // Form checks
    const errorBoneSet = new Set<string>();
    let frameHasErr    = false;
    for (const check of ex.checks) {
      if (!check.valid(check.getVal(rawLm), ss.repPhase)) {
        check.bones.forEach(([a, b]: [number, number]) => errorBoneSet.add(boneKey(a, b)));
        ss.hintCounts[check.hint] = (ss.hintCounts[check.hint] ?? 0) + 1;
        frameHasErr = true;
      }
    }
    if (frameHasErr) {
      ss.errorFrames++;
      ss.consecErrFrames = Math.min(ss.consecErrFrames + 1, ERR_DEBOUNCE);
    } else {
      ss.consecErrFrames = Math.max(ss.consecErrFrames - 1, 0);
    }
    if (ss.consecErrFrames >= ERR_DEBOUNCE) ss.displayErrSet = errorBoneSet;
    else if (ss.consecErrFrames === 0)       ss.displayErrSet = new Set();

    // Collect active hints
    const activeHints: string[] = ss.consecErrFrames >= ERR_DEBOUNCE
      ? ex.checks
          .filter((check: any) =>
            [...ss.displayErrSet].some((k: string) =>
              check.bones.some(([a, b]: [number, number]) => k === boneKey(a, b))))
          .map((check: any) => check.hint as string)
      : [];

    // Throttled React state update (≤ 10/sec)
    pushSensor({
      repCount:  ss.repCount,
      formScore: ss.totalFrames > 0
        ? Math.round((1 - ss.errorFrames / ss.totalFrames) * 100) : 100,
      phase:   ss.repPhase,
      hints:   activeHints,
      elapsed: Math.round((now - ss.tsStart) / 1000),
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Pre-load MediaPipe in background so first session starts fast
    createPoseLandmarkerRuntime()
      .then((r: any) => {
        landmarkerRef.current = r.landmarker;
        setSensorData(prev => ({ ...prev, mpReady: true }));
      })
      .catch(() => { /* non-fatal — will retry in startSession */ });

    rAFRef.current = requestAnimationFrame(tick);

    return () => {
      // Strict Mode safe: cancel RAF and close connections on unmount
      cancelAnimationFrame(rAFRef.current);
      wsRef.current?.close(); wsRef.current = null;
      if (wsRetryRef.current) clearTimeout(wsRetryRef.current);
      (bleDeviceRef.current as any)?.gatt?.disconnect();
      bleRxRef.current = null;
      frameRef.current?.close(); frameRef.current = null;
      // Intentionally skip landmarker.close() on hot-reload to avoid
      // the expensive WASM reinitialisation on every file save.
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    connectionStatus,
    wifiStatus,
    bleStatus,
    statusText,
    sensorData,
    liveCanvasRef,
    repNumElRef,
    connectWiFi,
    connectBLE,
    disconnectAll,
    startSession,
    stopSession,
    sendBLECommand,
  };
}
