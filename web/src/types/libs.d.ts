// ── Web Bluetooth API (not included in TypeScript's DOM lib by default) ─────

interface BluetoothRemoteGATTCharacteristic {
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithoutResponse?(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  value?: DataView;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTServer {
  connect(): Promise<BluetoothRemoteGATTServer>;
  getPrimaryService(uuid: string): Promise<BluetoothRemoteGATTService>;
  disconnect(): void;
}

interface BluetoothDevice extends EventTarget {
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  addEventListener(type: 'gattserverdisconnected', listener: (ev: Event) => void): void;
}

interface Bluetooth {
  requestDevice(options: { filters: Array<{ namePrefix?: string }>; optionalServices?: string[] }): Promise<BluetoothDevice>;
}

interface Navigator {
  bluetooth: Bluetooth;
}

// Ambient declarations for shared JS modules outside src/.
// These files live in web/lib/ and web/ root — Vite bundles them fine,
// but tsc needs declarations to avoid "cannot find module" errors.

declare module '*mediapipe_loader.mjs' {
  export function createPoseLandmarkerRuntime(options?: {
    delegates?: string[];
    runningMode?: string;
    numPoses?: number;
  }): Promise<{
    landmarker: {
      detectForVideo(source: HTMLCanvasElement, timestampMs: number): {
        landmarks: Array<Array<{ x: number; y: number; z: number; visibility: number }>>;
      };
      close(): void;
    };
    source: string;
    delegate: string;
  }>;
}

declare module '*exercise-rules.js' {
  export const VIS: number;
  export const EXERCISES: Record<string, {
    label: string;
    getKeyAngle(lm: any[]): number;
    restCond(angle: number): boolean;
    workCond(angle: number): boolean;
    phaseLabel: Record<string, string>;
    checks: Array<{
      id: string;
      getVal(lm: any[]): number;
      valid(v: number, phase?: string): boolean;
      hint: string;
      bones: [number, number][];
    }>;
    displayAngles: Array<{ label: string; fn(lm: any[]): number; joint: number }>;
  }>;
  export function calcAngle(a: any, b: any, c: any): number;
  export function boneKey(a: number, b: number): string;
  export function visible(lm: any[], ...idxs: number[]): boolean;
}

declare module '*landmark-smoothing.js' {
  export function createSmoother(
    alpha: number,
    visThreshold: number,
  ): {
    smooth(raw: any[]): any[];
    reset(): void;
  };
}

declare module '*pose-renderer.js' {
  export function drawSkeleton(
    ctx: CanvasRenderingContext2D,
    vidTransform: { dx: number; dy: number; dw: number; dh: number },
    lm: any[],
    errorBoneSet: Set<string>,
  ): void;
  export function drawAngleOnCanvas(
    ctx: CanvasRenderingContext2D,
    vidTransform: { dx: number; dy: number; dw: number; dh: number },
    lm: any[],
    ex: any,
  ): void;
}
