// Small JPEG snapshot of the whole rendered map, used by menu cards for library and showcase maps.

import { renderPixiRasterFrame } from "@/renderers/pixi/pixi-renderer-controller";

const THUMBNAIL_WIDTH = 480;

export async function captureMapThumbnail(width: number, height: number): Promise<string | undefined> {
  try {
    const frame = await renderPixiRasterFrame({
      frame: { x: 0, y: 0, width, height },
      fullMap: { width, height },
      resolution: THUMBNAIL_WIDTH / width
    });
    const canvas = document.createElement("canvas");
    canvas.width = THUMBNAIL_WIDTH;
    canvas.height = Math.round((THUMBNAIL_WIDTH * height) / width);
    canvas.getContext("2d")?.drawImage(frame, 0, 0, canvas.width, canvas.height);
    frame.remove();
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch (error) {
    console.warn("Map thumbnail capture failed", error);
    return undefined;
  }
}

// Showcase worlds regenerate from a seed, so their thumbnails are cached per browser after the first visit.
const showcaseKey = (id: string): string => `showcase-thumbnail:${id}`;

export function getShowcaseThumbnail(id: string): string | undefined {
  try {
    return localStorage.getItem(showcaseKey(id)) ?? undefined;
  } catch {
    return undefined;
  }
}

export function storeShowcaseThumbnail(id: string, thumbnail: string): void {
  try {
    localStorage.setItem(showcaseKey(id), thumbnail);
  } catch {
    // Storage may be full or unavailable; the card falls back to its illustrated art.
  }
}
