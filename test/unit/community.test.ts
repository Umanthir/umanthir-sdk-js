import { describe, expect, it } from "vitest";
import { NotFoundError, Umanthir, ValidationError } from "../../src/index.js";
import { apiError, fakeFetch, json } from "./helpers.js";

const API = "https://api.umanthir.com";

function client(...replies: Parameters<typeof fakeFetch>) {
  const fake = fakeFetch(...replies);
  return { umanthir: new Umanthir({ fetch: fake.fetch, logLevel: "off" }), calls: fake.calls };
}

type Call = [string, (c: Umanthir) => Promise<unknown>, string];

const ROUTES: Call[] = [
  ["characters.get", (c) => c.characters.get("Njorn"), "/v2/community/characters/Njorn"],
  ["highscores.list()", (c) => c.highscores.list(), "/v2/community/highscores"],
  [
    "highscores.list(filters)",
    (c) =>
      c.highscores.list({
        world: "Antica",
        category: "magiclevel",
        vocation: "sorcerers",
        protection: "optional",
        types: ["pvp", "retro_pvp"],
        page: 3,
      }),
    "/v2/community/highscores?category=magiclevel&vocation=sorcerers&protection=optional&types=pvp&types=retro_pvp&world=Antica&page=3",
  ],
  [
    "highscores.character",
    (c) => c.highscores.character("Njorn", { world: "Antica", category: "experience" }),
    "/v2/community/highscores/character/Njorn?category=experience&world=Antica",
  ],
  ["worlds.list", (c) => c.worlds.list(), "/v2/community/worlds"],
  ["worlds.get", (c) => c.worlds.get("Antica"), "/v2/community/worlds?world=Antica"],
  ["drome.rotations()", (c) => c.drome.rotations(), "/v2/community/drome/rotations"],
  [
    "drome.rotations(world)",
    (c) => c.drome.rotations("Antica"),
    "/v2/community/drome/rotations/Antica",
  ],
  [
    "drome.rotations(world, page)",
    (c) => c.drome.rotations("Antica", 2),
    "/v2/community/drome/rotations/Antica/2",
  ],
  [
    "killStatistics.get",
    (c) => c.killStatistics.get("Antica"),
    "/v2/community/killstatistics/Antica",
  ],
  ["fansites.list", (c) => c.fansites.list(), "/v2/community/fansites"],
  ["guilds.list", (c) => c.guilds.list("Antica"), "/v2/community/guilds/Antica"],
  ["guilds.get", (c) => c.guilds.get("Alanui Institute"), "/v2/community/guild/Alanui%20Institute"],
  ["polls.list()", (c) => c.polls.list(), "/v2/community/polls"],
  ["polls.list(page)", (c) => c.polls.list({ page: 2 }), "/v2/community/polls?page=2"],
  [
    "houses.list",
    (c) => c.houses.list("Antica", "Liberty Bay"),
    "/v2/community/houses/Antica/Liberty%20Bay",
  ],
  [
    "houses.list(filters)",
    (c) =>
      c.houses.list("Antica", "Thais", { state: "auctioned", type: "guildhalls", order: "bid" }),
    "/v2/community/houses/Antica/Thais?state=auctioned&type=guildhalls&order=bid",
  ],
  ["houses.get", (c) => c.houses.get("Antica", 10301), "/v2/community/houses/Antica/house/10301"],
];

describe("Community routes", () => {
  it.each(ROUTES)("%s → GET %s", async (_name, call, path) => {
    const body = { marker: path };
    const { umanthir, calls } = client(json(body));
    await expect(call(umanthir)).resolves.toEqual(body);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.init.method).toBe("GET");
    expect(calls[0]?.url).toBe(`${API}${path}`);
  });

  it("passes per-call options through every resource", async () => {
    const { umanthir, calls } = client(apiError(503, "Upstream busy."));
    await expect(umanthir.drome.rotations({ maxRetries: 0 })).rejects.toMatchObject({
      status: 503,
    });
    expect(calls).toHaveLength(1);
  });

  it("drome.rotations(world, undefined, options) uses the world route", async () => {
    const { umanthir, calls } = client(json({}));
    await umanthir.drome.rotations("Antica", undefined, { timeout: 5000 });
    expect(calls[0]?.url).toBe(`${API}/v2/community/drome/rotations/Antica`);
  });
});

describe("Community validation (no request sent)", () => {
  const cases: [string, (c: Umanthir) => Promise<unknown>][] = [
    ["world with %", (c) => c.guilds.list("Ant%ica")],
    ["world with /", (c) => c.killStatistics.get("a/b")],
    ["guild with %", (c) => c.guilds.get("100% Guild")],
    ["town with ?", (c) => c.houses.list("Antica", "Thais?")],
    ["house id 0", (c) => c.houses.get("Antica", 0)],
    ["house id 1.5", (c) => c.houses.get("Antica", 1.5)],
    ["drome page 0", (c) => c.drome.rotations("Antica", 0)],
    ["highscore page 0", (c) => c.highscores.list({ page: 0 })],
    ["highscore world with &", (c) => c.highscores.list({ world: "a&b" })],
    ["character highscore world with #", (c) => c.highscores.character("Njorn", { world: "a#b" })],
    ["character highscore bad name", (c) => c.highscores.character("a/b")],
    ["poll page -1", (c) => c.polls.list({ page: -1 })],
    ["empty world", (c) => c.worlds.get(" ")],
  ];

  it.each(cases)("%s", async (_name, call) => {
    const { umanthir, calls } = client();
    await expect(call(umanthir)).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });
});

describe("invalid input rejects the promise (never throws synchronously)", () => {
  it("works with .then().catch()", async () => {
    const { umanthir } = client();
    let caught: unknown;
    const run = () =>
      umanthir.guilds
        .get("a/b")
        .then(() => undefined)
        .catch((e: unknown) => {
          caught = e;
        });
    expect(run).not.toThrow();
    await run();
    expect(caught).toBeInstanceOf(ValidationError);
  });
});

describe("Community errors from the API", () => {
  it.each([
    ["guilds.list", (c: Umanthir) => c.guilds.list("Nowhere"), "Guilds data not found!"],
    ["houses.get", (c: Umanthir) => c.houses.get("Antica", 99999), "Houses data not found!"],
    ["worlds.get", (c: Umanthir) => c.worlds.get("Nowhere"), "Worlds' data not found!"],
    ["highscores.character", (c: Umanthir) => c.highscores.character("Nobody"), "Not found."],
  ])("%s → NotFoundError with the API message", async (_name, call, message) => {
    const { umanthir } = client(apiError(404, message));
    const error = await call(umanthir).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ apiMessage: message });
  });

  it("unknown filter → BadRequestError", async () => {
    const { umanthir } = client(apiError(400, "Unknown vocation."));
    await expect(umanthir.highscores.list({ vocation: "knights" })).rejects.toMatchObject({
      status: 400,
      apiMessage: "Unknown vocation.",
    });
  });
});
