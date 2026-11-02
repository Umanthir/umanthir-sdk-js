import { describe, expect, it } from "vitest";
import { Umanthir, type UmanthirWarning, ValidationError } from "../../src/index.js";
import { apiError, fakeFetch, json } from "./helpers.js";

const API = "https://api.umanthir.com";

function client(...replies: Parameters<typeof fakeFetch>) {
  const fake = fakeFetch(...replies);
  const warnings: UmanthirWarning[] = [];
  const umanthir = new Umanthir({
    fetch: fake.fetch,
    logLevel: "off",
    onWarning: (w) => warnings.push(w),
  });
  return { umanthir, calls: fake.calls, warnings };
}

const batch = { fetched_at: "2026-11-02T12:00:00Z", worlds: [], unknown: [], failed: [] };

describe("Tools routes", () => {
  const ROUTES: [string, (c: Umanthir) => Promise<unknown>, string][] = [
    ["online.character", (c) => c.online.character("Njorn"), "/v2/tools/online/Njorn"],
    [
      "shareExperience(level)",
      (c) => c.tools.shareExperience(500),
      "/v2/tools/experience/share/500",
    ],
    [
      "shareExperience(levels)",
      (c) => c.tools.shareExperience([100, 250, 500]),
      "/v2/tools/experience/share/100,250,500",
    ],
    [
      "vocationStatus",
      (c) => c.tools.vocationStatus("sorcerer", 400),
      "/v2/tools/vocationstatus/sorcerer/400",
    ],
    [
      "rawSkills",
      (c) => c.tools.rawSkills({ vocation: "knight", sword: "110,45.5", loyalty: 15 }),
      "/v2/tools/skills/raw?vocation=knight&sword=110%2C45.5&loyalty=15",
    ],
    ["exerciseWeapons", (c) => c.tools.exerciseWeapons(1000), "/v2/tools/exerciseweapons/1000"],
    [
      "experienceForLevel",
      (c) => c.tools.experienceForLevel(1000),
      "/v2/tools/experience/level/1000",
    ],
    [
      "levelForExperience(number)",
      (c) => c.tools.levelForExperience(123456789),
      "/v2/tools/experience/points/123456789",
    ],
    [
      "levelForExperience(bigint)",
      (c) => c.tools.levelForExperience(9223372036854775807n),
      "/v2/tools/experience/points/9223372036854775807",
    ],
    [
      "experienceGoal(level)",
      (c) => c.tools.experienceGoal(600, { level: 500 }),
      "/v2/tools/experience/goal/600?level=500",
    ],
    [
      "experienceGoal(experience)",
      (c) => c.tools.experienceGoal(600, { experience: 10n ** 12n }),
      "/v2/tools/experience/goal/600?experience=1000000000000",
    ],
  ];

  it.each(ROUTES)("%s → GET %s", async (_name, call, path) => {
    const body = { marker: path };
    const { umanthir, calls } = client(json(body));
    await expect(call(umanthir)).resolves.toEqual(body);
    expect(calls[0]?.init.method).toBe("GET");
    expect(calls[0]?.url).toBe(`${API}${path}`);
  });

  it("vocationStatus accepts any case", async () => {
    const { umanthir, calls } = client(json({}));
    await umanthir.tools.vocationStatus(" Druid " as "druid", 8);
    expect(calls[0]?.url).toBe(`${API}/v2/tools/vocationstatus/druid/8`);
  });
});

describe("online.list", () => {
  it("sends the worlds, fields and If-None-Match, and returns the ETag", async () => {
    const { umanthir, calls } = client(json(batch, 200, { etag: '"v2"' }));
    const res = await umanthir.online.list(["Antica", " Yonabra "], {
      fields: "names",
      ifNoneMatch: '"v1"',
    });
    expect(res).toEqual({ notModified: false, etag: '"v2"', data: batch });
    expect(calls[0]?.url).toBe(`${API}/v2/tools/online?worlds=Antica&worlds=Yonabra&fields=names`);
    expect((calls[0]?.init.headers as Record<string, string> | undefined)?.["If-None-Match"]).toBe(
      '"v1"',
    );
  });

  it("returns notModified on 304", async () => {
    const { umanthir, warnings } = client(
      new Response(null, { status: 304, headers: { etag: '"v1"' } }),
    );
    const res = await umanthir.online.list(["Antica"], { ifNoneMatch: '"v1"' });
    expect(res).toEqual({ notModified: true, etag: '"v1"', data: undefined });
    expect(warnings).toEqual([]);
  });

  it("warns about stale worlds, failed and unknown worlds", async () => {
    const body = {
      ...batch,
      worlds: [
        { name: "Antica", players_online: 0, updated_at: "x", stale: true, online: [] },
        { name: "Yonabra", players_online: 0, updated_at: "x", stale: false, online: [] },
      ],
      unknown: ["Atlantis"],
      failed: [{ name: "Secura", status_code: 503, message: "Upstream busy." }],
    };
    const { umanthir, warnings } = client(json(body));
    await umanthir.online.list(["Antica", "Yonabra", "Atlantis", "Secura"]);
    expect(warnings.map((w) => w.code)).toEqual(["STALE_DATA", "PARTIAL_FAILURE"]);
    expect(warnings[0]?.details).toEqual({ worlds: ["Antica"] });
    expect(warnings[1]?.message).toBe(
      "Some worlds have no online list: Secura (503), Atlantis (unknown).",
    );
  });

  it.each([
    ["empty list", [] as string[]],
    ["not an array", "Antica" as unknown as string[]],
    ["bad name", ["Ant/ica"]],
    ["more than 100 worlds", Array.from({ length: 101 }, (_, i) => `World${i}`)],
  ])("rejects %s without a request", async (_name, worlds) => {
    const { umanthir, calls } = client();
    await expect(umanthir.online.list(worlds)).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });

  it("counts duplicates once toward the 100-world limit", async () => {
    const { umanthir } = client(json(batch));
    const worlds = [...Array.from({ length: 100 }, (_, i) => `World${i}`), "world0", "WORLD1"];
    await expect(umanthir.online.list(worlds)).resolves.toMatchObject({ notModified: false });
  });
});

describe("tools.splitHunt", () => {
  const text = "Session data: ...\nAldor\n  Balance: 100\nBrom (Leader)\n  Balance: -50\n";

  it("POSTs the analyzer text as text/plain", async () => {
    const result = { members: [] };
    const { umanthir, calls } = client(json(result));
    await expect(umanthir.tools.splitHunt(text)).resolves.toEqual(result);
    expect(calls[0]?.url).toBe(`${API}/v2/tools/hunt/split`);
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.body).toBe(text);
    expect((calls[0]?.init.headers as Record<string, string> | undefined)?.["Content-Type"]).toBe(
      "text/plain; charset=utf-8",
    );
  });

  it("is never retried", async () => {
    const { umanthir, calls } = client(apiError(503, "Upstream busy."), json({}));
    await expect(umanthir.tools.splitHunt(text)).rejects.toMatchObject({ status: 503 });
    expect(calls).toHaveLength(1);
  });

  it("maps 400 Invalid hunt.", async () => {
    const { umanthir } = client(apiError(400, "Invalid hunt."));
    await expect(umanthir.tools.splitHunt(text)).rejects.toMatchObject({
      status: 400,
      apiMessage: "Invalid hunt.",
    });
  });

  it("rejects empty and oversized text without a request", async () => {
    const { umanthir, calls } = client();
    await expect(umanthir.tools.splitHunt("  ")).rejects.toBeInstanceOf(ValidationError);
    await expect(umanthir.tools.splitHunt("é".repeat(40_000))).rejects.toThrow("64 KB");
    expect(calls).toHaveLength(0);
  });

  it("never logs the analyzer text", async () => {
    const lines: string[] = [];
    const log = (...a: unknown[]) =>
      lines.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
    const fake = fakeFetch(json({}));
    const umanthir = new Umanthir({
      fetch: fake.fetch,
      debug: true,
      logBodies: true,
      logger: { debug: log, info: log, warn: log, error: log },
    });
    await umanthir.tools.splitHunt("Secret-Party-Member\n  Balance: 1\nOther\n  Balance: 2\n");
    expect(lines.join("\n")).not.toContain("Secret-Party-Member");
  });
});

describe("Tools validation (no request sent)", () => {
  const cases: [string, (c: Umanthir) => Promise<unknown>][] = [
    ["share level 0", (c) => c.tools.shareExperience(0)],
    ["share level 100001", (c) => c.tools.shareExperience(100_001)],
    ["share 101 levels", (c) => c.tools.shareExperience(Array.from({ length: 101 }, () => 10))],
    ["share no levels", (c) => c.tools.shareExperience([])],
    ["vocation promoted", (c) => c.tools.vocationStatus("elite knight" as "knight", 10)],
    ["vocation level 0", (c) => c.tools.vocationStatus("knight", 0)],
    ["charges 0", (c) => c.tools.exerciseWeapons(0)],
    ["level above max", (c) => c.tools.experienceForLevel(821_010)],
    ["experience negative", (c) => c.tools.levelForExperience(-1)],
    ["experience unsafe number", (c) => c.tools.levelForExperience(2 ** 60)],
    ["experience bigint too large", (c) => c.tools.levelForExperience(9223372036854775808n)],
    ["goal with both", (c) => c.tools.experienceGoal(600, { level: 1, experience: 1 } as never)],
    ["goal with neither", (c) => c.tools.experienceGoal(600, {} as never)],
    ["goal target 0", (c) => c.tools.experienceGoal(0, { level: 1 })],
    ["rawSkills without params", (c) => c.tools.rawSkills(null as never)],
    ["rawSkills control char", (c) => c.tools.rawSkills({ vocation: "knight", sword: "1\n0" })],
    ["online.character bad name", (c) => c.online.character("a&b")],
  ];

  it.each(cases)("%s", async (_name, call) => {
    const { umanthir, calls } = client();
    await expect(call(umanthir)).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });
});
