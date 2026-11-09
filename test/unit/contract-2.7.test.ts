import { describe, expect, it, vi } from "vitest";
import {
  AuthenticationError,
  ForbiddenError,
  GoneError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  Umanthir,
  ValidationError,
} from "../../src/index.js";
import { fakeFetch, json } from "./helpers.js";

const API = "https://api.umanthir.com";

function client(...replies: Parameters<typeof fakeFetch>) {
  const fake = fakeFetch(...replies);
  return {
    umanthir: new Umanthir({ fetch: fake.fetch, logLevel: "off", maxRetries: 0 }),
    calls: fake.calls,
  };
}

function error(status: number, message: string, extra: object = {}, code?: string): Response {
  return json({ error: { status_code: status, message, code }, ...extra }, status);
}

const SAVE = { time_zone: "UTC", time_until: { text: "1 hour, 0 minutes" } };

describe("tools.serverSave", () => {
  it.each([
    ["UTC", "/v2/tools/serversave/UTC"],
    ["America/Sao_Paulo", "/v2/tools/serversave/America/Sao_Paulo"],
    ["America/Argentina/Buenos_Aires", "/v2/tools/serversave/America/Argentina/Buenos_Aires"],
    ["Etc/GMT+3", "/v2/tools/serversave/Etc/GMT%2B3"],
  ])("%s → GET %s", async (zone, path) => {
    const { umanthir, calls } = client(json(SAVE));
    await expect(umanthir.tools.serverSave(zone)).resolves.toEqual(SAVE);
    expect(calls[0]?.url).toBe(API + path);
  });

  it.each([
    "",
    "../etc/passwd",
    "America//Sao_Paulo",
    "a/b/c/d",
    "America/Sao Paulo",
    "x".repeat(65),
    7,
    undefined,
  ])("rejects %j before any request", async (zone) => {
    const { umanthir, calls } = client();
    await expect(umanthir.tools.serverSave(zone as string)).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });

  it("an unknown zone is NotFoundError", async () => {
    const { umanthir } = client(error(404, "Time zone not found."));
    await expect(umanthir.tools.serverSave("Mars/Olympus")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("tools.splitHunt session", () => {
  it("passes the session through", async () => {
    const session = {
      date: "2026-10-24",
      start_time: "09:22:21",
      duration: "02:26",
      duration_minutes: 146,
    };
    const { umanthir } = client(json({ session, members: [] }));
    expect((await umanthir.tools.splitHunt("text")).session).toEqual(session);
  });
});

describe("wiki houses", () => {
  it("lists without filters", async () => {
    const { umanthir, calls } = client(json({ count: 0, houses: [] }));
    await umanthir.wiki.houses();
    expect(calls[0]?.url).toBe(`${API}/v2/wiki/houses`);
  });

  it("sends the filters", async () => {
    const { umanthir, calls } = client(json({ count: 0, houses: [] }));
    await umanthir.wiki.houses({ town: "Liberty Bay", guildhall: false });
    const url = new URL(calls[0]?.url as string);
    expect(url.searchParams.get("town")).toBe("Liberty Bay");
    expect(url.searchParams.get("guildhall")).toBe("false");
  });

  it("rejects a bad filter before any request", async () => {
    const { umanthir, calls } = client();
    await expect(umanthir.wiki.houses({ town: " " })).rejects.toBeInstanceOf(ValidationError);
    await expect(
      umanthir.wiki.houses({ guildhall: "yes" as unknown as boolean }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });

  it("gets the assembly JSON", async () => {
    const { umanthir, calls } = client(json({ format: "umanthir.house.v1" }));
    await expect(umanthir.wiki.house("thais-clanhall")).resolves.toEqual({
      format: "umanthir.house.v1",
    });
    expect(calls[0]?.url).toBe(`${API}/v2/wiki/houses/thais-clanhall`);
  });

  it.each(["", "Thais", "a--b", "-a", "a/b", "a b", "a".repeat(121), 7])(
    "rejects the slug %j before any request",
    async (slug) => {
      const { umanthir, calls } = client();
      await expect(umanthir.wiki.house(slug as string)).rejects.toBeInstanceOf(ValidationError);
      expect(calls).toHaveLength(0);
    },
  );

  it("gets the bytes of a floor, unchanged", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0x00]);
    const { umanthir, calls } = client(
      new Response(png, { status: 200, headers: { "content-type": "image/png" } }),
    );
    const got = await umanthir.wiki.houseFloor("thais-clanhall", 7);
    expect(got).toBeInstanceOf(Uint8Array);
    expect([...got]).toEqual([...png]);
    expect(calls[0]?.url).toBe(`${API}/v2/wiki/houses/thais-clanhall/floors/7`);
  });

  it("an empty floor is an error", async () => {
    const { umanthir } = client(new Response(new Uint8Array(), { status: 200 }));
    await expect(umanthir.wiki.houseFloor("a", 7)).rejects.toThrow("Empty response body");
  });

  it("a failed floor is still read as a JSON error", async () => {
    const { umanthir } = client(error(404, "Floor not found."));
    const failure = await umanthir.wiki.houseFloor("a", 1).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(NotFoundError);
    expect((failure as NotFoundError).apiMessage).toBe("Floor not found.");
  });

  it.each([-1, 16, 1.5, "7", undefined])("rejects the floor %j", async (z) => {
    const { umanthir, calls } = client();
    await expect(umanthir.wiki.houseFloor("a", z as number)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(calls).toHaveLength(0);
  });

  it("a renamed house is GoneError with the new slug", async () => {
    const { umanthir } = client(
      error(410, "House renamed.", { reason: "renamed", replaced_by: "b" }),
    );
    const failure = (await umanthir.wiki.house("a").catch((e: unknown) => e)) as GoneError;
    expect(failure).toBeInstanceOf(GoneError);
    expect(failure.reason).toBe("renamed");
    expect(failure.replacedBy).toBe("b");
  });

  it("a removed house has no new slug, and an unknown reason is unknown", async () => {
    const first = client(error(410, "House removed.", { reason: "removed" }));
    const removed = (await first.umanthir.wiki.house("a").catch((e: unknown) => e)) as GoneError;
    expect([removed.reason, removed.replacedBy]).toEqual(["removed", undefined]);
    const second = client(error(410, "Gone.", { reason: "other" }));
    const other = (await second.umanthir.wiki.house("a").catch((e: unknown) => e)) as GoneError;
    expect(other.reason).toBe("unknown");
  });

  it("houses unavailable has its own reason", async () => {
    const { umanthir } = client(error(503, "Houses data unavailable."));
    const failure = (await umanthir.wiki
      .houses()
      .catch((e: unknown) => e)) as ServiceUnavailableError;
    expect(failure).toBeInstanceOf(ServiceUnavailableError);
    expect(failure.reason).toBe("houses_unavailable");
  });
});

describe("token and site key errors", () => {
  it("401 is AuthenticationError and is not retried", async () => {
    const fake = fakeFetch(error(401, "Invalid token."), json({}));
    const umanthir = new Umanthir({ fetch: fake.fetch, logLevel: "off", maxRetries: 2 });
    await expect(umanthir.wiki.houses()).rejects.toBeInstanceOf(AuthenticationError);
    expect(fake.calls).toHaveLength(1);
  });

  it("403 is ForbiddenError with the code, and is not retried", async () => {
    const fake = fakeFetch(
      error(403, "This key is not allowed from this origin.", {}, "origin_not_allowed"),
      json({}),
    );
    const umanthir = new Umanthir({ fetch: fake.fetch, logLevel: "off", maxRetries: 2 });
    const failure = (await umanthir.wiki.houses().catch((e: unknown) => e)) as ForbiddenError;
    expect(failure).toBeInstanceOf(ForbiddenError);
    expect(failure.code).toBe("origin_not_allowed");
    expect(fake.calls).toHaveLength(1);
  });

  it("an error without a code has code undefined", async () => {
    const { umanthir } = client(error(404, "Not found."));
    const failure = (await umanthir.wiki.houses().catch((e: unknown) => e)) as NotFoundError;
    expect(failure.code).toBeUndefined();
  });

  it.each([
    ["Rate limit exceeded.", "rate_limit"],
    ["Rate limit exceeded for this IP.", "ip_limit"],
    ["Monthly quota exceeded.", "monthly_quota"],
    ["Daily quota exceeded.", "daily_quota"],
  ])("429 %s has reason %s", async (message, reason) => {
    const { umanthir } = client(error(429, message));
    const failure = (await umanthir.wiki.houses().catch((e: unknown) => e)) as RateLimitError;
    expect(failure).toBeInstanceOf(RateLimitError);
    expect(failure.reason).toBe(reason);
  });

  it("a used-up quota is not retried and does not wait", async () => {
    const fake = fakeFetch(
      new Response(
        JSON.stringify({ error: { status_code: 429, message: "Monthly quota exceeded." } }),
        {
          status: 429,
          headers: { "content-type": "application/json", "retry-after": "1900000" },
        },
      ),
      json({}),
    );
    const sleep = vi.spyOn(globalThis, "setTimeout");
    const umanthir = new Umanthir({ fetch: fake.fetch, logLevel: "off", maxRetries: 2 });
    const failure = (await umanthir.wiki.houses().catch((e: unknown) => e)) as RateLimitError;
    expect(failure.retryAfter).toBe(1_900_000);
    expect(fake.calls).toHaveLength(1);
    expect(sleep.mock.calls.filter(([, ms]) => ms === 1_900_000_000)).toHaveLength(0);
    sleep.mockRestore();
  });
});
