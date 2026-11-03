/**
 * Base class of every error thrown by the SDK.
 *
 * Use `instanceof UmanthirError` to tell SDK errors apart from other failures.
 */
export class UmanthirError extends Error {
  public override readonly name: string = "UmanthirError";

  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    // Keep `instanceof` working when the class is transpiled or bundled.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** An argument was rejected before any request was sent. */
export class ValidationError extends UmanthirError {
  public override readonly name: string = "ValidationError";
}

/** The request could not reach the API (DNS, TLS, connection reset, offline...). */
export class ConnectionError extends UmanthirError {
  public override readonly name: string = "ConnectionError";
}

/** The request took longer than the configured `timeout`. */
export class TimeoutError extends ConnectionError {
  public override readonly name: string = "TimeoutError";
}

/** The request was cancelled through the `signal` passed by the caller. */
export class AbortError extends UmanthirError {
  public override readonly name: string = "AbortError";
}

/** Rate limit information sent by the API in the `RateLimit-*` headers. */
export interface RateLimitInfo {
  /** Requests allowed in the current window. */
  limit: number | undefined;
  /** Requests left in the current window. */
  remaining: number | undefined;
  /** Unix time (seconds) at which the window resets. */
  reset: number | undefined;
}

/** Details used to build an {@link APIError}. */
export interface APIErrorInit {
  status: number;
  message: string;
  method: string;
  url: string;
  headers: Readonly<Record<string, string>>;
  body: unknown;
  retryAfter: number | undefined;
}

/** The API answered with an error status (4xx or 5xx). */
export class APIError extends UmanthirError {
  public override readonly name: string = "APIError";
  /** HTTP status code. */
  public readonly status: number;
  /** Error message sent by the API (`error.message`), or a short description. */
  public readonly apiMessage: string;
  /** HTTP method of the failed request. */
  public readonly method: string;
  /** URL of the failed request. It never contains credentials. */
  public readonly url: string;
  /** Response headers, lower-cased. */
  public readonly headers: Readonly<Record<string, string>>;
  /** Parsed response body (JSON), or a truncated text excerpt. */
  public readonly body: unknown;
  /** Seconds to wait before trying again, from `Retry-After`, when the API sent it. */
  public readonly retryAfter: number | undefined;
  /** API version from `X-API-Version`, when present. */
  public readonly apiVersion: string | undefined;

  public constructor(init: APIErrorInit) {
    super(`${init.status} ${init.message} (${init.method} ${init.url})`);
    this.status = init.status;
    this.apiMessage = init.message;
    this.method = init.method;
    this.url = init.url;
    this.headers = init.headers;
    this.body = init.body;
    this.retryAfter = init.retryAfter;
    this.apiVersion = init.headers["x-api-version"];
  }
}

/** 400: an argument was rejected by the API. */
export class BadRequestError extends APIError {
  public override readonly name: string = "BadRequestError";
}

/** 404: the character, guild, world, item or route does not exist. */
export class NotFoundError extends APIError {
  public override readonly name: string = "NotFoundError";
}

/** 429: the rate limit of the current window was exceeded. */
export class RateLimitError extends APIError {
  public override readonly name: string = "RateLimitError";
  public readonly rateLimit: RateLimitInfo;

  public constructor(init: APIErrorInit) {
    super(init);
    this.rateLimit = readRateLimit(init.headers);
  }
}

/** 502 or 520: the API could not read tibia.com. */
export class UpstreamError extends APIError {
  public override readonly name: string = "UpstreamError";
}

/** Why the API answered 503. */
export type ServiceUnavailableReason = "maintenance" | "busy" | "wiki_unavailable" | "unknown";

/** 503: tibia.com maintenance, upstream protection or wiki data unavailable. */
export class ServiceUnavailableError extends APIError {
  public override readonly name: string = "ServiceUnavailableError";
  public readonly reason: ServiceUnavailableReason;

  public constructor(init: APIErrorInit) {
    super(init);
    this.reason = unavailableReason(init.message);
  }
}

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Reads the `RateLimit-*` headers (lower-cased keys). */
export function readRateLimit(headers: Readonly<Record<string, string>>): RateLimitInfo {
  return {
    limit: toNumber(headers["ratelimit-limit"]),
    remaining: toNumber(headers["ratelimit-remaining"]),
    reset: toNumber(headers["ratelimit-reset"]),
  };
}

function unavailableReason(message: string): ServiceUnavailableReason {
  const m = message.toLowerCase();
  if (m.includes("maintenance")) return "maintenance";
  if (m.includes("busy")) return "busy";
  if (m.includes("wiki")) return "wiki_unavailable";
  return "unknown";
}

/** Builds the error class that matches the HTTP status. */
export function createAPIError(init: APIErrorInit): APIError {
  switch (init.status) {
    case 400:
      return new BadRequestError(init);
    case 404:
      return new NotFoundError(init);
    case 429:
      return new RateLimitError(init);
    case 502:
    case 520:
      return new UpstreamError(init);
    case 503:
      return new ServiceUnavailableError(init);
    default:
      return new APIError(init);
  }
}
