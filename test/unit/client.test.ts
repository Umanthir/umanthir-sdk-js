import { readFileSync } from "node:fs";
import { inspect } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import Browser from "../../src/browser.js";
import {
  API_CONTRACT_VERSION,
  APIError,
  DEFAULT_BASE_URL,
  NotFoundError,
  Umanthir,
  UmanthirError,
  type UmanthirWarning,
  ValidationError,
  VERSION,
} from "../../src/index.js";
import { apiError, fakeFetch, json, memoryLogger } from "./helpers.js";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  version: string;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Umanthir: options", () => {
  it("uses safe defaults", () => {
    const client = new Umanthir({ fetch: fakeFetch().fetch });
    expect(client.baseURL).toBe(DEFAULT_BASE_URL);
    expect(client.toJSON()).toEqual({
      baseURL: DEFAULT_BASE_URL,
      timeout: 30000,
      maxRetries: 2,
      apiKey: undefined,
    });
    expect(String(client)).toBe("Umanthir(https://api.umanthir.com)");
  });

  it("exposes the SDK version, equal to package.json", () => {
    expect(VERSION).toBe(pkg.version);
    expect(Umanthir.version).toBe(VERSION);
    expect(API_CONTRACT_VERSION).toMatch(/^2\.\d+\.\d+$/);
  });

  it.each([
    ["http://api.umanthir.com", "https"],
    ["ftp://x", "https"],
    ["not a url", "absolute"],
    ["https://user:pass@api.umanthir.com", "credentials"],
    ["https://api.umanthir.com/?a=1", "query"],
  ])("rejects baseURL %s", (baseURL, text) => {
    expect(() => new Umanthir({ baseURL, fetch: fakeFetch().fetch })).toThrow(text);
  });

  it("accepts http for localhost with a warning", () => {
    const warnings: UmanthirWarning[] = [];
    const client = new Umanthir({
      baseURL: "http://localhost:8081/",
      fetch: fakeFetch().fetch,
      logLevel: "off",
      onWarning: (w) => warnings.push(w),
    });
    expect(client.baseURL).toBe("http://localhost:8081");
    expect(warnings.map((w) => w.code)).toEqual(["INSECURE_BASE_URL"]);
  });

  it.each([
    [{ apiKey: "" }, "apiKey"],
    [{ apiKey: "a b" }, "apiKey"],
    [{ apiKey: "a\nb" }, "apiKey"],
    [{ timeout: 0 }, "timeout"],
    [{ timeout: 1.5 }, "timeout"],
    [{ maxRetries: -1 }, "maxRetries"],
    [{ logLevel: "loud" }, "logLevel"],
    [{ fetch: "nope" }, "fetch"],
    [{ baseURL: 1 }, "baseURL"],
  ])("rejects %o", (options, text) => {
    expect(() => new Umanthir({ fetch: fakeFetch().fetch, ...(options as object) })).toThrow(text);
  });

  it("rejects non-object options", () => {
    expect(() => new Umanthir(null as never)).toThrow(ValidationError);
  });

  it("requires a fetch implementation", () => {
    vi.stubGlobal("fetch", undefined);
    expect(() => new Umanthir()).toThrow("No global fetch");
  });

  it("uses the global fetch by default", async () => {
    const { fetch, calls } = fakeFetch(json({ deaths: [] }));
    vi.stubGlobal("fetch", fetch);
    await new Umanthir().characters.get("Njorn");
    expect(calls).toHaveLength(1);
  });
});

describe("Umanthir: logging", () => {
  it("debug: true logs requests; UMANTHIR_LOG works when no level is given", async () => {
    const mem = memoryLogger();
    await new Umanthir({
      fetch: fakeFetch(json({})).fetch,
      debug: true,
      logger: mem.logger,
    }).characters.get("A");
    expect(mem.text()).toContain("→ GET https://api.umanthir.com/v2/community/characters/A");

    vi.stubEnv("UMANTHIR_LOG", "debug");
    const env = memoryLogger();
    await new Umanthir({ fetch: fakeFetch(json({})).fetch, logger: env.logger }).characters.get(
      "A",
    );
    expect(env.lines.some((l) => l.level === "debug")).toBe(true);
  });

  it("logLevel overrides debug and UMANTHIR_LOG", async () => {
    vi.stubEnv("UMANTHIR_LOG", "debug");
    const mem = memoryLogger();
    await new Umanthir({
      fetch: fakeFetch(json({})).fetch,
      debug: true,
      logLevel: "error",
      logger: mem.logger,
    }).characters.get("A");
    expect(mem.lines).toHaveLength(0);
  });

  it("sends warnings to the logger and survives a throwing onWarning", async () => {
    const mem = memoryLogger();
    const client = new Umanthir({
      baseURL: "http://127.0.0.1:8081",
      fetch: fakeFetch().fetch,
      logger: mem.logger,
      onWarning: () => {
        throw new Error("bad callback");
      },
    });
    expect(client).toBeInstanceOf(Umanthir);
    expect(mem.lines.map((l) => l.level)).toEqual(["warn", "error"]);
  });
});

describe("Umanthir: API key never leaks", () => {
  const keys = ["test-key-AbCdEf123456-ZyXwVuTsRqPoNmLk", "q7Zx", "s3cr3t-π-key", "x".repeat(200)];

  it.each(keys)("key %#", async (apiKey) => {
    const mem = memoryLogger();
    const seen: unknown[] = [];
    const { fetch, calls } = fakeFetch(
      apiError(404, "Character not found."),
      apiError(503, "Upstream busy.", { "retry-after": "0" }),
      apiError(503, "Upstream busy."),
    );
    const client = new Umanthir({
      apiKey,
      fetch,
      debug: true,
      logBodies: true,
      maxRetries: 1,
      logger: mem.logger,
      onRequest: (i) => seen.push(i),
      onResponse: (i) => seen.push(i),
      onWarning: (w) => seen.push(w),
    });
    const errors: unknown[] = [];
    await client.characters.get("Njorn").catch((e: unknown) => errors.push(e));
    await client.characters.get("Njorn").catch((e: unknown) => errors.push(e));

    expect(calls[0]?.init.headers).toMatchObject({ Authorization: `Bearer ${apiKey}` });
    const outputs = [
      mem.text(),
      JSON.stringify(seen),
      JSON.stringify(client),
      String(client),
      inspect(client, { depth: 5 }),
      ...errors.map((e) => `${String(e)} ${JSON.stringify(e)} ${inspect(e, { depth: 5 })}`),
    ];
    for (const output of outputs) expect(output).not.toContain(apiKey);
    expect(JSON.stringify(client)).toContain("[REDACTED]");
  });
});

describe("Umanthir: environment", () => {
  it("sends a User-Agent in Node.js", async () => {
    const { fetch, calls } = fakeFetch(json({}));
    await new Umanthir({ fetch }).characters.get("A");
    expect((calls[0]?.init.headers as Record<string, string> | undefined)?.["User-Agent"]).toMatch(
      /^umanthir-sdk-js\/\S+ node\/\d+/,
    );
  });

  it("in browsers: no User-Agent and a warning for apiKey", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", {});
    const warnings: UmanthirWarning[] = [];
    const { fetch, calls } = fakeFetch(json({}));
    await new Umanthir({
      fetch,
      apiKey: "k",
      logLevel: "off",
      onWarning: (w) => warnings.push(w),
    }).characters.get("A");
    expect(calls[0]?.init.headers).toEqual({
      Accept: "application/json",
      Authorization: "Bearer k",
    });
    expect(warnings.map((w) => w.code)).toEqual(["API_KEY_IN_BROWSER"]);
  });
});

describe("characters.get", () => {
  it("returns the API object as is", async () => {
    const body = { character_information: { name: "Njorn", level: 500 }, deaths: [] };
    const { fetch, calls } = fakeFetch(json(body));
    const character = await new Umanthir({ fetch }).characters.get("Njorn");
    expect(character).toEqual(body);
    expect(calls[0]?.url).toBe("https://api.umanthir.com/v2/community/characters/Njorn");
  });

  it("encodes the name and normalizes NBSP", async () => {
    const { fetch, calls } = fakeFetch(json({}));
    await new Umanthir({ fetch }).characters.get("Sir Ço Ünd");
    expect(calls[0]?.url).toBe(
      "https://api.umanthir.com/v2/community/characters/Sir%20%C3%87o%20%C3%9Cnd",
    );
  });

  it("rejects bad names without a request", async () => {
    const { fetch, calls } = fakeFetch();
    const client = new Umanthir({ fetch });
    await expect(client.characters.get("a/b")).rejects.toBeInstanceOf(ValidationError);
    await expect(client.characters.get("")).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });

  it("throws NotFoundError for a missing character", async () => {
    const client = new Umanthir({ fetch: fakeFetch(apiError(404, "Character not found.")).fetch });
    const error = await client.characters.get("Nobody").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toBeInstanceOf(APIError);
    expect(error).toBeInstanceOf(UmanthirError);
  });

  it("passes per-call options", async () => {
    const { fetch, calls } = fakeFetch(apiError(503, "Upstream busy."));
    const client = new Umanthir({ fetch });
    await expect(client.characters.get("A", { maxRetries: 0 })).rejects.toMatchObject({
      status: 503,
    });
    expect(calls).toHaveLength(1);
  });
});

describe("browser entry", () => {
  it("default export is the client class with every error class attached", () => {
    expect(Browser).toBe(Umanthir);
    const statics = Browser as unknown as Record<string, unknown>;
    for (const name of [
      "UmanthirError",
      "ValidationError",
      "ConnectionError",
      "TimeoutError",
      "AbortError",
      "APIError",
      "BadRequestError",
      "NotFoundError",
      "RateLimitError",
      "UpstreamError",
      "ServiceUnavailableError",
    ]) {
      expect(typeof statics[name]).toBe("function");
    }
    expect(statics["NotFoundError"]).toBe(NotFoundError);
  });
});
