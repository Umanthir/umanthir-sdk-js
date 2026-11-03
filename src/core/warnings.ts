/** Codes of the warnings the SDK can emit. */
export type WarningCode =
  | "STALE_DATA"
  | "PARTIAL_FAILURE"
  | "RATE_LIMIT_LOW"
  | "RETRYING"
  | "API_VERSION_MISMATCH"
  | "DEPRECATED"
  | "API_KEY_IN_BROWSER"
  | "INSECURE_BASE_URL"
  | "HOOK_FAILED";

/** A non-fatal condition worth the developer's attention. */
export interface UmanthirWarning {
  code: WarningCode;
  message: string;
  details?: Readonly<Record<string, unknown>>;
}

/** Delivers warnings to the logger and the `onWarning` callback. */
export class WarningEmitter {
  readonly #seen = new Set<string>();
  readonly #deliver: (warning: UmanthirWarning) => void;

  public constructor(deliver: (warning: UmanthirWarning) => void) {
    this.#deliver = deliver;
  }

  /** Emits a warning every time. */
  public emit(warning: UmanthirWarning): void {
    this.#deliver(warning);
  }

  /** Emits a warning only the first time `key` is seen by this client. */
  public once(key: string, warning: UmanthirWarning): void {
    if (this.#seen.has(key)) return;
    this.#seen.add(key);
    this.#deliver(warning);
  }
}
