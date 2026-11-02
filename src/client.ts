import { isBrowser, nodeVersion } from "./core/env.js";
import {
  envLogLevel,
  isLogLevel,
  LevelLogger,
  type Logger,
  type LogLevel,
  REDACTED,
} from "./core/logger.js";
import {
  type RequestInfo,
  type ResponseInfo,
  Transport,
  validateRetries,
  validateTimeout,
} from "./core/transport.js";
import { type UmanthirWarning, WarningEmitter } from "./core/warnings.js";
import { ValidationError } from "./errors.js";
import { CharactersResource } from "./resources/characters.js";
import {
  DromeResource,
  FansitesResource,
  GuildsResource,
  HighscoresResource,
  HousesResource,
  KillStatisticsResource,
  PollsResource,
  WorldsResource,
} from "./resources/community.js";
import { VERSION } from "./version.js";

/** Default address of the Umanthir API. */
export const DEFAULT_BASE_URL = "https://api.umanthir.com";

/** Options of {@link Umanthir}. All of them are optional. */
export interface UmanthirOptions {
  /** API address. Must use https, except for localhost. Default: `https://api.umanthir.com`. */
  baseURL?: string;
  /**
   * API key sent as `Authorization: Bearer <apiKey>`. Never logged.
   * Avoid it in browsers: anything shipped to a browser is visible to its users.
   */
  apiKey?: string;
  /** Timeout of each attempt, in milliseconds. Default: 30000. */
  timeout?: number;
  /** Retries after a network error, 429, 502, 503 or 520 (GET only). Default: 2. */
  maxRetries?: number;
  /** Custom `fetch` implementation. Default: the global `fetch`. */
  fetch?: typeof fetch;
  /** Log level. Default: `"warn"`, or `UMANTHIR_LOG` in Node.js. */
  logLevel?: LogLevel;
  /** Shortcut for `logLevel: "debug"`: logs every request and response. */
  debug?: boolean;
  /** Where logs go. Default: `console`. */
  logger?: Logger;
  /** Include response bodies (truncated to 2 KB) in debug logs. Default: false. */
  logBodies?: boolean;
  /** Called before every attempt, with redacted headers. */
  onRequest?: (info: RequestInfo) => void;
  /** Called after every attempt that got a response. */
  onResponse?: (info: ResponseInfo) => void;
  /** Called for every warning, in addition to the logger. */
  onWarning?: (warning: UmanthirWarning) => void;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parseBaseURL(value: unknown): URL {
  if (typeof value !== "string") throw new ValidationError("baseURL must be a string.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ValidationError("baseURL must be an absolute URL.");
  }
  const local = LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new ValidationError("baseURL must use https (http is allowed only for localhost).");
  }
  if (url.username !== "" || url.password !== "") {
    throw new ValidationError("baseURL must not contain credentials; use the apiKey option.");
  }
  if (url.search !== "" || url.hash !== "") {
    throw new ValidationError("baseURL must not contain a query string or fragment.");
  }
  return url;
}

function parseApiKey(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError("apiKey must be a non-empty string.");
  }
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what we reject
  if (/[\s\u0000-\u001f\u007f]/.test(value)) {
    throw new ValidationError("apiKey must not contain whitespace or control characters.");
  }
  return value;
}

function resolveFetch(value: unknown): typeof fetch {
  if (value !== undefined) {
    if (typeof value !== "function") throw new ValidationError("fetch must be a function.");
    return value as typeof fetch;
  }
  if (typeof globalThis.fetch !== "function") {
    throw new ValidationError("No global fetch found; pass the fetch option.");
  }
  return globalThis.fetch.bind(globalThis);
}

function resolveLevel(options: UmanthirOptions): LogLevel {
  if (options.logLevel !== undefined) {
    if (!isLogLevel(options.logLevel)) {
      throw new ValidationError('logLevel must be "off", "error", "warn", "info" or "debug".');
    }
    return options.logLevel;
  }
  if (options.debug === true) return "debug";
  return envLogLevel() ?? "warn";
}

/**
 * Client for the Umanthir API.
 *
 * @example
 * ```ts
 * const client = new Umanthir();
 * const character = await client.characters.get("Njorn");
 * ```
 */
export class Umanthir {
  /** Version of this SDK. */
  public static readonly version: string = VERSION;

  /** API address used by this client. */
  public readonly baseURL: string;
  /** Character profiles. */
  public readonly characters: CharactersResource;
  /** Highscores and a character's position in them. */
  public readonly highscores: HighscoresResource;
  /** Game worlds. */
  public readonly worlds: WorldsResource;
  /** Tibiadrome rotations and rankings. */
  public readonly drome: DromeResource;
  /** Kill statistics of a world. */
  public readonly killStatistics: KillStatisticsResource;
  /** Promoted and supported fansites. */
  public readonly fansites: FansitesResource;
  /** Guilds of a world and guild details. */
  public readonly guilds: GuildsResource;
  /** Active and closed polls. */
  public readonly polls: PollsResource;
  /** Houses, guildhalls and their auctions. */
  public readonly houses: HousesResource;

  readonly #hasApiKey: boolean;
  readonly #timeout: number;
  readonly #maxRetries: number;

  public constructor(options: UmanthirOptions = {}) {
    if (typeof options !== "object" || options === null) {
      throw new ValidationError("options must be an object.");
    }
    const baseURL = parseBaseURL(options.baseURL ?? DEFAULT_BASE_URL);
    const apiKey = parseApiKey(options.apiKey);
    this.#timeout =
      options.timeout === undefined ? 30_000 : validateTimeout("timeout", options.timeout);
    this.#maxRetries =
      options.maxRetries === undefined ? 2 : validateRetries("maxRetries", options.maxRetries);
    this.#hasApiKey = apiKey !== undefined;
    this.baseURL = baseURL.href.replace(/\/+$/, "");

    const logger = new LevelLogger(resolveLevel(options), options.logger ?? console);
    const onWarning = options.onWarning;
    const warnings = new WarningEmitter((warning) => {
      logger.warn(`${warning.code}: ${warning.message}`, warning.details);
      if (onWarning === undefined) return;
      try {
        onWarning(warning);
      } catch {
        logger.error("The onWarning callback threw an error.");
      }
    });

    const browser = isBrowser();
    const node = nodeVersion();
    const transport = new Transport({
      baseURL,
      apiKey,
      timeout: this.#timeout,
      maxRetries: this.#maxRetries,
      fetch: resolveFetch(options.fetch),
      logger,
      logBodies: options.logBodies === true,
      warnings,
      // Browsers forbid setting User-Agent; custom headers would also trigger CORS preflights.
      userAgent:
        !browser && node !== undefined ? `umanthir-sdk-js/${VERSION} node/${node}` : undefined,
      onRequest: options.onRequest,
      onResponse: options.onResponse,
    });

    if (browser && apiKey !== undefined) {
      warnings.once("apikey-browser", {
        code: "API_KEY_IN_BROWSER",
        message: "An apiKey is set in a browser; anyone using the page can read it.",
      });
    }
    if (baseURL.protocol === "http:") {
      warnings.once("insecure-base-url", {
        code: "INSECURE_BASE_URL",
        message: `Using an unencrypted base URL (${this.baseURL}); only for local development.`,
      });
    }

    this.characters = new CharactersResource(transport);
    this.highscores = new HighscoresResource(transport);
    this.worlds = new WorldsResource(transport);
    this.drome = new DromeResource(transport);
    this.killStatistics = new KillStatisticsResource(transport);
    this.fansites = new FansitesResource(transport);
    this.guilds = new GuildsResource(transport);
    this.polls = new PollsResource(transport);
    this.houses = new HousesResource(transport);
  }

  /** Safe summary of the configuration; the API key is never included. */
  public toJSON(): Record<string, unknown> {
    return {
      baseURL: this.baseURL,
      timeout: this.#timeout,
      maxRetries: this.#maxRetries,
      apiKey: this.#hasApiKey ? REDACTED : undefined,
    };
  }

  public toString(): string {
    return `Umanthir(${this.baseURL})`;
  }
}

// Node.js `util.inspect` (console.log) shows the same safe summary as toJSON().
Object.defineProperty(Umanthir.prototype, Symbol.for("nodejs.util.inspect.custom"), {
  value(this: Umanthir): Record<string, unknown> {
    return this.toJSON();
  },
});
