import { defineConfig } from "vitest/config";

// Calls the real API: sequential, generous timeouts.
export default defineConfig({
  test: {
    include: ["test/live/**/*.live.test.ts"],
    fileParallelism: false,
    testTimeout: 120_000,
  },
});
