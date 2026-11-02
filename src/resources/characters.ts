import type { RequestOptions, Transport } from "../core/transport.js";
import { pathName } from "../core/validate.js";
import type { Character } from "../generated/schemas.js";

/** Community: character profiles. */
export class CharactersResource {
  readonly #transport: Transport;

  public constructor(transport: Transport) {
    this.#transport = transport;
  }

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
    const response = await this.#transport.request<Character>({
      method: "GET",
      path: `/v2/community/characters/${encodeURIComponent(value)}`,
      options,
    });
    return response.data as Character;
  }
}
