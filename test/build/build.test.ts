import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const dist = new URL("../../dist/", import.meta.url);
const require = createRequire(import.meta.url);

describe("dist", () => {
  it("ESM build exports the client and the error", async () => {
    const mod = await import(new URL("index.js", dist).href);
    expect(typeof mod.Umanthir).toBe("function");
    expect(new mod.UmanthirError("x")).toBeInstanceOf(mod.UmanthirError);
    expect(new mod.Umanthir()).toBeInstanceOf(mod.Umanthir);
  });

  it("CJS build exports the client and the error", () => {
    const mod = require(fileURLToPath(new URL("index.cjs", dist)));
    expect(typeof mod.Umanthir).toBe("function");
    expect(new mod.UmanthirError("x")).toBeInstanceOf(mod.UmanthirError);
  });

  it("IIFE bundle sets the global Umanthir to the client class", () => {
    const code = readFileSync(new URL("umanthir.min.js", dist), "utf8");
    const sandbox: Record<string, unknown> = {};
    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;
    runInNewContext(code, sandbox);
    const Umanthir = sandbox.Umanthir as {
      new (): object;
      version: string;
      UmanthirError: new (m: string) => Error;
    };
    expect(typeof Umanthir).toBe("function");
    expect(new Umanthir()).toBeInstanceOf(Umanthir);
    expect(typeof Umanthir.version).toBe("string");
    expect(new Umanthir.UmanthirError("x")).toBeInstanceOf(Umanthir.UmanthirError);
  });

  it("bundle has no Node-only globals", () => {
    const code = readFileSync(new URL("umanthir.min.js", dist), "utf8");
    expect(code).not.toMatch(/\brequire\(|\bprocess\./);
  });
});
