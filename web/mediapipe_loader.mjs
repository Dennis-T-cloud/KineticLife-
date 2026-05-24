const REMOTE_SOURCE = {
    name: "remote",
    bundle: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs",
    wasm: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
    model: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
};

const LOCAL_SOURCE = {
    name: "local",
    bundle: "./vendor/mediapipe/tasks-vision@0.10.14/vision_bundle.mjs",
    wasm: "./vendor/mediapipe/tasks-vision@0.10.14/wasm",
    model: "./vendor/mediapipe/models/pose_landmarker_lite.task",
};

function sourcePreference() {
  const params = new URLSearchParams(globalThis.location?.search || "");
  const requested = params.get("mp") || globalThis.localStorage?.getItem("kineticlife.mediapipeSource") || "auto";
  if (requested === "local") return [LOCAL_SOURCE];
  if (requested === "remote") return [REMOTE_SOURCE];
  return [REMOTE_SOURCE, LOCAL_SOURCE];
}

export async function createPoseLandmarkerRuntime(options = {}) {
  const delegates = options.delegates || ["GPU", "CPU"];
  const runningMode = options.runningMode || "VIDEO";
  const numPoses = options.numPoses || 1;
  let lastError = null;
  const failedSources = [];

  for (const source of sourcePreference()) {
    let mod;
    let vision;
    try {
      mod = await import(/* @vite-ignore */ source.bundle);
      vision = await mod.FilesetResolver.forVisionTasks(source.wasm);
    } catch (error) {
      lastError = error;
      failedSources.push({
        source: source.name,
        stage: "load",
        error: error.message,
      });
      continue;
    }

    const delegateErrors = [];
    for (const delegate of delegates) {
      try {
        const landmarker = await mod.PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: source.model, delegate },
          runningMode,
          numPoses,
        });
        return {
          landmarker,
          PoseLandmarker: mod.PoseLandmarker,
          DrawingUtils: mod.DrawingUtils,
          FilesetResolver: mod.FilesetResolver,
          source: source.name,
          delegate,
          modelAssetPath: source.model,
          failedSources,
        };
      } catch (error) {
        lastError = error;
        delegateErrors.push({
          delegate,
          error: error.message,
        });
      }
    }
    failedSources.push({
      source: source.name,
      stage: "create",
      delegateErrors,
    });
  }

  throw new Error(`MediaPipe unavailable: ${lastError?.message || lastError || "unknown error"}`);
}
