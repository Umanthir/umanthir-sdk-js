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
  /** Stable machine code from `error.code` (e.g. `origin_not_allowed`), when the API sent one. */
  public readonly code: string | undefined;

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
    this.code = errorCode(init.body);
  }
}

/** 401: the token is malformed, unknown, revoked or expired. */
export class AuthenticationError extends APIError {
  public override readonly name: string = "AuthenticationError";
}

/** 403: refused. A site key used from another origin has `code: "origin_not_allowed"`. */
export class ForbiddenError extends APIError {
  public override readonly name: string = "ForbiddenError";
}

/** 400: an argument was rejected by the API. */
export class BadRequestError extends APIError {
  public override readonly name: string = "BadRequestError";
}

/** 404: the character, guild, world, item or route does not exist. */
export class NotFoundError extends APIError {
  public override readonly name: string = "NotFoundError";
}

/** Why a house answers 410; `unknown` when the API sent no recognized reason. */
export type GoneReason = "removed" | "renamed" | "unknown";

/** 410: the house left the game client. A renamed house has its new slug in `replacedBy`. */
export class GoneError extends APIError {
  public override readonly name: string = "GoneError";
  public readonly reason: GoneReason;
  public readonly replacedBy: string | undefined;

  public constructor(init: APIErrorInit) {
    super(init);
    const body = (typeof init.body === "object" && init.body !== null ? init.body : {}) as {
      reason?: unknown;
      replaced_by?: unknown;
    };
    this.reason = body.reason === "removed" || body.reason === "renamed" ? body.reason : "unknown";
    this.replacedBy = typeof body.replaced_by === "string" ? body.replaced_by : undefined;
  }
}

/** Which limit a 429 hit. The month and day quotas only come back at `retryAfter`, in UTC. */
export type RateLimitReason = "rate_limit" | "ip_limit" | "monthly_quota" | "daily_quota";

/** 429: a rate limit or a plan quota was exceeded. */
export class RateLimitError extends APIError {
  public override readonly name: string = "RateLimitError";
  public readonly rateLimit: RateLimitInfo;
  public readonly reason: RateLimitReason;

  public constructor(init: APIErrorInit) {
    super(init);
    this.rateLimit = readRateLimit(init.headers);
    this.reason = rateLimitReason(init.message);
  }
}

/** 502 or 520: the API could not read tibia.com. */
export class UpstreamError extends APIError {
  public override readonly name: string = "UpstreamError";
}

/** Why the API answered 503. */
export type ServiceUnavailableReason =
  | "maintenance"
  | "busy"
  | "wiki_unavailable"
  | "unknown"
  | "houses_unavailable";

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
  if (m.includes("houses")) return "houses_unavailable";
  return "unknown";
}

function rateLimitReason(message: string): RateLimitReason {
  const m = message.toLowerCase();
  if (m.includes("monthly quota")) return "monthly_quota";
  if (m.includes("daily quota")) return "daily_quota";
  if (m.includes("this ip")) return "ip_limit";
  return "rate_limit";
}

function errorCode(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const inner = (body as { error?: unknown }).error;
  if (typeof inner !== "object" || inner === null) return undefined;
  const code = (inner as { code?: unknown }).code;
  return typeof code === "string" && code !== "" ? code : undefined;
}

/** Builds the error class that matches the HTTP status. */
export function createAPIError(init: APIErrorInit): APIError {
  switch (init.status) {
    case 400:
      return new BadRequestError(init);
    case 401:
      return new AuthenticationError(init);
    case 403:
      return new ForbiddenError(init);
    case 404:
      return new NotFoundError(init);
    case 410:
      return new GoneError(init);
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
