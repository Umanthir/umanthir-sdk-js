import type { RequestOptions } from "../core/transport.js";
import { pathName } from "../core/validate.js";
import type { Character } from "../generated/schemas.js";
import { Resource, seg } from "./base.js";

/** Community: character profiles. */
export class CharactersResource extends Resource {
  /**
   * Character profile, with deaths, account information and other characters.
   *
   * @param name Character name. `/ \ ? # &` are rejected; NBSP becomes a space.
   * @throws {NotFoundError} when the character does not exist.
   *
   * @example
   * ```ts
   * const character = await client.characters.get("Njorn");
   * console.log(character.character_information.level);
   * ```
   */
  public async get(name: string, options?: RequestOptions): Promise<Character> {
    const value = pathName("Character name", name);
    return this.call<Character>(`/v2/community/characters/${seg(value)}`, options);
  }
}
