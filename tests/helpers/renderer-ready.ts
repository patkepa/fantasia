import type { Page } from "@playwright/test";

export async function waitForRenderer(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const snapshot = window.MapPerformance?.getRendererSnapshot();
    return snapshot?.lifecycleState === "committed" &&
      snapshot.committedWorldRevision === snapshot.requestedWorldRevision && snapshot.cells > 0;
  }, undefined, { timeout: 120000 });
}
