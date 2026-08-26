import { LAYER_CONTROLS_CHANGE_EVENT } from "@/components/layers/layer-controls";
import { bindRendererCommands, rendererCommands } from "@/renderers/core/renderer-commands";
import {
  pixiRendererController,
  preloadPixiRenderer,
  syncPixiRendererViewport,
  syncPixiRendererVisibility
} from "./pixi-renderer-controller";
import { activatePixiRendererOwnership } from "./pixi-renderer-ownership";

export const PIXI_RENDERER_FAILURE_EVENT = "map:pixi-renderer:failure";

activatePixiRendererOwnership();
bindRendererCommands(pixiRendererController);
window.MapRendererCommands = rendererCommands;

// Fetch and parse Pixi while generation and the rest of application startup continue.
void preloadPixiRenderer().catch(() => undefined);

let startTask: Promise<void> | null = null;

const scheduleStart = (): void => {
  if (startTask) return;
  startTask = new Promise(resolve => requestAnimationFrame(resolve))
    .then(() => pixiRendererController.start())
    .catch(error => showRendererFailure(error))
    .finally(() => {
      startTask = null;
    });
};

// Vite evaluates module scripts independently. If a generated map is already present by the time this loader finishes
// evaluating, its one-off `map:generated` event has been missed and the Pixi surface would otherwise never mount.
const startIfMapIsReady = (): void => {
  if (typeof pack !== "undefined" && pack?.cells?.i?.length) scheduleStart();
};

export function showRendererFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : "Unable to initialize graphics acceleration";
  const existing = document.getElementById("pixi-renderer-failure");
  const alert = existing ?? document.createElement("div");
  alert.id = "pixi-renderer-failure";
  alert.setAttribute("role", "alert");
  alert.className = "pixi-renderer-failure";
  alert.textContent = `The map renderer could not start. Enable WebGL or WebGPU and reload the page. ${message}`;
  if (!existing) document.getElementById("map")?.before(alert);
  window.dispatchEvent(new Event(PIXI_RENDERER_FAILURE_EVENT));
}

window.addEventListener("map:generated", scheduleStart);
window.addEventListener("map:loaded", scheduleStart);
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startIfMapIsReady, { once: true });
else startIfMapIsReady();
window.addEventListener("load", startIfMapIsReady, { once: true });
window.addEventListener(LAYER_CONTROLS_CHANGE_EVENT, () => {
  requestAnimationFrame(syncPixiRendererVisibility);
});
window.addEventListener("map:viewport-resized", syncPixiRendererViewport);
