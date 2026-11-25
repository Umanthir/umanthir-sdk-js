import type { RequestOptions } from "../core/transport.js";
import { intInRange, pathName, queryText } from "../core/validate.js";
import { ValidationError } from "../errors.js";
import type {
  ClientHouseList,
  ClientItem,
  ItemBatch,
  ItemSearch,
  RashidLocation,
  WikiAchievement,
  WikiAchievementList,
  WikiCategoryList,
  WikiCreature,
  WikiCreatureList,
  WikiItem,
  WikiItemList,
  WikiNPC,
  WikiNPCList,
  WikiSpell,
  WikiSpellList,
} from "../generated/schemas.js";
import { Resource, seg } from "./base.js";

const SLUG = /^[A-Za-z0-9_-]{1,60}$/;
const HOUSE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256 = /^[0-9a-f]{64}$/;
const MAX_ITEM_ID = 9_999_999;
const MAX_BATCH = 100;

/** Filters of {@link WikiResource.houses}. */
export interface WikiHouseListOptions {
  /** Town name, case-insensitive. */
  town?: string | undefined;
  /** `true` lists only guildhalls; `false`, only houses. */
  guildhall?: boolean | undefined;
}

/** Filters of {@link WikiResource.rawItems}. */
export interface RawItemSearchOptions {
  /** Part of the name, case-insensitive, up to 100 characters. */
  name?: string | undefined;
  /** Market category (`market.category_name`), exact and case-insensitive, up to 100 characters. */
  category?: string | undefined;
  /** `true` lists only items with a name; `false`, only items without one. */
  named?: boolean | undefined;
  /** Page from 1 to 100000 (100 items per page). Default: 1. */
  page?: number | undefined;
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

function itemId(label: string, value: unknown): number {
  return intInRange(label, value, 1, MAX_ITEM_ID);
}

function wikiName(label: string, value: unknown): string {
  return pathName(label, value, { anyText: true, max: 200 });
}

/** Wiki: data from TibiaWiki BR (texts in Portuguese), plus Tibia items, sprites and houses. */
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
   * Tibia houses, with links to their assembly JSON and floors.
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
   * @throws {GoneError} when the house left the game; a renamed one has its slug in `replacedBy`.
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
   * @throws {GoneError} when the house left the game.
   */
  public async houseFloor(slug: string, z: number, options?: RequestOptions): Promise<Uint8Array> {
    const s = houseSlug(slug);
    const floor = intInRange("z", z, 0, 15);
    return this.#png(`/v2/wiki/houses/${seg(s)}/floors/${seg(floor)}`, options);
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

  /**
   * Searches the active Tibia items by id, 100 per page. Needs an `apiKey` and counts against
   * the plan quota. These are items by id in the game, not the TibiaWiki BR items of
   * {@link WikiResource.list}: no weight, attack, defense, loot or price, and many have no name.
   *
   * @throws {AuthenticationError} without an `apiKey` (`code: "token_required"`) or with an invalid one.
   * @throws {ServiceUnavailableError} with `reason: "items_unavailable"` when the data is unavailable.
   *
   * @example
   * ```ts
   * const { items, total_pages } = await client.wiki.rawItems({ name: "coin", named: true });
   * ```
   */
  public async rawItems(
    filters: RawItemSearchOptions = {},
    options?: RequestOptions,
  ): Promise<ItemSearch> {
    const query: Record<string, string | number | undefined> = {};
    if (filters.name !== undefined) query["name"] = queryText("name", filters.name, 100);
    if (filters.category !== undefined) {
      query["category"] = queryText("category", filters.category, 100);
    }
    if (filters.named !== undefined) {
      if (typeof filters.named !== "boolean") throw new ValidationError("named must be a boolean.");
      query["named"] = String(filters.named);
    }
    if (filters.page !== undefined) query["page"] = intInRange("page", filters.page, 1, 100_000);
    return this.call<ItemSearch>("/v2/wiki/items", options, query);
  }

  /**
   * Full records of up to 100 Tibia items, in the order asked and without repeats. Ids with no
   * item come in `not_found`. Needs an `apiKey` and counts against the plan quota.
   *
   * @param ids From 1 to 100 item ids in the game, each from 1 to 9999999.
   * @throws {AuthenticationError} without an `apiKey` or with an invalid one.
   *
   * @example
   * ```ts
   * const { items, not_found } = await client.wiki.rawItemsByIds([102, 3031]);
   * ```
   */
  public async rawItemsByIds(ids: readonly number[], options?: RequestOptions): Promise<ItemBatch> {
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_BATCH) {
      throw new ValidationError(`ids must be an array of 1 to ${MAX_BATCH} item ids.`);
    }
    const list = ids.map((id) => itemId("each id", id));
    return this.call<ItemBatch>("/v2/wiki/items", options, { ids: list.join(",") });
  }

  /**
   * One Tibia item record: its flags, the sprites of each frame group and `preview`, the first
   * sprite. A sprite is `sprite_base_url` + sha256 + `.png`, or {@link WikiResource.sprite}.
   * An item removed from the game comes with `active: false`. Needs an `apiKey`.
   *
   * @param id Item id in the game, from 1 to 9999999.
   * @throws {NotFoundError} when there is no such item (`code: "item_not_found"`).
   * @throws {AuthenticationError} without an `apiKey` or with an invalid one.
   */
  public async rawItem(id: number, options?: RequestOptions): Promise<ClientItem> {
    return this.call<ClientItem>(`/v2/wiki/items/${seg(itemId("id", id))}`, options);
  }

  /**
   * URL of the preview image of a Tibia item, for an `<img src>`. It makes no request and never
   * carries the `apiKey`; the route needs no token. It answers 404 for an item without an image.
   *
   * @param id Item id in the game, from 1 to 9999999.
   *
   * @example
   * ```ts
   * img.src = client.wiki.itemImageUrl(3031);
   * ```
   */
  public itemImageUrl(id: number): string {
    return this.href(`/v2/wiki/items/${seg(itemId("id", id))}/image`);
  }

  /**
   * One Tibia sprite, as PNG. The file never changes.
   *
   * @param sha256 sha256 of the PNG in lower-case hex (64 digits), such as an item `preview`.
   * @returns The PNG bytes.
   * @throws {NotFoundError} when there is no such sprite.
   */
  public async sprite(sha256: string, options?: RequestOptions): Promise<Uint8Array> {
    if (typeof sha256 !== "string" || !SHA256.test(sha256)) {
      throw new ValidationError("sha256 must be 64 lower-case hex digits.");
    }
    return this.#png(`/v2/wiki/sprites/${sha256}.png`, options);
  }

  /** Every TibiaWiki BR creature, with its basic data. */
  public async creatures(options?: RequestOptions): Promise<WikiCreatureList> {
    return this.call<WikiCreatureList>("/v2/wiki/creatures", options);
  }

  /**
   * One creature, with everything the wiki says: damage modifiers, abilities, immunities and loot.
   *
   * @param name Creature name, case-insensitive (`demon`), up to 200 characters.
   * @throws {NotFoundError} when there is no such creature.
   */
  public async creature(name: string, options?: RequestOptions): Promise<WikiCreature> {
    return this.call<WikiCreature>(
      `/v2/wiki/creatures/${seg(wikiName("Creature name", name))}`,
      options,
    );
  }

  /** Every TibiaWiki BR NPC, with its basic data. */
  public async npcs(options?: RequestOptions): Promise<WikiNPCList> {
    return this.call<WikiNPCList>("/v2/wiki/npcs", options);
  }

  /**
   * One NPC, with what it buys and sells.
   *
   * @param name NPC name, case-insensitive, up to 200 characters.
   * @throws {NotFoundError} when there is no such NPC.
   */
  public async npc(name: string, options?: RequestOptions): Promise<WikiNPC> {
    return this.call<WikiNPC>(`/v2/wiki/npcs/${seg(wikiName("NPC name", name))}`, options);
  }

  /** Every TibiaWiki BR spell, with its basic data. */
  public async spells(options?: RequestOptions): Promise<WikiSpellList> {
    return this.call<WikiSpellList>("/v2/wiki/spells", options);
  }

  /**
   * One spell, with everything the wiki says.
   *
   * @param name Spell name, case-insensitive, up to 200 characters.
   * @throws {NotFoundError} when there is no such spell.
   */
  public async spell(name: string, options?: RequestOptions): Promise<WikiSpell> {
    return this.call<WikiSpell>(`/v2/wiki/spells/${seg(wikiName("Spell name", name))}`, options);
  }

  /** Every TibiaWiki BR achievement, including the ones no longer obtainable or removed. */
  public async achievements(options?: RequestOptions): Promise<WikiAchievementList> {
    return this.call<WikiAchievementList>("/v2/wiki/achievements", options);
  }

  /**
   * One achievement, with how to get it.
   *
   * @param name Achievement name, case-insensitive (`ashes to dust`), up to 200 characters.
   * @throws {NotFoundError} when there is no such achievement.
   */
  public async achievement(name: string, options?: RequestOptions): Promise<WikiAchievement> {
    return this.call<WikiAchievement>(
      `/v2/wiki/achievements/${seg(wikiName("Achievement name", name))}`,
      options,
    );
  }

  async #png(path: string, options: RequestOptions | undefined): Promise<Uint8Array> {
    const response = await this.send<Uint8Array>({ method: "GET", path, binary: true, options });
    return response.data as Uint8Array;
  }
}
