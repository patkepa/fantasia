import { expect, test } from "@playwright/test";
import { getRenderedFrameSignature } from "../helpers/renderer-frame-signature";
import { waitForRenderer } from "../helpers/renderer-ready";

test.beforeEach(async ({ page }) => {
  await page.goto("/?seed=test-seed&width=1280&height=720");
  await waitForRenderer(page);
});

test("generated map commits a visible frame without persistent SVG feature layers", async ({ page }) => {
  await expect(page.locator("#pixi-map-renderer canvas")).toBeVisible();
  await expect(page.locator("#viewbox > #ocean, #viewbox > #lakes, #viewbox > #labels")).toHaveCount(0);
  const frame = await getRenderedFrameSignature(page);
  expect(frame.opaquePixels).toBeGreaterThan(0);
  expect(frame.colorBuckets).toBeGreaterThan(4);
  expect(frame.blackRatio).toBeLessThan(0.9);
});

for (const id of ["toggleLakes", "toggleRivers", "toggleLabels"]) {
  test(`${id} can be toggled and restored`, async ({ page }) => {
    const result = await page.evaluate(id => {
      const controls = window.LayerControls;
      const original = controls.isLayerOn(id);
      controls.toggleLayer(id);
      const toggled = controls.isLayerOn(id);
      controls.toggleLayer(id);
      return { original, toggled, restored: controls.isLayerOn(id) };
    }, id);
    expect(result.toggled).toBe(!result.original);
    expect(result.restored).toBe(result.original);
  });
}

test("Q toggles lakes through the layer controls", async ({ page }) => {
  const visible = () => page.evaluate(() => window.LayerControls.isLayerOn("toggleLakes"));
  const before = await visible();
  await page.keyboard.press("q");
  await expect.poll(visible).toBe(!before);
  await page.keyboard.press("q");
  await expect.poll(visible).toBe(before);
});
