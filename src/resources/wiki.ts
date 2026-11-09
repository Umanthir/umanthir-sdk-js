import type { RequestOptions } from "../core/transport.js";
import { intInRange, pathName, queryText } from "../core/validate.js";
import { ValidationError } from "../errors.js";
import type {
  ClientHouseList,
  RashidLocation,
  WikiCategoryList,
  WikiItem,
  WikiItemList,
} from "../generated/schemas.js";
import { Resource, seg } from "./base.js";

const SLUG = /^[A-Za-z0-9_-]{1,60}$/;
const HOUSE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Filters of {@link WikiResource.houses}. */
export interface WikiHouseListOptions {
  /** Town name, case-insensitive. */
  town?: string | undefined;
  /** `true` lists only guildhalls; `false`, only houses. */
  guildhall?: boolean | undefined;
}

/** Assembly JSON of a house (format `umanthir.house.v1`), as the contract leaves it open. */
export type HouseAssembly = Record<string, unknown>;

function houseSlug(value: unknown): string {
  if (typeof value !== "string" || value.length > 120 || !HOUSE_SLUG.test(value)) {
    throw new ValidationError(
      "slug must be a house slug from wiki.houses(), such as thais-clanhall.",
    );
  }
  return value;
}

function slug(category: unknown): string {
  if (typeof category !== "string" || !SLUG.test(category.trim())) {
    throw new ValidationError("category must be a slug from wiki.categories(), such as axes.");
  }
  return category.trim();
}

/** Wiki: data from TibiaWiki BR (texts in Portuguese). */
export class WikiResource extends Resource {
  /** City where Rashid is today. */
  public async rashidLocation(options?: RequestOptions): Promise<RashidLocation> {
    return this.call<RashidLocation>("/v2/wiki/rashid/location", options);
  }

  /** Item categories, with their slugs, names and groups. */
  public async categories(options?: RequestOptions): Promise<WikiCategoryList> {
    return this.call<WikiCategoryList>("/v2/wiki/categories", options);
  }

  /**
   * Houses published from the Tibia game client, with links to their assembly JSON and floors.
   *
   * @throws {ServiceUnavailableError} with `reason: "houses_unavailable"` when the data is unavailable.
   *
   * @example
   * ```ts
   * const { houses } = await client.wiki.houses({ town: "Thais", guildhall: false });
   * ```
   */
  public async houses(
    filters: WikiHouseListOptions = {},
    options?: RequestOptions,
  ): Promise<ClientHouseList> {
    const query: Record<string, string | undefined> = {};
    if (filters.town !== undefined) query["town"] = queryText("town", filters.town);
    if (filters.guildhall !== undefined) {
      if (typeof filters.guildhall !== "boolean") {
        throw new ValidationError("guildhall must be a boolean.");
      }
      query["guildhall"] = String(filters.guildhall);
    }
    return this.call<ClientHouseList>("/v2/wiki/houses", options, query);
  }

  /**
   * Assembly JSON of a house: its squares, objects and the position of each sprite in the floors.
   *
   * @param slug Slug from {@link WikiResource.houses}.
   * @throws {NotFoundError} when no such house exists.
   * @throws {GoneError} when the house left the client; a renamed one has its slug in `replacedBy`.
   */
  public async house(slug: string, options?: RequestOptions): Promise<HouseAssembly> {
    return this.call<HouseAssembly>(`/v2/wiki/houses/${seg(houseSlug(slug))}`, options);
  }

  /**
   * Transparent PNG of one floor of a house.
   *
   * @param slug Slug from {@link WikiResource.houses}.
   * @param z Floor from 0 to 15; 7 is the ground floor.
   * @returns The PNG bytes.
   * @throws {NotFoundError} when the house has no such floor.
   * @throws {GoneError} when the house left the client.
   */
  public async houseFloor(slug: string, z: number, options?: RequestOptions): Promise<Uint8Array> {
    const s = houseSlug(slug);
    const floor = intInRange("z", z, 0, 15);
    const response = await this.send<Uint8Array>({
      method: "GET",
      path: `/v2/wiki/houses/${seg(s)}/floors/${seg(floor)}`,
      binary: true,
      options,
    });
    return response.data as Uint8Array;
  }

  /**
   * Items of a category.
   *
   * @param category Slug from {@link WikiResource.categories}, such as `axes`.
   * @throws {NotFoundError} for an unknown category.
   * @throws {ServiceUnavailableError} with `reason: "wiki_unavailable"` when the wiki data is unavailable.
   */
  public async list(category: string, options?: RequestOptions): Promise<WikiItemList> {
    return this.call<WikiItemList>(`/v2/wiki/${seg(slug(category))}`, options);
  }

  /**
   * One item, with everything the wiki says.
   *
   * @param name Item name, case-insensitive (`hellforged axe`), up to 200 characters.
   * @throws {NotFoundError} when the item is not in that category.
   *
   * @example
   * ```ts
   * const axe = await client.wiki.get("axes", "hellforged axe");
   * ```
   */
  public async get(category: string, name: string, options?: RequestOptions): Promise<WikiItem> {
    const c = slug(category);
    const n = pathName("Item name", name, { anyText: true, max: 200 });
    return this.call<WikiItem>(`/v2/wiki/${seg(c)}/${seg(n)}`, options);
  }
}
