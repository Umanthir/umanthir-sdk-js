import { VERSION } from "./version.js";

/**
 * Client for the Umanthir API.
 *
 * @example
 * ```ts
 * const client = new Umanthir();
 * ```
 */
// biome-ignore lint/complexity/noStaticOnlyClass: placeholder until options and resources land
export class Umanthir {
  /** Version of this SDK. */
  public static readonly version: string = VERSION;
}
