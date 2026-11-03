import { defineConfig } from "vitest/config";

// Type-level tests (expectTypeOf), checked by the TypeScript compiler.
export default defineConfig({
  test: {
    include: [],
    typecheck: {
      enabled: true,
      only: true,
      include: ["test/types/**/*.test-d.ts"],
      tsconfig: "./tsconfig.types.json",
    },
  },
});
