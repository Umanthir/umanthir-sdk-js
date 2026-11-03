import { describe, expectTypeOf, it } from "vitest";
import type {
  AchievementList,
  AchievementListOptions,
  BaseVocation,
  Bosses,
  Character,
  CharacterInfo,
  CreatureListOptions,
  Creatures,
  Death,
  ErrorBody,
  ExperienceGoalFrom,
  ExperienceTable,
  HighscoreCategory,
  HighscorePage,
  MapList,
  Online,
  OnlineBatch,
  RashidLocation,
  ShareExperience,
  SpellList,
  VocationStatus,
  WikiCategoryList,
  WikiItem,
  WikiItemList,
  WorldQuestList,
} from "../../src/index.js";

describe("public schema types", () => {
  it("Character keeps the API shape (snake_case, required deaths)", () => {
    expectTypeOf<Character["character_information"]>().toEqualTypeOf<CharacterInfo>();
    expectTypeOf<Character["deaths"]>().toEqualTypeOf<Death[]>();
  });

  it("ErrorBody is the API error envelope", () => {
    expectTypeOf<ErrorBody>().toEqualTypeOf<{ error: { message: string; status_code: number } }>();
  });

  it("enums become string unions", () => {
    expectTypeOf<"experience">().toExtend<HighscoreCategory>();
    expectTypeOf<"not-a-category">().not.toExtend<HighscoreCategory>();
  });

  it("schemas are not any", () => {
    expectTypeOf<HighscorePage>().not.toBeAny();
    expectTypeOf<OnlineBatch>().not.toBeAny();
  });
});

describe("client method types", () => {
  it("characters.get resolves to Character", async () => {
    const { Umanthir } = await import("../../src/index.js");
    const client = new Umanthir();
    expectTypeOf(client.characters.get).parameter(0).toEqualTypeOf<string>();
    expectTypeOf(client.characters.get).returns.toEqualTypeOf<Promise<Character>>();
  });
});

describe("Community method types", () => {
  it("return the contract schemas", async () => {
    const { Umanthir } = await import("../../src/index.js");
    type S = typeof import("../../src/index.js");
    const c = new Umanthir();
    expectTypeOf(c.highscores.list).returns.toEqualTypeOf<
      Promise<import("../../src/index.js").HighscorePage>
    >();
    expectTypeOf(c.highscores.character).returns.toEqualTypeOf<
      Promise<import("../../src/index.js").RankHit>
    >();
    expectTypeOf(c.worlds.list).returns.toEqualTypeOf<
      Promise<import("../../src/index.js").WorldList>
    >();
    expectTypeOf(c.worlds.get).returns.toEqualTypeOf<
      Promise<import("../../src/index.js").WorldDetail>
    >();
    expectTypeOf(c.drome.rotations()).toEqualTypeOf<
      Promise<import("../../src/index.js").Rotations>
    >();
    expectTypeOf(c.drome.rotations("Antica")).toEqualTypeOf<
      Promise<import("../../src/index.js").DromeRank>
    >();
    expectTypeOf(c.killStatistics.get).returns.toEqualTypeOf<
      Promise<import("../../src/index.js").KillStatistics>
    >();
    expectTypeOf(c.fansites.list).returns.toEqualTypeOf<
      Promise<import("../../src/index.js").Fansites>
    >();
    expectTypeOf(c.guilds.list).returns.toEqualTypeOf<
      Promise<import("../../src/index.js").GuildList>
    >();
    expectTypeOf(c.guilds.get).returns.toEqualTypeOf<
      Promise<import("../../src/index.js").GuildDetail>
    >();
    expectTypeOf(c.polls.list).returns.toEqualTypeOf<Promise<import("../../src/index.js").Polls>>();
    expectTypeOf(c.houses.list).returns.toEqualTypeOf<
      Promise<import("../../src/index.js").HouseList>
    >();
    expectTypeOf(c.houses.get).returns.toEqualTypeOf<
      Promise<import("../../src/index.js").HouseDetail>
    >();
    expectTypeOf<S>().not.toBeAny();
  });

  it("filters use the contract enums", () => {
    type HL = import("../../src/index.js").HighscoreListOptions;
    expectTypeOf<{ vocation: "sorcerers" }>().toExtend<HL>();
    expectTypeOf<{ vocation: "wizards" }>().not.toExtend<HL>();
    expectTypeOf<{ "types[]": ["pvp"] }>().not.toExtend<HL>();
    type HO = import("../../src/index.js").HouseListOptions;
    expectTypeOf<{ state: "rented"; type: "houses"; order: "rent" }>().toExtend<HO>();
    expectTypeOf<{ order: "price" }>().not.toExtend<HO>();
  });
});

describe("Library method types", () => {
  it("return the contract schemas", async () => {
    const { Umanthir } = await import("../../src/index.js");
    type M = typeof import("../../src/index.js");
    const c = new Umanthir();
    expectTypeOf(c.library.achievements).returns.toEqualTypeOf<Promise<AchievementList>>();
    expectTypeOf(c.library.boostableBosses).returns.toEqualTypeOf<Promise<Bosses>>();
    expectTypeOf(c.library.creatures).returns.toEqualTypeOf<Promise<Creatures>>();
    expectTypeOf(c.library.experienceTable).returns.toEqualTypeOf<Promise<ExperienceTable>>();
    expectTypeOf(c.library.maps).returns.toEqualTypeOf<Promise<MapList>>();
    expectTypeOf(c.library.spells).returns.toEqualTypeOf<Promise<SpellList>>();
    expectTypeOf(c.library.worldQuests).returns.toEqualTypeOf<Promise<WorldQuestList>>();
    expectTypeOf<M>().not.toBeAny();
  });

  it("filters use the contract parameter types", () => {
    expectTypeOf<{ grade: number }>().toExtend<AchievementListOptions>();
    expectTypeOf<{ grade: string }>().not.toExtend<AchievementListOptions>();
    expectTypeOf<{ creature_race: number }>().not.toExtend<CreatureListOptions>();
  });
});

describe("Tools method types", () => {
  it("return the contract schemas", async () => {
    const { Umanthir } = await import("../../src/index.js");
    type I = typeof import("../../src/index.js");
    const c = new Umanthir();
    expectTypeOf(c.online.character).returns.toEqualTypeOf<Promise<Online>>();
    expectTypeOf(c.tools.shareExperience).returns.toEqualTypeOf<Promise<ShareExperience>>();
    expectTypeOf(c.tools.vocationStatus).returns.toEqualTypeOf<Promise<VocationStatus>>();
    expectTypeOf(c.tools.splitHunt).parameter(0).toEqualTypeOf<string>();
    expectTypeOf(c.tools.levelForExperience).parameter(0).toEqualTypeOf<number | bigint>();
    expectTypeOf<I>().not.toBeAny();
  });

  it("online.list narrows on notModified", async () => {
    const { Umanthir } = await import("../../src/index.js");
    const res = await new Umanthir().online.list(["Antica"]);
    if (!res.notModified) expectTypeOf(res.data).toEqualTypeOf<OnlineBatch>();
    else expectTypeOf(res.data).toEqualTypeOf<undefined>();
  });

  it("vocation and goal inputs are constrained", () => {
    expectTypeOf<"monk">().toExtend<BaseVocation>();
    expectTypeOf<"elite knight">().not.toExtend<BaseVocation>();
    expectTypeOf<{ level: 1 }>().toExtend<ExperienceGoalFrom>();
    expectTypeOf<{ experience: 1n }>().toExtend<ExperienceGoalFrom>();
    expectTypeOf<{ level: 1; experience: 1 }>().not.toExtend<ExperienceGoalFrom>();
  });
});

describe("Wiki method types", () => {
  it("return the contract schemas", async () => {
    const { Umanthir } = await import("../../src/index.js");
    const c = new Umanthir();
    expectTypeOf(c.wiki.rashidLocation).returns.toEqualTypeOf<Promise<RashidLocation>>();
    expectTypeOf(c.wiki.categories).returns.toEqualTypeOf<Promise<WikiCategoryList>>();
    expectTypeOf(c.wiki.list).returns.toEqualTypeOf<Promise<WikiItemList>>();
    expectTypeOf(c.wiki.get).returns.toEqualTypeOf<Promise<WikiItem>>();
  });
});
