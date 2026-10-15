import { expect, test } from "@playwright/test";
import { waitForRenderer } from "../helpers/renderer-ready";

test("the same seed reproduces world geometry and names", async ({ page }) => {
  const fingerprint = async () => {
    await page.goto("/?seed=alea-check&width=1280&height=720");
    await waitForRenderer(page);
    return page.evaluate(() => ({
      heights: Array.from(pack.cells.h),
      burgs: pack.burgs.filter(burg => burg.i && !burg.removed).map(({ name, x, y }) => ({ name, x, y })),
      states: pack.states.filter(state => state.i && !state.removed).map(({ fullName }) => fullName),
      routes: pack.routes.map(({ name, points }) => ({ name, points }))
    }));
  };
  const first = await fingerprint();
  expect(first.burgs.length).toBeGreaterThan(0);
  expect(first.routes.length).toBeGreaterThan(0);
  expect(await fingerprint()).toEqual(first);
});

test("route regeneration keeps names on nameable routes", async ({ page }) => {
  await page.goto("/?seed=alea-check&width=1280&height=720");
  await waitForRenderer(page);
  const samples = await page.evaluate(() => Array.from({ length: 2 }, () => {
    window.Routes.regenerate();
    return pack.routes.filter(route => route.points.length >= 4).map(route => route.name);
  }));
  for (const names of samples) {
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(name?.trim().length).toBeGreaterThan(0);
  }
});
