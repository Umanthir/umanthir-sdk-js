import type { RequestOptions } from "../core/transport.js";
import { intInRange, pathName, queryText } from "../core/validate.js";
import { ValidationError } from "../errors.js";
import type { operations } from "../generated/openapi.js";
import type {
  AchievementList,
  Bosses,
  Creatures,
  ExperienceTable,
  MapList,
  SpellList,
  WorldQuestList,
} from "../generated/schemas.js";
import { Resource } from "./base.js";

type Query<K extends keyof operations> = NonNullable<operations[K]["parameters"]["query"]>;

/** Filter of the achievements list. */
export type AchievementListOptions = Query<"getAchievements">;
/** Filter of the creatures list. */
export type CreatureListOptions = Query<"getCreatures">;
/** Filter of the map areas. */
export type MapListOptions = Query<"getMaps">;
/** Filter of the spells list. */
export type SpellListOptions = Query<"getSpells">;
/** Filter of the world quests. */
export type WorldQuestListOptions = Query<"getWorldQuests">;

const REGION = /^[A-Za-z0-9]{1,80}$/;

/** Library: achievements, bosses, creatures, experience table, maps, spells and world quests. */
export class LibraryResource extends Resource {
  /**
   * Achievements, optionally only one grade (1 to 4).
   *
   * @example
   * ```ts
   * const { achievements } = await client.library.achievements({ grade: 3 });
   * ```
   */
  public async achievements(
    filters: AchievementListOptions = {},
    options?: RequestOptions,
  ): Promise<AchievementList> {
    const grade =
      filters.grade === undefined ? undefined : intInRange("grade", filters.grade, 1, 4);
    return this.call<AchievementList>("/v2/library/achievements", options, { grade });
  }

  /** Boostable bosses and today's boosted boss. */
  public async boostableBosses(options?: RequestOptions): Promise<Bosses> {
    return this.call<Bosses>("/v2/library/boostablebosses", options);
  }

  /** Creatures and today's boosted creature; with `creature_race`, that race's page. */
  public async creatures(
    filters: CreatureListOptions = {},
    options?: RequestOptions,
  ): Promise<Creatures> {
    const race =
      filters.creature_race === undefined
        ? undefined
        : queryText("creature_race", filters.creature_race);
    return this.call<Creatures>("/v2/library/creatures", options, { creature_race: race });
  }

  /** Experience needed for each level. */
  public async experienceTable(options?: RequestOptions): Promise<ExperienceTable> {
    return this.call<ExperienceTable>("/v2/library/experiencetable", options);
  }

  /** Map areas; with `region` (slug such as `thais`), the details of one. */
  public async maps(filters: MapListOptions = {}, options?: RequestOptions): Promise<MapList> {
    let region: string | undefined;
    if (filters.region !== undefined) {
      region = queryText("region", filters.region, 80);
      if (!REGION.test(region))
        throw new ValidationError("region must contain only letters and digits.");
    }
    return this.call<MapList>("/v2/library/maps", options, { region });
  }

  /** Spells; with `spell` (slug such as `animatedeadrune`), that spell's page. */
  public async spells(
    filters: SpellListOptions = {},
    options?: RequestOptions,
  ): Promise<SpellList> {
    const spell = filters.spell === undefined ? undefined : queryText("spell", filters.spell);
    return this.call<SpellList>("/v2/library/spells", options, { spell });
  }

  /** World quests; with `worldquest` (name such as `A Piece of Cake`), the details of one. */
  public async worldQuests(
    filters: WorldQuestListOptions = {},
    options?: RequestOptions,
  ): Promise<WorldQuestList> {
    const quest =
      filters.worldquest === undefined
        ? undefined
        : pathName("worldquest", filters.worldquest, { strict: true });
    return this.call<WorldQuestList>("/v2/library/worldquests", options, { worldquest: quest });
  }
}
