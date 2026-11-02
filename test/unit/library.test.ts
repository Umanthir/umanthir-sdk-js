import { describe, expect, it } from "vitest";
import { Umanthir, UpstreamError, ValidationError } from "../../src/index.js";
import { apiError, fakeFetch, json } from "./helpers.js";

const API = "https://api.umanthir.com";

function client(...replies: Parameters<typeof fakeFetch>) {
  const fake = fakeFetch(...replies);
  return {
    umanthir: new Umanthir({ fetch: fake.fetch, logLevel: "off", maxRetries: 0 }),
    calls: fake.calls,
  };
}

const ROUTES: [string, (c: Umanthir) => Promise<unknown>, string][] = [
  ["achievements()", (c) => c.library.achievements(), "/v2/library/achievements"],
  [
    "achievements({ grade })",
    (c) => c.library.achievements({ grade: 3 }),
    "/v2/library/achievements?grade=3",
  ],
  ["boostableBosses()", (c) => c.library.boostableBosses(), "/v2/library/boostablebosses"],
  ["creatures()", (c) => c.library.creatures(), "/v2/library/creatures"],
  [
    "creatures({ creature_race })",
    (c) => c.library.creatures({ creature_race: "demon" }),
    "/v2/library/creatures?creature_race=demon",
  ],
  ["experienceTable()", (c) => c.library.experienceTable(), "/v2/library/experiencetable"],
  ["maps()", (c) => c.library.maps(), "/v2/library/maps"],
  ["maps({ region })", (c) => c.library.maps({ region: "thais" }), "/v2/library/maps?region=thais"],
  ["spells()", (c) => c.library.spells(), "/v2/library/spells"],
  [
    "spells({ spell })",
    (c) => c.library.spells({ spell: "animatedeadrune" }),
    "/v2/library/spells?spell=animatedeadrune",
  ],
  ["worldQuests()", (c) => c.library.worldQuests(), "/v2/library/worldquests"],
  [
    "worldQuests({ worldquest })",
    (c) => c.library.worldQuests({ worldquest: "A Piece of Cake" }),
    "/v2/library/worldquests?worldquest=A+Piece+of+Cake",
  ],
];

describe("Library routes", () => {
  it.each(ROUTES)("%s → GET %s", async (_name, call, path) => {
    const body = { marker: path };
    const { umanthir, calls } = client(json(body));
    await expect(call(umanthir)).resolves.toEqual(body);
    expect(calls[0]?.url).toBe(`${API}${path}`);
  });

  it("normalizes NBSP and trims text filters", async () => {
    const { umanthir, calls } = client(json({}));
    await umanthir.library.creatures({ creature_race: " dragon lord " });
    expect(calls[0]?.url).toBe(`${API}/v2/library/creatures?creature_race=dragon+lord`);
  });
});

describe("Library validation (no request sent)", () => {
  const cases: [string, (c: Umanthir) => Promise<unknown>][] = [
    ["grade 0", (c) => c.library.achievements({ grade: 0 })],
    ["grade 5", (c) => c.library.achievements({ grade: 5 })],
    ["grade 2.5", (c) => c.library.achievements({ grade: 2.5 })],
    ["region with space", (c) => c.library.maps({ region: "liberty bay" })],
    ["region too long", (c) => c.library.maps({ region: "a".repeat(81) })],
    ["empty spell", (c) => c.library.spells({ spell: " " })],
    ["race with control char", (c) => c.library.creatures({ creature_race: "dem\u0000on" })],
    ["quest with %", (c) => c.library.worldQuests({ worldquest: "100% Quest" })],
    ["non-string spell", (c) => c.library.spells({ spell: 1 as unknown as string })],
  ];

  it.each(cases)("%s", async (_name, call) => {
    const { umanthir, calls } = client();
    await expect(call(umanthir)).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });
});

describe("Library errors", () => {
  it.each([502, 520])("%i → UpstreamError", async (status) => {
    const { umanthir } = client(apiError(status, "Upstream request failed."));
    const error = await umanthir.library.boostableBosses().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error).toMatchObject({ status, apiMessage: "Upstream request failed." });
  });

  it("400 Invalid grade. → BadRequestError", async () => {
    const { umanthir } = client(apiError(400, "Invalid grade."));
    await expect(umanthir.library.achievements()).rejects.toMatchObject({
      status: 400,
      apiMessage: "Invalid grade.",
    });
  });
});
