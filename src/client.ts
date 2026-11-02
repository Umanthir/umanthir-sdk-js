import { VERSION } from "./version.js";

/**
 * Client for the Umanthir API.
 *
 * @example
 * ```ts
 * const client = new Umanthir();
 * ```
 */
export class Umanthir {
  /** Version of this SDK. */
  public static readonly version: string = VERSION;
}
