import { defineConfig } from "vitest/config";

// Smoke tests of the built artifacts in dist/. Run after `npm run build`.
export default defineConfig({
  test: {
    include: ["test/build/**/*.test.ts"],
  },
});
