import { SUPPORTED_API_MAJOR } from "../contract.js";
import {
  AbortError,
  type APIError,
  ConnectionError,
  createAPIError,
  readRateLimit,
  TimeoutError,
  ValidationError,
} from "../errors.js";
import { type LevelLogger, redactHeaders, truncate } from "./logger.js";
import {
  backoffDelay,
  sleep as defaultSleep,
  IDEMPOTENT_METHODS,
  MAX_DELAY_MS,
  parseRetryAfter,
  RETRYABLE_STATUS,
} from "./retry.js";
import type { UmanthirWarning, WarningEmitter } from "./warnings.js";

/** Options accepted by every SDK method, overriding the client defaults for one call. */
export interface RequestOptions {
  /** Cancels the request (and any pending retry) when aborted. */
  signal?: AbortSignal;
  /** Timeout of each attempt, in milliseconds. */
  timeout?: number;
  /** Retries after a network error, 429, 502, 503 or 520 (GET only). */
  maxRetries?: number;
}

/** Passed to `onRequest` before every attempt. Headers are redacted. */
export interface RequestInfo {
  method: string;
  url: string;
  headers: Readonly<Record<string, string>>;
  attempt: number;
}

/** Passed to `onResponse` after every attempt that got a response. Headers are lower-cased. */
export interface ResponseInfo {
  method: string;
  url: string;
  status: number;
  headers: Readonly<Record<string, string>>;
  durationMs: number;
  attempt: number;
}

export type QueryValue = string | number | boolean | readonly (string | number)[] | undefined;

export interface TransportRequest {
  method: "GET" | "POST";
  /** Path starting with `/`, with every dynamic segment already encoded. */
  path: string;
  query?: Readonly<Record<string, QueryValue>>;
  body?: unknown;
  /** Plain text body (sent as `text/plain; charset=utf-8`); excludes `body`. */
  text?: string;
  /** Extra request headers (internal use, e.g. `If-None-Match`). */
  headers?: Readonly<Record<string, string>>;
  options?: RequestOptions | undefined;
}

export interface TransportResponse<T> {
  status: number;
  headers: Readonly<Record<string, string>>;
  /** Parsed JSON body; undefined for 304. */
  data: T | undefined;
  notModified: boolean;
}

export interface TransportConfig {
  baseURL: URL;
  apiKey: string | undefined;
  timeout: number;
  maxRetries: number;
  fetch: typeof fetch;
  logger: LevelLogger;
  logBodies: boolean;
  warnings: WarningEmitter;
  userAgent: string | undefined;
  onRequest: ((info: RequestInfo) => void) | undefined;
  onResponse: ((info: ResponseInfo) => void) | undefined;
}

/** Injectable side effects, so tests run without real waits or randomness. */
export interface TransportDeps {
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  now: () => number;
  random: () => number;
}

const MAX_BODY_LOG = 2048;
const MAX_ERROR_EXCERPT = 200;

export function validateTimeout(label: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > 600_000) {
    throw new ValidationError(`${label} must be an integer between 1 and 600000 (milliseconds).`);
  }
  return value;
}

export function validateRetries(label: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 10) {
    throw new ValidationError(`${label} must be an integer between 0 and 10.`);
  }
  return value;
}

function lowerCaseHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

function textExcerpt(text: string): string {
  const plain = text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return truncate(plain, MAX_ERROR_EXCERPT);
}

function errorMessage(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const inner = (body as { error: unknown }).error;
    if (typeof inner === "object" && inner !== null && "message" in inner) {
      const message = (inner as { message: unknown }).message;
      if (typeof message === "string" && message.trim() !== "")
        return truncate(message.trim(), 300);
    }
  }
  return `HTTP ${status}`;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Sends requests to the Umanthir API with timeouts, retries, logging and typed errors. */
export class Transport {
  readonly #config: TransportConfig;
  readonly #deps: TransportDeps;

  public constructor(config: TransportConfig, deps?: Partial<TransportDeps>) {
    this.#config = config;
    this.#deps = {
      sleep: deps?.sleep ?? defaultSleep,
      now: deps?.now ?? Date.now,
      random: deps?.random ?? Math.random,
    };
  }

  public buildURL(path: string, query?: Readonly<Record<string, QueryValue>>): URL {
    const base = this.#config.baseURL.href.replace(/\/+$/, "");
    const url = new URL(`${base}${path}`);
    if (url.origin !== this.#config.baseURL.origin) {
      throw new ValidationError("The request path left the configured base URL.");
    }
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined) continue;
      if (Array.isArray(value))
        for (const item of value) url.searchParams.append(key, String(item));
      else url.searchParams.set(key, String(value));
    }
    return url;
  }

  #headers(request: TransportRequest): Record<string, string> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (request.body !== undefined) headers["Content-Type"] = "application/json";
    else if (request.text !== undefined) headers["Content-Type"] = "text/plain; charset=utf-8";
    if (this.#config.apiKey !== undefined)
      headers["Authorization"] = `Bearer ${this.#config.apiKey}`;
    if (this.#config.userAgent !== undefined) headers["User-Agent"] = this.#config.userAgent;
    return { ...headers, ...request.headers };
  }

  #hook<T>(name: "onRequest" | "onResponse", info: T): void {
    const hook = this.#config[name] as ((info: T) => void) | undefined;
    if (hook === undefined) return;
    try {
      hook(info);
    } catch (error) {
      this.#config.warnings.once(`hook:${name}`, {
        code: "HOOK_FAILED",
        message: `The ${name} hook threw an error; the request continued.`,
        details: { hook: name, error: describe(error) },
      });
    }
  }

  #observe(headers: Readonly<Record<string, string>>, path: string): void {
    const { warnings } = this.#config;
    const { limit, remaining, reset } = readRateLimit(headers);
    if (limit !== undefined && remaining !== undefined && limit > 0 && remaining <= limit * 0.1) {
      warnings.once(`ratelimit:${reset ?? "?"}`, {
        code: "RATE_LIMIT_LOW",
        message: `Only ${remaining} of ${limit} requests left in the current rate limit window.`,
        details: { limit, remaining, reset },
      });
    }
    const version = headers["x-api-version"];
    const major = version === undefined ? undefined : Number(version.split(".")[0]);
    if (major !== undefined && Number.isInteger(major) && major !== SUPPORTED_API_MAJOR) {
      warnings.once(`version:${version}`, {
        code: "API_VERSION_MISMATCH",
        message: `The API answered with version ${version}; this SDK supports v${SUPPORTED_API_MAJOR}.`,
        details: { apiVersion: version, supportedMajor: SUPPORTED_API_MAJOR },
      });
    }
    const deprecation = headers["deprecation"];
    const sunset = headers["sunset"];
    if (deprecation !== undefined || sunset !== undefined) {
      warnings.once(`deprecated:${path}`, {
        code: "DEPRECATED",
        message: `The API marked ${path} as deprecated.`,
        details: { path, deprecation, sunset },
      });
    }
  }

  /** Emits a warning through the client's logger and `onWarning`. */
  public warn(warning: UmanthirWarning): void {
    this.#config.warnings.emit(warning);
  }

  /** The API marks copies served after a failed tibia.com read with `stale: true`. */
  #observeBody(body: unknown, path: string): void {
    if (typeof body !== "object" || body === null || (body as { stale?: unknown }).stale !== true) {
      return;
    }
    const updatedAt = (body as { updated_at?: unknown }).updated_at;
    const when = typeof updatedAt === "string" ? ` (updated at ${updatedAt})` : "";
    this.#config.warnings.emit({
      code: "STALE_DATA",
      message: `The API served cached data for ${path}${when}.`,
      details: { path, updatedAt },
    });
  }

  async #wait(ms: number, signal: AbortSignal | undefined): Promise<void> {
    try {
      await this.#deps.sleep(ms, signal);
    } catch (error) {
      throw new AbortError("Request aborted.", { cause: error });
    }
  }

  public async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
    const { logger, warnings } = this.#config;
    const options = request.options ?? {};
    const timeout =
      options.timeout === undefined
        ? this.#config.timeout
        : validateTimeout("timeout", options.timeout);
    const maxRetries =
      options.maxRetries === undefined
        ? this.#config.maxRetries
        : validateRetries("maxRetries", options.maxRetries);
    const userSignal = options.signal;
    const url = this.buildURL(request.path, request.query);
    const href = url.href;
    const headers = this.#headers(request);
    const body = request.body === undefined ? request.text : JSON.stringify(request.body);
    const canRetry = IDEMPOTENT_METHODS.has(request.method);

    for (let attempt = 1; ; attempt++) {
      if (userSignal?.aborted)
        throw new AbortError("Request aborted.", { cause: userSignal.reason });
      const timeoutSignal = AbortSignal.timeout(timeout);
      const signal = userSignal ? AbortSignal.any([userSignal, timeoutSignal]) : timeoutSignal;
      const safeHeaders = redactHeaders(headers);
      this.#hook<RequestInfo>("onRequest", {
        method: request.method,
        url: href,
        headers: safeHeaders,
        attempt,
      });
      logger.debug(`→ ${request.method} ${href} (attempt ${attempt})`, { headers: safeHeaders });

      const started = this.#deps.now();
      let response: Response;
      let text: string;
      try {
        const init: RequestInit = {
          method: request.method,
          headers,
          signal,
          credentials: "omit",
          redirect: "error",
        };
        if (body !== undefined) init.body = body;
        response = await this.#config.fetch(href, init);
        text = await response.text();
      } catch (error) {
        if (userSignal?.aborted) throw new AbortError("Request aborted.", { cause: error });
        const failure = timeoutSignal.aborted
          ? new TimeoutError(`Request timed out after ${timeout} ms (${request.method} ${href}).`, {
              cause: error,
            })
          : new ConnectionError(
              `Could not reach the Umanthir API (${request.method} ${href}): ${describe(error)}`,
              { cause: error },
            );
        logger.debug(`✗ ${request.method} ${href}: ${failure.message}`);
        if (canRetry && attempt <= maxRetries) {
          const delay = backoffDelay(attempt - 1, this.#deps.random);
          warnings.emit({
            code: "RETRYING",
            message: `Retrying ${request.method} ${href} in ${delay} ms after: ${failure.message}`,
            details: { attempt, delayMs: delay, reason: failure.name },
          });
          await this.#wait(delay, userSignal);
          continue;
        }
        throw failure;
      }

      const durationMs = this.#deps.now() - started;
      const responseHeaders = lowerCaseHeaders(response.headers);
      this.#hook<ResponseInfo>("onResponse", {
        method: request.method,
        url: href,
        status: response.status,
        headers: responseHeaders,
        durationMs,
        attempt,
      });
      const extra = [
        responseHeaders["x-api-version"] && `X-API-Version=${responseHeaders["x-api-version"]}`,
        responseHeaders["ratelimit-remaining"] &&
          `RateLimit-Remaining=${responseHeaders["ratelimit-remaining"]}`,
      ]
        .filter(Boolean)
        .join(" ");
      logger.debug(
        `← ${response.status} ${request.method} ${href} ${durationMs}ms${extra ? ` ${extra}` : ""}`,
        this.#config.logBodies ? { body: truncate(text, MAX_BODY_LOG) } : undefined,
      );
      this.#observe(responseHeaders, request.path);

      if (response.status === 304) {
        return { status: 304, headers: responseHeaders, data: undefined, notModified: true };
      }

      let parsed: unknown;
      let isJSON = false;
      if (text !== "") {
        try {
          parsed = JSON.parse(text);
          isJSON = true;
        } catch {
          parsed = undefined;
        }
      }

      if (response.ok) {
        if (!isJSON) {
          throw createAPIError({
            status: response.status,
            message: text === "" ? "Empty response body" : "Invalid JSON response",
            method: request.method,
            url: href,
            headers: responseHeaders,
            body: text === "" ? undefined : textExcerpt(text),
            retryAfter: undefined,
          });
        }
        this.#observeBody(parsed, request.path);
        return {
          status: response.status,
          headers: responseHeaders,
          data: parsed as T,
          notModified: false,
        };
      }

      const retryAfterMs = parseRetryAfter(responseHeaders["retry-after"], this.#deps.now());
      const error: APIError = createAPIError({
        status: response.status,
        message: isJSON ? errorMessage(parsed, response.status) : `HTTP ${response.status}`,
        method: request.method,
        url: href,
        headers: responseHeaders,
        body: isJSON ? parsed : text === "" ? undefined : textExcerpt(text),
        retryAfter: retryAfterMs === undefined ? undefined : Math.ceil(retryAfterMs / 1000),
      });

      if (canRetry && attempt <= maxRetries && RETRYABLE_STATUS.has(response.status)) {
        const delay = retryAfterMs ?? backoffDelay(attempt - 1, this.#deps.random);
        if (delay <= MAX_DELAY_MS) {
          warnings.emit({
            code: "RETRYING",
            message: `Retrying ${request.method} ${href} in ${delay} ms after HTTP ${response.status}.`,
            details: { attempt, delayMs: delay, status: response.status },
          });
          await this.#wait(delay, userSignal);
          continue;
        }
      }
      throw error;
    }
  }
}
