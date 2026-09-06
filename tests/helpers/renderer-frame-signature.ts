import type { Page } from "@playwright/test";

export async function getRenderedFrameSignature(page: Page) {
  const canvas = page.locator("#pixi-map-renderer canvas");
  const source = `data:image/png;base64,${(await canvas.screenshot()).toString("base64")}`;
  return page.evaluate(async imageSource => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Could not decode the renderer screenshot"));
      element.src = imageSource;
    });
    const sample = document.createElement("canvas");
    sample.width = 96;
    sample.height = Math.max(1, Math.round((image.height / image.width) * sample.width));
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Could not create a frame-analysis canvas");
    context.drawImage(image, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    const colors = new Set<string>();
    let blackPixels = 0;
    let opaquePixels = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (pixels[offset + 3] < 128) continue;
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      opaquePixels++;
      if (red < 16 && green < 16 && blue < 16) blackPixels++;
      colors.add(`${red >> 4}:${green >> 4}:${blue >> 4}`);
    }
    return {
      blackRatio: opaquePixels ? blackPixels / opaquePixels : 1,
      colorBuckets: colors.size,
      opaquePixels
    };
  }, source);
}
