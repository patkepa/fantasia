import { invalidatePixiRendererLayer } from "@/renderers/pixi/pixi-renderer-controller";

export function drawBiomes(): void {
  TIME && console.time("drawBiomes");
  invalidatePixiRendererLayer("biomes");

  TIME && console.timeEnd("drawBiomes");
}

declare global {
  interface Window {
    drawBiomes: typeof drawBiomes;
  }
}

window.drawBiomes = drawBiomes;
