import { describe, expect, it } from "vitest";
import { LevelLogger } from "../../src/core/logger.js";
import { Transport } from "../../src/core/transport.js";
import { type UmanthirWarning, WarningEmitter } from "../../src/core/warnings.js";
import { Resource } from "../../src/resources/base.js";
import { fakeFetch, json, memoryLogger } from "./helpers.js";

class LegacyResource extends Resource {
  /** @deprecated Use `modern()`. */
  public async old(): Promise<unknown> {
    this.deprecated("legacy.old()", "legacy.modern()");
    return this.call("/v2/x", undefined);
  }
}

describe("deprecated SDK methods", () => {
  it("warn once per client and keep working", async () => {
    const warnings: UmanthirWarning[] = [];
    const transport = new Transport({
      baseURL: new URL("https://api.umanthir.com"),
      apiKey: undefined,
      timeout: 1000,
      maxRetries: 0,
      fetch: fakeFetch(json({ a: 1 }), json({ a: 2 })).fetch,
      logger: new LevelLogger("off", memoryLogger().logger),
      logBodies: false,
      warnings: new WarningEmitter((w) => warnings.push(w)),
      userAgent: undefined,
      onRequest: undefined,
      onResponse: undefined,
    });
    const legacy = new LegacyResource(transport);
    await expect(legacy.old()).resolves.toEqual({ a: 1 });
    await expect(legacy.old()).resolves.toEqual({ a: 2 });
    expect(warnings).toEqual([
      {
        code: "DEPRECATED",
        message:
          "legacy.old() is deprecated and will be removed in the next major version; use legacy.modern().",
        details: { method: "legacy.old()", replacement: "legacy.modern()" },
      },
    ]);
  });
});
