import type { RequestOptions } from "../core/transport.js";
import { pathName } from "../core/validate.js";
import { ValidationError } from "../errors.js";
import type {
  RashidLocation,
  WikiCategoryList,
  WikiItem,
  WikiItemList,
} from "../generated/schemas.js";
import { Resource, seg } from "./base.js";

const SLUG = /^[A-Za-z0-9_-]{1,60}$/;

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
