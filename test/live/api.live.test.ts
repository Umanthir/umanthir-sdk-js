// Calls the real Umanthir API. Run by the scheduled "Live API" workflow, never on pull requests:
//   npm run test:live
import { describe, expect, it } from "vitest";
import { SUPPORTED_API_MAJOR, Umanthir, type UmanthirWarning } from "../../src/index.js";

const warnings: UmanthirWarning[] = [];
const client = new Umanthir({ maxRetries: 2, timeout: 30_000, onWarning: (w) => warnings.push(w) });

describe("live: Umanthir API", () => {
  it("characters.get returns a profile", async () => {
    const character = await client.characters.get("Njorn");
    expect(character.character_information.name.toLowerCase()).toBe("njorn");
    expect(Array.isArray(character.deaths)).toBe(true);
  });

  it("worlds.list returns worlds", async () => {
    const worlds = await client.worlds.list();
    expect(JSON.stringify(worlds).length).toBeGreaterThan(100);
  });

  it("highscores.list returns a ranking page", async () => {
    const page = await client.highscores.list({ category: "experience" });
    expect(JSON.stringify(page)).toContain("level");
  });

  it("tools.serverSave returns the countdown", async () => {
    const save = await client.tools.serverSave("America/Sao_Paulo");
    expect(save.time_zone).toBe("America/Sao_Paulo");
    expect(save.time_until.text).toMatch(/^\d+ hours?, \d+ minutes?$/);
  });

  it("wiki.houses, wiki.house and wiki.houseFloor return a published house", async () => {
    const { houses } = await client.wiki.houses();
    const first = houses[0];
    expect(first).toBeDefined();
    const house = first as (typeof houses)[number];
    expect(await client.wiki.house(house.slug)).toHaveProperty("format", "umanthir.house.v1");
    const floor = house.floors[0] as (typeof house.floors)[number];
    const png = await client.wiki.houseFloor(house.slug, floor.z);
    expect([...png.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("the API major version is the supported one", () => {
    expect(warnings.filter((w) => w.code === "API_VERSION_MISMATCH")).toEqual([]);
    expect(SUPPORTED_API_MAJOR).toBe(2);
  });
});
