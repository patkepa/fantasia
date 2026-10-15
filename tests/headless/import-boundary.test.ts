import { expect, it } from "vitest";

it("imports the preparation boundaries without browser globals or application initialization", async () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  expect(typeof Node).toBe("undefined");
  await Promise.all([
    import("@/generators/province-statistics"), import("@/generators/tax-calculation"),
    import("@/generators/battle-calculation"), import("@/generators/simulation-random"),
    import("@/services/io/map-document"), import("@/services/io/legacy-map-save-source"),
    import("@/renderers/scene/political-render-source")
  ]);
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
});
