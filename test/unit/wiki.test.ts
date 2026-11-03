import { describe, expect, it } from "vitest";
import {
  NotFoundError,
  ServiceUnavailableError,
  Umanthir,
  ValidationError,
} from "../../src/index.js";
import { apiError, fakeFetch, json } from "./helpers.js";

const API = "https://api.umanthir.com";

function client(...replies: Parameters<typeof fakeFetch>) {
  const fake = fakeFetch(...replies);
  return {
    umanthir: new Umanthir({ fetch: fake.fetch, logLevel: "off", maxRetries: 0 }),
    calls: fake.calls,
  };
}

describe("Wiki routes", () => {
  it.each([
    ["rashidLocation", (c: Umanthir) => c.wiki.rashidLocation(), "/v2/wiki/rashid/location"],
    ["categories", (c: Umanthir) => c.wiki.categories(), "/v2/wiki/categories"],
    ["list", (c: Umanthir) => c.wiki.list("axes"), "/v2/wiki/axes"],
    [
      "get",
      (c: Umanthir) => c.wiki.get("axes", "hellforged axe"),
      "/v2/wiki/axes/hellforged%20axe",
    ],
    [
      "get with accents",
      (c: Umanthir) => c.wiki.get("runes", "Poção de Mana"),
      "/v2/wiki/runes/Po%C3%A7%C3%A3o%20de%20Mana",
    ],
    [
      "get with symbols",
      (c: Umanthir) => c.wiki.get("misc", "Rashid's Bag?"),
      "/v2/wiki/misc/Rashid's%20Bag%3F",
    ],
  ])("%s → GET %s", async (_name, call, path) => {
    const body = { marker: path };
    const { umanthir, calls } = client(json(body));
    await expect(call(umanthir)).resolves.toEqual(body);
    expect(calls[0]?.url).toBe(`${API}${path}`);
  });
});

describe("Wiki validation (no request sent)", () => {
  it.each([
    ["category with space", (c: Umanthir) => c.wiki.list("two words")],
    ["category with slash", (c: Umanthir) => c.wiki.list("a/b")],
    ["empty category", (c: Umanthir) => c.wiki.get("", "x")],
    ["category not a string", (c: Umanthir) => c.wiki.list(1 as unknown as string)],
    ["empty name", (c: Umanthir) => c.wiki.get("axes", "  ")],
    ["name over 200", (c: Umanthir) => c.wiki.get("axes", "a".repeat(201))],
    ["name with control char", (c: Umanthir) => c.wiki.get("axes", "axe\u0007")],
  ])("%s", async (_name, call) => {
    const { umanthir, calls } = client();
    await expect(call(umanthir)).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });
});

describe("Wiki errors", () => {
  it("404 Not found. → NotFoundError", async () => {
    const { umanthir } = client(apiError(404, "Not found."));
    const error = await umanthir.wiki.get("axes", "nope").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ apiMessage: "Not found." });
  });

  it("503 Wiki data unavailable. → ServiceUnavailableError with reason and retryAfter", async () => {
    const { umanthir } = client(apiError(503, "Wiki data unavailable.", { "retry-after": "60" }));
    const error = await umanthir.wiki.categories().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableError);
    expect(error).toMatchObject({ reason: "wiki_unavailable", retryAfter: 60 });
  });
});
