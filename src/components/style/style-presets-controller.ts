export interface StylePresetsApi {
  add: () => void;
  applyOnLoad: () => Promise<void>;
  requestChange: (preset: string) => void;
  requestRemove: () => void;
}

let target: StylePresetsApi | null = null;
let runtimePromise: Promise<void> | null = null;

function getTarget(): StylePresetsApi {
  if (!target) throw new Error("Style presets runtime is not initialized");
  return target;
}

export function bindStylePresets(nextTarget: StylePresetsApi): () => void {
  target = nextTarget;
  return () => {
    if (target === nextTarget) target = null;
  };
}

/** Starts the DOM-bound presets runtime once its panel markup is available. */
export function initializeStylePresetsRuntime(): Promise<void> {
  // The style-control facade is only needed when presets or the editor are used. Keep it out of the initial
  // application chunk, but install it before the preset runtime reads or applies a saved style.
  runtimePromise ??= import("./map-style-controls")
    .then(({ initializeMapStyleControls }) => {
      initializeMapStyleControls();
      return import("./style-presets-runtime");
    })
    .then(() => undefined);
  return runtimePromise;
}

/** Stable typed entry point for bundled callers and the legacy window alias. */
export const StylePresets: StylePresetsApi = {
  add: () => getTarget().add(),
  applyOnLoad: () => getTarget().applyOnLoad(),
  requestChange: preset => getTarget().requestChange(preset),
  requestRemove: () => getTarget().requestRemove()
};
