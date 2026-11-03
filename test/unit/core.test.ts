import { afterEach, describe, expect, it, vi } from "vitest";
import { envLogLevel, LevelLogger, redactHeaders, truncate } from "../../src/core/logger.js";
import { backoffDelay, MAX_DELAY_MS, parseRetryAfter, sleep } from "../../src/core/retry.js";
import { pathName, positiveInt } from "../../src/core/validate.js";
import { WarningEmitter } from "../../src/core/warnings.js";
import { ValidationError } from "../../src/errors.js";
import { memoryLogger } from "./helpers.js";

describe("parseRetryAfter", () => {
  const now = Date.parse("2026-11-02T12:00:00Z");
  it("reads delta seconds", () => expect(parseRetryAfter("5", now)).toBe(5000));
  it("reads HTTP dates", () =>
    expect(parseRetryAfter("Mon, 02 Nov 2026 12:00:10 GMT", now)).toBe(10_000));
  it("never returns a negative delay", () =>
    expect(parseRetryAfter("Mon, 02 Nov 2026 11:00:00 GMT", now)).toBe(0));
  it("ignores missing or invalid values", () => {
    expect(parseRetryAfter(undefined, now)).toBeUndefined();
    expect(parseRetryAfter("soon", now)).toBeUndefined();
  });
});

describe("backoffDelay", () => {
  it("grows exponentially within [50%, 100%] of the step", () => {
    expect(backoffDelay(0, () => 0)).toBe(250);
    expect(backoffDelay(0, () => 1)).toBe(500);
    expect(backoffDelay(2, () => 1)).toBe(2000);
  });
  it("is capped", () => expect(backoffDelay(20, () => 1)).toBe(MAX_DELAY_MS));
});

describe("sleep", () => {
  it("resolves after the delay", async () => {
    await expect(sleep(1)).resolves.toBeUndefined();
  });
  it("rejects when the signal aborts", async () => {
    const controller = new AbortController();
    const pending = sleep(10_000, controller.signal);
    controller.abort(new Error("stop"));
    await expect(pending).rejects.toThrow("stop");
  });
  it("rejects at once when the signal was already aborted", async () => {
    await expect(sleep(10, AbortSignal.abort(new Error("gone")))).rejects.toThrow("gone");
  });
});

describe("pathName", () => {
  it("normalizes NBSP and trims", () => expect(pathName("Name", " Njorn Two ")).toBe("Njorn Two"));
  it.each(["a/b", "a\\b", "a?b", "a#b", "a&b"])("rejects %s", (value) => {
    expect(() => pathName("Name", value)).toThrow(ValidationError);
  });
  it("rejects % only in strict mode", () => {
    expect(pathName("Name", "100%")).toBe("100%");
    expect(() => pathName("Name", "100%", { strict: true })).toThrow(ValidationError);
  });
  it("rejects empty, long, control characters and non-strings", () => {
    expect(() => pathName("Name", "  ")).toThrow("must not be empty");
    expect(() => pathName("Name", "x".repeat(101))).toThrow("too long");
    expect(() => pathName("Name", "a\nb")).toThrow("control characters");
    expect(() => pathName("Name", 42)).toThrow("must be a string");
  });
});

describe("positiveInt", () => {
  it("accepts integers >= min", () => expect(positiveInt("Level", 8)).toBe(8));
  it.each([0, -1, 1.5, Number.NaN, "3"])("rejects %s", (value) => {
    expect(() => positiveInt("Level", value)).toThrow(ValidationError);
  });
});

describe("logger", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("filters by level and prefixes messages", () => {
    const mem = memoryLogger();
    const log = new LevelLogger("warn", mem.logger);
    log.debug("d");
    log.info("i");
    log.warn("w", { a: 1 });
    log.error("e");
    expect(mem.lines).toEqual([
      { level: "warn", args: ["[umanthir] w", { a: 1 }] },
      { level: "error", args: ["[umanthir] e"] },
    ]);
  });

  it("off logs nothing", () => {
    const mem = memoryLogger();
    new LevelLogger("off", mem.logger).error("e");
    expect(mem.lines).toHaveLength(0);
  });

  it("survives a logger that throws", () => {
    const broken = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {
        throw new Error("x");
      },
    };
    expect(() => new LevelLogger("debug", broken).error("e")).not.toThrow();
  });

  it("redacts credential headers", () => {
    expect(redactHeaders({ Authorization: "Bearer s", Accept: "x", cookie: "c" })).toEqual({
      Authorization: "[REDACTED]",
      Accept: "x",
      cookie: "[REDACTED]",
    });
  });

  it("truncates long text", () => {
    expect(truncate("abcdef", 3)).toBe("abc… (3 more chars)");
    expect(truncate("abc", 3)).toBe("abc");
  });

  it("reads UMANTHIR_LOG", () => {
    vi.stubEnv("UMANTHIR_LOG", "DEBUG");
    expect(envLogLevel()).toBe("debug");
    vi.stubEnv("UMANTHIR_LOG", "loud");
    expect(envLogLevel()).toBeUndefined();
  });
});

describe("WarningEmitter", () => {
  it("emits always or once per key", () => {
    const seen: string[] = [];
    const w = new WarningEmitter((x) => seen.push(x.code));
    w.emit({ code: "RETRYING", message: "" });
    w.emit({ code: "RETRYING", message: "" });
    w.once("k", { code: "DEPRECATED", message: "" });
    w.once("k", { code: "DEPRECATED", message: "" });
    expect(seen).toEqual(["RETRYING", "RETRYING", "DEPRECATED"]);
  });
});
