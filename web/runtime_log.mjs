const seen = new Set();
const lastLogAt = new Map();

export function logOnce(key, message, data) {
  if (seen.has(key)) return;
  seen.add(key);
  if (data === undefined) console.info(message);
  else console.info(message, data);
}

export function logRateLimited(key, message, data, intervalMs = 10000) {
  const now = performance.now();
  const last = lastLogAt.get(key);
  if (last !== undefined && now - last < intervalMs) return;
  lastLogAt.set(key, now);
  if (data === undefined) console.info(message);
  else console.info(message, data);
}

export function logPageBoot(page, details = {}) {
  logOnce(`boot:${page}`, `[kl] ${page} boot`, {
    pageUrl: location.href,
    pageOrigin: location.origin,
    userAgent: navigator.userAgent,
    online: navigator.onLine,
    mediaPipeMode: new URLSearchParams(location.search).get("mp") || "auto",
    ...details,
  });
}

export function logMediaPipeRuntime(runtime) {
  logOnce("mediapipe:runtime", "[kl] mediapipe ready", {
    source: runtime.source,
    delegate: runtime.delegate,
    modelAssetPath: runtime.modelAssetPath,
    failedSources: runtime.failedSources || [],
  });
}

export function logWsEvent(event, data = {}) {
  const level = event === "error" || event === "close" ? console.warn : console.info;
  const key = `ws:${event}:${data.url || ""}`;
  const now = performance.now();
  const last = lastLogAt.get(key);
  if (last !== undefined && now - last < 10000) return;
  lastLogAt.set(key, now);
  level(`[kl] ws ${event}`, data);
}

export async function probeDevice(baseUrl, label = "device") {
  if (!baseUrl) return;
  const base = baseUrl.replace(/\/+$/, "");
  const key = `probe:${label}:${base}`;
  if (seen.has(key)) return;
  seen.add(key);

  const requestJson = async (path) => {
    const res = await fetch(`${base}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
    return res.json();
  };

  try {
    const [hello, status] = await Promise.all([
      requestJson("/hello"),
      requestJson("/status"),
    ]);
    console.info(`[kl] ${label} probe`, {
      baseUrl: base,
      deviceIp: status.ip,
      deviceId: status.device_id || hello.device_id,
      firmware: status.fw_version || hello.fw_version,
      state: status.state || hello.state,
      wsClients: status.ws_clients ?? hello.ws_clients,
      rssiDbm: status.rssi_dbm,
      wifiQuality: status.wifi_quality,
      frameSize: status.frame_size,
      jpegQuality: status.jpeg_quality,
      freeHeapKb: status.free_heap_kb,
      freePsramKb: status.free_psram_kb || hello.free_psram_kb,
    });
  } catch (error) {
    console.warn(`[kl] ${label} probe failed`, {
      baseUrl: base,
      error: error.message,
    });
  }
}
