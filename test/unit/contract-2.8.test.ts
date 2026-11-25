import { describe, expect, it } from "vitest";
import {
  AuthenticationError,
  BadRequestError,
  NotFoundError,
  ServiceUnavailableError,
  Umanthir,
  ValidationError,
} from "../../src/index.js";
import { fakeFetch, json } from "./helpers.js";

const API = "https://api.umanthir.com";
const KEY = "um_test_secret_key";
const SHA = "a".repeat(64);

function client(...replies: Parameters<typeof fakeFetch>) {
  const fake = fakeFetch(...replies);
  return {
    umanthir: new Umanthir({ fetch: fake.fetch, logLevel: "off", maxRetries: 0, apiKey: KEY }),
    calls: fake.calls,
  };
}

function error(status: number, message: string, code?: string): Response {
  return json({ error: { status_code: status, message, code } }, status);
}

function header(init: RequestInit, name: string): string | null {
  return new Headers(init.headers).get(name);
}

const SEARCH = {
  attribution: "© CipSoft GmbH.",
  client_version: "2026-11-15",
  published_at: "2026-11-15T12:00:00Z",
  sprite_base_url: `${API}/v2/wiki/sprites/`,
  page: 1,
  per_page: 100,
  total: 1,
  total_pages: 1,
  items: [{ id: 3031, name: "gold coin", category: "gold", preview: SHA, active: true }],
};

describe("wiki.rawItems", () => {
  it("searches without filters and sends the apiKey", async () => {
    const { umanthir, calls } = client(json(SEARCH));
    await expect(umanthir.wiki.rawItems()).resolves.toEqual(SEARCH);
    expect(calls[0]?.url).toBe(`${API}/v2/wiki/items`);
    expect(header(calls[0]?.init ?? {}, "authorization")).toBe(`Bearer ${KEY}`);
  });

  it("sends every filter", async () => {
    const { umanthir, calls } = client(json(SEARCH));
    await umanthir.wiki.rawItems({ name: " gold coin ", category: "Gold", named: false, page: 3 });
    const url = new URL(calls[0]?.url ?? "");
    expect(url.pathname).toBe("/v2/wiki/items");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      name: "gold coin",
      category: "Gold",
      named: "false",
      page: "3",
    });
  });

  it.each([
    [{ name: "" }],
    [{ name: "x".repeat(101) }],
    [{ category: "x".repeat(101) }],
    [{ named: "true" }],
    [{ page: 0 }],
    [{ page: 100_001 }],
    [{ page: 1.5 }],
  ])("rejects %j before any request", async (filters) => {
    const { umanthir, calls } = client();
    await expect(umanthir.wiki.rawItems(filters as never)).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });

  it("401 token_required is AuthenticationError with the code", async () => {
    const { umanthir } = client(error(401, "This route needs a token.", "token_required"));
    const err = await umanthir.wiki.rawItems().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthenticationError);
    expect((err as AuthenticationError).code).toBe("token_required");
  });

  it("503 is ServiceUnavailableError with reason items_unavailable", async () => {
    const { umanthir } = client(error(503, "Items data unavailable."));
    const err = await umanthir.wiki.rawItems().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableError);
    expect((err as ServiceUnavailableError).reason).toBe("items_unavailable");
  });

  it("503 token_unverified keeps the code", async () => {
    const { umanthir } = client(error(503, "Token could not be verified.", "token_unverified"));
    const err = await umanthir.wiki.rawItems().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableError);
    expect((err as ServiceUnavailableError).code).toBe("token_unverified");
  });
});

describe("wiki.rawItemsByIds", () => {
  const BATCH = { ...SEARCH, count: 1, items: [], not_found: [102] };

  it("sends the ids comma separated, in order", async () => {
    const { umanthir, calls } = client(json(BATCH));
    await expect(umanthir.wiki.rawItemsByIds([3031, 102])).resolves.toEqual(BATCH);
    const url = new URL(calls[0]?.url ?? "");
    expect(url.pathname).toBe("/v2/wiki/items");
    expect(url.searchParams.get("ids")).toBe("3031,102");
    expect([...url.searchParams.keys()]).toEqual(["ids"]);
  });

  it("accepts 100 ids", async () => {
    const ids = Array.from({ length: 100 }, (_, i) => i + 1);
    const { umanthir, calls } = client(json(BATCH));
    await umanthir.wiki.rawItemsByIds(ids);
    expect(new URL(calls[0]?.url ?? "").searchParams.get("ids")?.split(",")).toHaveLength(100);
  });

  it.each([
    [[]],
    [Array.from({ length: 101 }, (_, i) => i + 1)],
    [[0]],
    [[10_000_000]],
    [[1.5]],
    [["3031"]],
    ["3031"],
    [undefined],
  ])("rejects %j before any request", async (ids) => {
    const { umanthir, calls } = client();
    await expect(umanthir.wiki.rawItemsByIds(ids as never)).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });

  it("400 invalid_field is BadRequestError", async () => {
    const { umanthir } = client(error(400, "Invalid item id.", "invalid_field"));
    await expect(umanthir.wiki.rawItemsByIds([1])).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe("wiki.rawItem", () => {
  it("GET /v2/wiki/items/{id}", async () => {
    const body = { ...SEARCH, item: { id: 3031, name: "gold coin", active: true } };
    const { umanthir, calls } = client(json(body));
    await expect(umanthir.wiki.rawItem(3031)).resolves.toEqual(body);
    expect(calls[0]?.url).toBe(`${API}/v2/wiki/items/3031`);
    expect(header(calls[0]?.init ?? {}, "authorization")).toBe(`Bearer ${KEY}`);
  });

  it.each([0, -1, 10_000_000, 1.5, Number.NaN, "3031", undefined])(
    "rejects %j before any request",
    async (id) => {
      const { umanthir, calls } = client();
      await expect(umanthir.wiki.rawItem(id as number)).rejects.toBeInstanceOf(ValidationError);
      expect(calls).toHaveLength(0);
    },
  );

  it("404 item_not_found is NotFoundError", async () => {
    const { umanthir } = client(error(404, "Item not found.", "item_not_found"));
    const err = await umanthir.wiki.rawItem(1).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotFoundError);
    expect((err as NotFoundError).code).toBe("item_not_found");
  });

  it("401 invalid_token is AuthenticationError", async () => {
    const { umanthir } = client(error(401, "Invalid token.", "invalid_token"));
    await expect(umanthir.wiki.rawItem(1)).rejects.toBeInstanceOf(AuthenticationError);
  });
});

describe("wiki.itemImageUrl", () => {
  it("builds the URL without a request and without the apiKey", () => {
    const { umanthir, calls } = client();
    const url = umanthir.wiki.itemImageUrl(3031);
    expect(url).toBe(`${API}/v2/wiki/items/3031/image`);
    expect(url).not.toContain(KEY);
    expect(calls).toHaveLength(0);
  });

  it("follows a custom base URL", () => {
    const fake = fakeFetch();
    const umanthir = new Umanthir({
      fetch: fake.fetch,
      logLevel: "off",
      baseURL: "https://x.test/",
    });
    expect(umanthir.wiki.itemImageUrl(1)).toBe("https://x.test/v2/wiki/items/1/image");
  });

  it.each([0, 10_000_000, 1.5, "1"])("rejects %j", (id) => {
    const { umanthir } = client();
    expect(() => umanthir.wiki.itemImageUrl(id as number)).toThrow(ValidationError);
  });
});

describe("wiki.sprite", () => {
  it("returns the PNG bytes", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const { umanthir, calls } = client(
      new Response(png, { status: 200, headers: { "content-type": "image/png" } }),
    );
    const got = await umanthir.wiki.sprite(SHA);
    expect(got).toBeInstanceOf(Uint8Array);
    expect([...got]).toEqual([...png]);
    expect(calls[0]?.url).toBe(`${API}/v2/wiki/sprites/${SHA}.png`);
  });

  it.each([
    "",
    "A".repeat(64),
    "a".repeat(63),
    "a".repeat(65),
    `${"a".repeat(63)}g`,
    `../${"a".repeat(61)}`,
    7,
  ])("rejects %j before any request", async (sha) => {
    const { umanthir, calls } = client();
    await expect(umanthir.wiki.sprite(sha as string)).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });

  it("404 sprite_not_found is NotFoundError", async () => {
    const { umanthir } = client(error(404, "Sprite not found.", "sprite_not_found"));
    await expect(umanthir.wiki.sprite(SHA)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe.each([
  ["creatures", "creature", "/v2/wiki/creatures"],
  ["npcs", "npc", "/v2/wiki/npcs"],
  ["spells", "spell", "/v2/wiki/spells"],
  ["achievements", "achievement", "/v2/wiki/achievements"],
] as const)("wiki.%s / wiki.%s", (list, one, path) => {
  it(`GET ${path}`, async () => {
    const body = { count: 0, [list]: [] };
    const { umanthir, calls } = client(json(body));
    await expect(umanthir.wiki[list]()).resolves.toEqual(body);
    expect(calls[0]?.url).toBe(API + path);
  });

  it(`GET ${path}/{name}, encoded and trimmed`, async () => {
    const { umanthir, calls } = client(json({ name: "x" }));
    await umanthir.wiki[one]("  Ashes to Dust / 100% ");
    expect(calls[0]?.url).toBe(`${API}${path}/Ashes%20to%20Dust%20%2F%20100%25`);
  });

  it.each(["", "   ", "x".repeat(201), "a\u0000b", 7, undefined])(
    "rejects %j before any request",
    async (name) => {
      const { umanthir, calls } = client();
      await expect(umanthir.wiki[one](name as string)).rejects.toBeInstanceOf(ValidationError);
      expect(calls).toHaveLength(0);
    },
  );

  it("404 is NotFoundError", async () => {
    const { umanthir } = client(error(404, "Not found."));
    await expect(umanthir.wiki[one]("nope")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("503 is ServiceUnavailableError with reason wiki_unavailable", async () => {
    const { umanthir } = client(error(503, "Wiki data unavailable."));
    const err = await umanthir.wiki[list]().catch((e: unknown) => e);
    expect((err as ServiceUnavailableError).reason).toBe("wiki_unavailable");
  });
});
