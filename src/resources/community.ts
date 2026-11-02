import type { RequestOptions } from "../core/transport.js";
import { pathName, positiveInt } from "../core/validate.js";
import type { operations } from "../generated/openapi.js";
import type {
  DromeRank,
  Fansites,
  GuildDetail,
  GuildList,
  HighscorePage,
  HouseDetail,
  HouseList,
  KillStatistics,
  Polls,
  RankHit,
  Rotations,
  WorldDetail,
  WorldList,
} from "../generated/schemas.js";
import { Resource, seg } from "./base.js";

type Query<K extends keyof operations> = NonNullable<operations[K]["parameters"]["query"]>;

/** Filters of the highscores list (`types[]` is the legacy spelling of `types`, not exposed). */
export type HighscoreListOptions = Omit<Query<"getHighscores">, "types[]">;
/** Filters of a character's highscore position (same filters as the list, without `page`). */
export type CharacterHighscoreOptions = Omit<Query<"getCharacterHighscore">, "types[]">;
/** Filters of the house list of a town. */
export type HouseListOptions = Query<"getHouses">;
/** Page of the poll list. */
export type PollListOptions = Query<"getPolls">;

const world = (value: string): string => pathName("World", value, { strict: true });

function pageOf(value: number | undefined): number | undefined {
  return value === undefined ? undefined : positiveInt("page", value);
}

/** Community: highscores. */
export class HighscoresResource extends Resource {
  /**
   * One page of the highscores, with optional filters.
   *
   * @example
   * ```ts
   * const page = await client.highscores.list({ world: "Antica", category: "magiclevel", vocation: "sorcerers" });
   * ```
   */
  public async list(
    filters: HighscoreListOptions = {},
    options?: RequestOptions,
  ): Promise<HighscorePage> {
    const { page, world: w, ...rest } = filters;
    return this.call<HighscorePage>("/v2/community/highscores", options, {
      ...rest,
      world: w === undefined ? undefined : world(w),
      page: pageOf(page),
    });
  }

  /**
   * A character's position in the top 1000 of the filtered ranking.
   *
   * @throws {NotFoundError} when the character is outside the top 1000.
   */
  public async character(
    name: string,
    filters: CharacterHighscoreOptions = {},
    options?: RequestOptions,
  ): Promise<RankHit> {
    const value = pathName("Character name", name);
    const { world: w, ...rest } = filters;
    return this.call<RankHit>(`/v2/community/highscores/character/${seg(value)}`, options, {
      ...rest,
      world: w === undefined ? undefined : world(w),
    });
  }
}

/** Community: game worlds. */
export class WorldsResource extends Resource {
  /** All game worlds, with players online and records. */
  public async list(options?: RequestOptions): Promise<WorldList> {
    return this.call<WorldList>("/v2/community/worlds", options);
  }

  /**
   * Details of one world, with who is online.
   *
   * @throws {NotFoundError} when the world does not exist.
   */
  public async get(name: string, options?: RequestOptions): Promise<WorldDetail> {
    return this.call<WorldDetail>("/v2/community/worlds", options, { world: world(name) });
  }
}

/** Community: Tibiadrome. */
export class DromeResource extends Resource {
  /** Current and past Tibiadrome rotations. */
  public rotations(options?: RequestOptions): Promise<Rotations>;
  /** Tibiadrome ranking of a world, optionally a given page. */
  public rotations(worldName: string, page?: number, options?: RequestOptions): Promise<DromeRank>;
  public async rotations(
    worldOrOptions?: string | RequestOptions,
    page?: number,
    options?: RequestOptions,
  ): Promise<Rotations | DromeRank> {
    if (typeof worldOrOptions !== "string") {
      return this.call<Rotations>("/v2/community/drome/rotations", worldOrOptions);
    }
    const path = `/v2/community/drome/rotations/${seg(world(worldOrOptions))}`;
    if (page === undefined) return this.call<DromeRank>(path, options);
    return this.call<DromeRank>(`${path}/${seg(positiveInt("page", page))}`, options);
  }
}

/** Community: kill statistics. */
export class KillStatisticsResource extends Resource {
  /** Creatures killed and players killed by creatures in a world (last day and last week). */
  public async get(worldName: string, options?: RequestOptions): Promise<KillStatistics> {
    return this.call<KillStatistics>(
      `/v2/community/killstatistics/${seg(world(worldName))}`,
      options,
    );
  }
}

/** Community: fansites. */
export class FansitesResource extends Resource {
  /** Promoted and supported fansites. */
  public async list(options?: RequestOptions): Promise<Fansites> {
    return this.call<Fansites>("/v2/community/fansites", options);
  }
}

/** Community: guilds. */
export class GuildsResource extends Resource {
  /**
   * Active guilds and guilds in formation of a world.
   *
   * @throws {NotFoundError} when tibia.com does not know the world.
   */
  public async list(worldName: string, options?: RequestOptions): Promise<GuildList> {
    return this.call<GuildList>(`/v2/community/guilds/${seg(world(worldName))}`, options);
  }

  /**
   * Guild details, with members and invites.
   *
   * @param name Guild name (case-insensitive). `/ \ ? # & %` are rejected.
   * @throws {NotFoundError} when the guild does not exist.
   */
  public async get(name: string, options?: RequestOptions): Promise<GuildDetail> {
    const value = pathName("Guild name", name, { strict: true });
    return this.call<GuildDetail>(`/v2/community/guild/${seg(value)}`, options);
  }
}

/** Community: polls. */
export class PollsResource extends Resource {
  /** Active polls and one page of closed polls. */
  public async list(filters: PollListOptions = {}, options?: RequestOptions): Promise<Polls> {
    return this.call<Polls>("/v2/community/polls", options, { page: pageOf(filters.page) });
  }
}

/** Community: houses and guildhalls. */
export class HousesResource extends Resource {
  /**
   * Houses (or guildhalls) of a town, with status and auctions.
   *
   * @example
   * ```ts
   * const houses = await client.houses.list("Antica", "Thais", { state: "auctioned" });
   * ```
   */
  public async list(
    worldName: string,
    town: string,
    filters: HouseListOptions = {},
    options?: RequestOptions,
  ): Promise<HouseList> {
    const t = pathName("Town", town, { strict: true });
    return this.call<HouseList>(
      `/v2/community/houses/${seg(world(worldName))}/${seg(t)}`,
      options,
      {
        ...filters,
      },
    );
  }

  /**
   * Details of one house, with the current auction or rental.
   *
   * @throws {NotFoundError} when the house does not exist.
   */
  public async get(
    worldName: string,
    houseId: number,
    options?: RequestOptions,
  ): Promise<HouseDetail> {
    const id = positiveInt("houseId", houseId);
    return this.call<HouseDetail>(
      `/v2/community/houses/${seg(world(worldName))}/house/${seg(id)}`,
      options,
    );
  }
}
