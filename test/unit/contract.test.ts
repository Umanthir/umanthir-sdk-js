import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { API_CONTRACT_VERSION, SUPPORTED_API_MAJOR } from "../../src/index.js";

const dir = new URL("../../openapi/", import.meta.url);
const snapshots = readdirSync(dir).filter((f) => /^umanthir-api\.\d+\.\d+\.\d+\.en\.yaml$/.test(f));

describe("API contract", () => {
  it("has exactly one snapshot", () => {
    expect(snapshots).toHaveLength(1);
  });

  it("generated version matches the snapshot file name and its info.version", () => {
    const [file] = snapshots;
    const yaml = readFileSync(new URL(file as string, dir), "utf8");
    expect(file).toBe(`umanthir-api.${API_CONTRACT_VERSION}.en.yaml`);
    expect(yaml).toMatch(
      new RegExp(
        `^info:[\\s\\S]*?^ {2}version: ${API_CONTRACT_VERSION.replaceAll(".", "\\.")}$`,
        "m",
      ),
    );
  });

  it("targets the supported API major version", () => {
    expect(Number(API_CONTRACT_VERSION.split(".")[0])).toBe(SUPPORTED_API_MAJOR);
  });
});
