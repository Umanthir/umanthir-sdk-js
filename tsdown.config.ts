import { defineConfig } from "tsdown";

export default defineConfig([
  {
    // npm package: ESM + CJS with type declarations.
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    platform: "neutral",
    target: "es2022",
    dts: true,
    sourcemap: true,
    clean: true,
  },
  {
    // Browser bundle: global `Umanthir` (the client class).
    entry: { "umanthir.min": "src/browser.ts" },
    format: "iife",
    globalName: "Umanthir",
    platform: "browser",
    target: "es2022",
    minify: true,
    sourcemap: true,
    dts: false,
    clean: false,
    outputOptions: { entryFileNames: "[name].js" },
  },
]);
