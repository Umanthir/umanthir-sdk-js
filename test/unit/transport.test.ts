import { describe, expect, it, vi } from "vitest";
import { LevelLogger } from "../../src/core/logger.js";
import { Transport, type TransportConfig } from "../../src/core/transport.js";
import { type UmanthirWarning, WarningEmitter } from "../../src/core/warnings.js";
import {
  AbortError,
  type APIError,
  ConnectionError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
  UpstreamError,
  ValidationError,
} from "../../src/errors.js";
import { apiError, fakeFetch, json, memoryLogger } from "./helpers.js";

function setup(replies: Parameters<typeof fakeFetch>, config: Partial<TransportConfig> = {}) {
  const { fetch, calls } = fakeFetch(...replies);
  const mem = memoryLogger();
  const warnings: UmanthirWarning[] = [];
  const sleeps: number[] = [];
  const transport = new Transport(
    {
      baseURL: new URL("https://api.umanthir.com"),
      apiKey: undefined,
      timeout: 1000,
      maxRetries: 2,
      fetch,
      logger: new LevelLogger("debug", mem.logger),
      logBodies: false,
      warnings: new WarningEmitter((w) => warnings.push(w)),
      userAgent: undefined,
      onRequest: undefined,
      onResponse: undefined,
      ...config,
    },
    {
      sleep: async (ms, signal) => {
        sleeps.push(ms);
        if (signal?.aborted) throw signal.reason;
      },
      now: () => 0,
      random: () => 1,
    },
  );
  return { transport, calls, mem, warnings, sleeps };
}

const get = (options = {}) => ({ method: "GET" as const, path: "/v2/x", options });

describe("Transport: requests", () => {
  it("sends a GET with safe defaults and parses JSON", async () => {
    const t = setup([json({ ok: true })]);
    const res = await t.transport.request<{ ok: boolean }>(get());
    expect(res).toEqual({
      status: 200,
      headers: { "content-type": "application/json" },
      data: { ok: true },
      notModified: false,
    });
    const call = t.calls[0];
    expect(call?.url).toBe("https://api.umanthir.com/v2/x");
    expect(call?.init).toMatchObject({ method: "GET", credentials: "omit", redirect: "error" });
    expect(call?.init.headers).toEqual({ Accept: "application/json" });
  });

  it("builds query strings with repeated keys and skips undefined", async () => {
    const t = setup([json({})]);
    await t.transport.request({
      method: "GET",
      path: "/v2/q",
      query: { page: 2, world: "Antica", types: ["pvp", "optional"], x: undefined, flag: true },
    });
    expect(t.calls[0]?.url).toBe(
      "https://api.umanthir.com/v2/q?page=2&world=Antica&types=pvp&types=optional&flag=true",
    );
  });

  it("keeps a base path prefix", async () => {
    const t = setup([json({})], { baseURL: new URL("https://proxy.example.com/umanthir/") });
    await t.transport.request(get());
    expect(t.calls[0]?.url).toBe("https://proxy.example.com/umanthir/v2/x");
  });

  it("refuses a path that escapes the base origin", () => {
    const t = setup([]);
    expect(() => t.transport.buildURL("@evil.example.com/x")).toThrow(ValidationError);
  });

  it("sends apiKey, user agent and a JSON body", async () => {
    const t = setup([json({})], {
      apiKey: "secret-key",
      userAgent: "umanthir-sdk-js/0.0.0 node/24",
    });
    await t.transport.request({
      method: "POST",
      path: "/v2/tools/hunt/split",
      body: { a: 1 },
      headers: { "If-None-Match": '"e"' },
    });
    expect(t.calls[0]?.init.headers).toEqual({
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer secret-key",
      "User-Agent": "umanthir-sdk-js/0.0.0 node/24",
      "If-None-Match": '"e"',
    });
    expect(t.calls[0]?.init.body).toBe('{"a":1}');
  });

  it("returns notModified on 304", async () => {
    const t = setup([new Response(null, { status: 304, headers: { etag: '"e"' } })]);
    const res = await t.transport.request(get());
    expect(res).toMatchObject({ status: 304, notModified: true, data: undefined });
  });

  it("rejects 2xx bodies that are empty or not JSON", async () => {
    const empty = setup([new Response("", { status: 200 })]);
    await expect(empty.transport.request(get())).rejects.toMatchObject({
      apiMessage: "Empty response body",
    });
    const html = setup([new Response("<html>oops</html>", { status: 200 })]);
    await expect(html.transport.request(get())).rejects.toMatchObject({
      apiMessage: "Invalid JSON response",
      body: "oops",
    });
  });

  it("validates per-call options", async () => {
    const t = setup([]);
    await expect(t.transport.request(get({ timeout: 0 }))).rejects.toThrow(ValidationError);
    await expect(t.transport.request(get({ maxRetries: 11 }))).rejects.toThrow(ValidationError);
  });
});

describe("Transport: errors", () => {
  it("maps API errors with the API message", async () => {
    const t = setup([apiError(404, "Character not found.")]);
    const error = await t.transport.request(get()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ status: 404, apiMessage: "Character not found.", method: "GET" });
  });

  it("turns HTML error bodies into a short plain excerpt", async () => {
    const t = setup([
      new Response(`<html><body><h1>Bad</h1>${"x".repeat(500)}</body></html>`, { status: 500 }),
    ]);
    const error = (await t.transport.request(get()).catch((e: unknown) => e)) as APIError;
    expect(error.apiMessage).toBe("HTTP 500");
    expect(String(error.body)).not.toContain("<");
    expect(String(error.body).length).toBeLessThan(260);
  });

  it("uses HTTP <status> when the JSON body has no message", async () => {
    const t = setup([json({ nope: 1 }, 418), json({ error: { message: "  " } }, 418)]);
    await expect(t.transport.request(get())).rejects.toMatchObject({ apiMessage: "HTTP 418" });
    await expect(t.transport.request(get())).rejects.toMatchObject({ apiMessage: "HTTP 418" });
  });

  it("wraps network failures as ConnectionError", async () => {
    const t = setup([new TypeError("fetch failed")], { maxRetries: 0 });
    const error = await t.transport.request(get()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConnectionError);
    expect((error as Error).cause).toBeInstanceOf(TypeError);
  });

  it("reports timeouts as TimeoutError", async () => {
    const slow = (call: { init: RequestInit }) =>
      new Promise<Response>((_, reject) => {
        call.init.signal?.addEventListener("abort", () => reject(call.init.signal?.reason));
      });
    const t = setup([slow], { timeout: 5, maxRetries: 0 });
    await expect(t.transport.request(get())).rejects.toBeInstanceOf(TimeoutError);
  });

  it("reports caller cancellation as AbortError", async () => {
    const controller = new AbortController();
    controller.abort();
    const t = setup([json({})]);
    await expect(t.transport.request(get({ signal: controller.signal }))).rejects.toBeInstanceOf(
      AbortError,
    );
    expect(t.calls).toHaveLength(0);
  });

  it("reports cancellation during the request as AbortError", async () => {
    const controller = new AbortController();
    const t = setup([
      () => {
        controller.abort();
        throw new DOMException("aborted", "AbortError");
      },
    ]);
    await expect(t.transport.request(get({ signal: controller.signal }))).rejects.toBeInstanceOf(
      AbortError,
    );
  });
});

describe("Transport: retries", () => {
  it("retries 429 honoring Retry-After, then succeeds", async () => {
    const t = setup([
      apiError(429, "Rate limit exceeded.", { "retry-after": "2" }),
      json({ ok: 1 }),
    ]);
    const res = await t.transport.request(get());
    expect(res.data).toEqual({ ok: 1 });
    expect(t.sleeps).toEqual([2000]);
    expect(t.warnings.map((w) => w.code)).toEqual(["RETRYING"]);
  });

  it("uses exponential backoff without Retry-After and gives up after maxRetries", async () => {
    const t = setup([
      apiError(502, "Upstream request failed."),
      apiError(520, "x"),
      apiError(503, "Upstream busy."),
    ]);
    const error = await t.transport.request(get()).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 503, reason: "busy" });
    expect(t.calls).toHaveLength(3);
    expect(t.sleeps).toEqual([500, 1000]);
    const first = await setup([apiError(502, "x")], { maxRetries: 0 })
      .transport.request(get())
      .catch((e: unknown) => e);
    expect(first).toBeInstanceOf(UpstreamError);
  });

  it("does not wait for Retry-After longer than 30 s", async () => {
    const t = setup([apiError(429, "Rate limit exceeded.", { "retry-after": "120" })]);
    const error = (await t.transport.request(get()).catch((e: unknown) => e)) as RateLimitError;
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.retryAfter).toBe(120);
    expect(t.sleeps).toEqual([]);
  });

  it("does not retry non-retryable statuses or POST", async () => {
    const t404 = setup([apiError(404, "Not found.")]);
    await expect(t404.transport.request(get())).rejects.toBeInstanceOf(NotFoundError);
    expect(t404.calls).toHaveLength(1);
    const post = setup([apiError(503, "Upstream busy."), new TypeError("net")]);
    await expect(
      post.transport.request({ method: "POST", path: "/v2/p", body: {} }),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      post.transport.request({ method: "POST", path: "/v2/p", body: {} }),
    ).rejects.toBeInstanceOf(ConnectionError);
    expect(post.sleeps).toEqual([]);
  });

  it("retries network errors", async () => {
    const t = setup([new TypeError("reset"), json({ ok: 2 })]);
    expect((await t.transport.request(get())).data).toEqual({ ok: 2 });
    expect(t.warnings[0]).toMatchObject({
      code: "RETRYING",
      details: { reason: "ConnectionError" },
    });
  });

  it("stops retrying when the caller aborts during the wait", async () => {
    const controller = new AbortController();
    const t = setup([apiError(503, "Upstream busy.")]);
    const sleeping = new Transport(
      {
        baseURL: new URL("https://api.umanthir.com"),
        apiKey: undefined,
        timeout: 1000,
        maxRetries: 2,
        fetch: fakeFetch(apiError(503, "x")).fetch,
        logger: new LevelLogger("off", memoryLogger().logger),
        logBodies: false,
        warnings: new WarningEmitter(() => {}),
        userAgent: undefined,
        onRequest: undefined,
        onResponse: undefined,
      },
      {
        sleep: async () => {
          controller.abort();
          throw new Error("aborted");
        },
      },
    );
    await expect(sleeping.request(get({ signal: controller.signal }))).rejects.toBeInstanceOf(
      AbortError,
    );
    expect(t.calls).toHaveLength(0);
  });
});

describe("Transport: warnings", () => {
  it("warns once when the rate limit is low", async () => {
    const h = { "ratelimit-limit": "100", "ratelimit-remaining": "5", "ratelimit-reset": "99" };
    const t = setup([
      json({}, 200, h),
      json({}, 200, h),
      json({}, 200, { ...h, "ratelimit-remaining": "50" }),
    ]);
    for (let i = 0; i < 3; i++) await t.transport.request(get());
    expect(t.warnings.map((w) => w.code)).toEqual(["RATE_LIMIT_LOW"]);
  });

  it("warns once on another API major version", async () => {
    const t = setup([
      json({}, 200, { "x-api-version": "3.0.0" }),
      json({}, 200, { "x-api-version": "3.0.0" }),
      json({}, 200, { "x-api-version": "2.9.0" }),
    ]);
    for (let i = 0; i < 3; i++) await t.transport.request(get());
    expect(t.warnings.map((w) => w.code)).toEqual(["API_VERSION_MISMATCH"]);
  });

  it("warns once per deprecated path", async () => {
    const t = setup([
      json({}, 200, { deprecation: "true" }),
      json({}, 200, { sunset: "Wed, 01 Jan 2027 00:00:00 GMT" }),
    ]);
    await t.transport.request(get());
    await t.transport.request(get());
    expect(t.warnings).toHaveLength(1);
    expect(t.warnings[0]).toMatchObject({ code: "DEPRECATED", details: { path: "/v2/x" } });
  });
});

describe("Transport: logs and hooks", () => {
  it("logs requests and responses with redacted headers", async () => {
    const t = setup(
      [
        json({ big: "x".repeat(5000) }, 200, {
          "x-api-version": "2.4.2",
          "ratelimit-remaining": "59",
          "ratelimit-limit": "60",
        }),
      ],
      { apiKey: "top-secret", logBodies: true },
    );
    await t.transport.request(get());
    const text = t.mem.text();
    expect(text).toContain("→ GET https://api.umanthir.com/v2/x (attempt 1)");
    expect(text).toContain(
      "← 200 GET https://api.umanthir.com/v2/x 0ms X-API-Version=2.4.2 RateLimit-Remaining=59",
    );
    expect(text).toContain("[REDACTED]");
    expect(text).not.toContain("top-secret");
    expect(text).toContain("more chars");
  });

  it("calls hooks and turns hook failures into a single warning", async () => {
    const onRequest = vi.fn(() => {
      throw new Error("hook bug");
    });
    const onResponse = vi.fn();
    const t = setup([json({}), json({})], { onRequest, onResponse, apiKey: "k" });
    await t.transport.request(get());
    await t.transport.request(get());
    expect(onRequest).toHaveBeenCalledTimes(2);
    expect(onRequest.mock.calls[0]?.[0]).toMatchObject({
      method: "GET",
      attempt: 1,
      headers: { Authorization: "[REDACTED]" },
    });
    expect(onResponse.mock.calls[0]?.[0]).toMatchObject({ status: 200, durationMs: 0 });
    expect(t.warnings.map((w) => w.code)).toEqual(["HOOK_FAILED"]);
  });
});
