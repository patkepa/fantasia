import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: fileURLToPath(new URL("..", import.meta.url)),
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  test: {
    environment: "node",
    setupFiles: [],
    include: [
      "tests/headless/**/*.test.ts",
      "src/generators/campaign/**/*.test.ts",
      "src/services/io/campaign*.test.ts",
      "src/generators/{province-statistics,tax-calculation,battle-calculation,simulation-random}.test.ts",
      "src/services/io/{map-document,map-save-snapshot,map-data-serializer,legacy-map-save-source}.test.ts",
      "src/renderers/scene/political-render-source.test.ts"
    ]
  }
});
