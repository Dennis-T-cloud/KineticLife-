/**
 * camera-stream.worker.js — WebSocket camera stream, isolated from the React main thread.
 *
 * Moving the WS connection here means TCP buffer draining happens on a worker thread.
 * React re-renders and framer-motion animations on the main thread can no longer stall
 * the TCP receive path, eliminating the backpressure that was causing ESP32 frame drops.
 *
 * The /cam HTTP config request is also sent from this worker so camera setup never
 * depends on the main thread being available.
 *
 * Protocol:
 *   main → worker : { type: 'connect', wsUrl: string, camConfigUrl: string }
 *   main → worker : { type: 'disconnect' }
 *   worker → main : { type: 'open' }
 *   worker → main : { type: 'frame', buffer: ArrayBuffer }   ← transferable, zero-copy
 *   worker → main : { type: 'retry', count: number }
 *   worker → main : { type: 'no_frame' }
 *   worker → main : { type: 'error' }
 *   worker → main : { type: 'close', code, clean, reason }
 */

let ws = null;
let frameTimeoutId = null;
let retryCount = 0;
let currentWsUrl = null;
let currentCamConfigUrl = null;
let firstFrameReceived = false;

function sendCamConfig() {
  if (!currentCamConfigUrl) return;
  fetch(currentCamConfigUrl, { signal: AbortSignal.timeout(5000) }).catch(() => {});
}

function connect(url) {
  currentWsUrl = url;
  firstFrameReceived = false;

  if (ws) {
    ws.onmessage = ws.onerror = ws.onclose = null;
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
    ws = null;
  }

  ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';

  // If no frame arrives within 25 s → retry (up to 2 times).
  // Extended from 10s to give ESP32 time to recover after a previous session.
  clearTimeout(frameTimeoutId);
  frameTimeoutId = setTimeout(() => {
    if (firstFrameReceived) return;
    retryCount++;
    if (retryCount <= 2) {
      self.postMessage({ type: 'retry', count: retryCount });
      disconnect();
      setTimeout(() => connect(currentWsUrl), 800);
    } else {
      self.postMessage({ type: 'no_frame' });
    }
  }, 25000);

  ws.onopen = () => {
    // Send cam config from inside the worker — no main-thread round-trip needed.
    sendCamConfig();
    self.postMessage({ type: 'open' });
  };

  ws.onmessage = ({ data }) => {
    if (!firstFrameReceived) {
      firstFrameReceived = true;
      clearTimeout(frameTimeoutId);
      retryCount = 0;
    }
    if (data instanceof ArrayBuffer && data.byteLength > 0) {
      // Transfer ownership (zero-copy) — buffer is neutered in this worker after postMessage
      self.postMessage({ type: 'frame', buffer: data }, [data]);
    }
  };

  ws.onerror = () => {
    self.postMessage({ type: 'error' });
  };

  ws.onclose = (ev) => {
    clearTimeout(frameTimeoutId);
    self.postMessage({ type: 'close', code: ev.code, clean: ev.wasClean, reason: ev.reason || '' });
    // Auto-reconnect after 2s — handles stale_evict (code=1000) and network drops (code=1006).
    // Safe: intentional disconnects null out this handler before close(), so they never reach here.
    if (currentWsUrl) {
      firstFrameReceived = false;
      retryCount = 0;
      setTimeout(() => { if (currentWsUrl) connect(currentWsUrl); }, 2000);
    }
  };
}

function disconnect() {
  clearTimeout(frameTimeoutId);
  frameTimeoutId = null;
  if (ws) {
    ws.onmessage = ws.onerror = ws.onclose = null;
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
    ws = null;
  }
}

self.onmessage = ({ data }) => {
  if (data.type === 'connect') {
    retryCount = 0;
    currentCamConfigUrl = data.camConfigUrl || null;
    connect(data.wsUrl);
  } else if (data.type === 'disconnect') {
    disconnect();
  }
};
