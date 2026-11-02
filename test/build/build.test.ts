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

  it("IIFE bundle works like in a browser: global class, calls and error classes", async () => {
    const code = readFileSync(new URL("umanthir.min.js", dist), "utf8");
    const calls: { url: string; init: RequestInit }[] = [];
    const replies = [
      new Response(JSON.stringify({ character_information: { name: "Njorn" }, deaths: [] }), {
        status: 200,
      }),
      new Response(
        JSON.stringify({ error: { status_code: 404, message: "Character not found." } }),
        { status: 404 },
      ),
    ];
    const sandbox: Record<string, unknown> = {
      URL,
      URLSearchParams,
      AbortController,
      AbortSignal,
      Headers,
      Response,
      DOMException,
      console,
      setTimeout,
      clearTimeout,
      document: {},
      fetch: async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return replies.shift() as Response;
      },
    };
    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;
    runInNewContext(code, sandbox);
    const Umanthir = sandbox.Umanthir as {
      new (): { characters: { get(name: string): Promise<unknown> } };
      version: string;
      NotFoundError: new (...args: never[]) => Error;
      UmanthirError: new (m: string) => Error;
    };
    expect(typeof Umanthir).toBe("function");
    expect(typeof Umanthir.version).toBe("string");
    const client = new Umanthir();
    expect(client).toBeInstanceOf(Umanthir);
    await expect(client.characters.get("Njorn")).resolves.toMatchObject({
      character_information: { name: "Njorn" },
    });
    const error = await client.characters.get("Nobody").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Umanthir.NotFoundError);
    expect(error).toBeInstanceOf(Umanthir.UmanthirError);
    expect(calls[0]?.url).toBe("https://api.umanthir.com/v2/community/characters/Njorn");
    // Browser: only CORS-allowed headers, no User-Agent.
    expect(calls[0]?.init.headers).toEqual({ Accept: "application/json" });
  });

  it("bundle has no Node-only globals", () => {
    const code = readFileSync(new URL("umanthir.min.js", dist), "utf8");
    expect(code).not.toMatch(/\brequire\(|\bprocess\./);
  });
});
