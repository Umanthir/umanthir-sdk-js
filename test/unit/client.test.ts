import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import Browser from "../../src/browser.js";
import { Umanthir, UmanthirError, VERSION } from "../../src/index.js";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  version: string;
};

describe("Umanthir", () => {
  it("creates a client", () => {
    expect(new Umanthir()).toBeInstanceOf(Umanthir);
  });

  it("exposes the SDK version, equal to package.json", () => {
    expect(VERSION).toBe(pkg.version);
    expect(Umanthir.version).toBe(VERSION);
  });
});

describe("UmanthirError", () => {
  it("is an Error with its own name and cause", () => {
    const cause = new Error("root");
    const error = new UmanthirError("failed", { cause });
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(UmanthirError);
    expect(error.name).toBe("UmanthirError");
    expect(error.message).toBe("failed");
    expect(error.cause).toBe(cause);
  });

  it("keeps instanceof for subclasses", () => {
    class ChildError extends UmanthirError {}
    expect(new ChildError("x")).toBeInstanceOf(UmanthirError);
  });
});

describe("browser entry", () => {
  it("default export is the client class with the error classes attached", () => {
    expect(Browser).toBe(Umanthir);
    expect((Browser as unknown as { UmanthirError: unknown }).UmanthirError).toBe(UmanthirError);
  });
});
