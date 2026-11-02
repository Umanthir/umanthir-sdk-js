import { describe, expect, it } from "vitest";
import {
  APIError,
  BadRequestError,
  createAPIError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  UmanthirError,
  UpstreamError,
} from "../../src/errors.js";

const base = {
  method: "GET",
  url: "https://api.umanthir.com/v2/x",
  body: undefined,
  retryAfter: undefined,
};

describe("createAPIError", () => {
  it.each([
    [400, BadRequestError],
    [404, NotFoundError],
    [429, RateLimitError],
    [502, UpstreamError],
    [520, UpstreamError],
    [503, ServiceUnavailableError],
    [500, APIError],
    [418, APIError],
  ])("maps %i to %s", (status, cls) => {
    const error = createAPIError({ ...base, status, message: "m", headers: {} });
    expect(error).toBeInstanceOf(cls);
    expect(error).toBeInstanceOf(APIError);
    expect(error).toBeInstanceOf(UmanthirError);
    expect(error.status).toBe(status);
    expect(error.name).toBe(cls.name);
  });

  it("keeps the API message, version and a readable message", () => {
    const error = createAPIError({
      ...base,
      status: 404,
      message: "Character not found.",
      headers: { "x-api-version": "2.4.2" },
    });
    expect(error.apiMessage).toBe("Character not found.");
    expect(error.apiVersion).toBe("2.4.2");
    expect(error.message).toBe("404 Character not found. (GET https://api.umanthir.com/v2/x)");
  });

  it("reads rate limit headers on 429", () => {
    const error = createAPIError({
      ...base,
      status: 429,
      message: "Rate limit exceeded.",
      headers: {
        "ratelimit-limit": "60",
        "ratelimit-remaining": "0",
        "ratelimit-reset": "1790000000",
      },
    }) as RateLimitError;
    expect(error.rateLimit).toEqual({ limit: 60, remaining: 0, reset: 1790000000 });
  });

  it("leaves unknown rate limit values undefined", () => {
    const error = createAPIError({
      ...base,
      status: 429,
      message: "x",
      headers: { "ratelimit-limit": "n/a" },
    }) as RateLimitError;
    expect(error.rateLimit).toEqual({ limit: undefined, remaining: undefined, reset: undefined });
  });

  it.each([
    ["Tibia.com is under maintenance.", "maintenance"],
    ["Upstream busy.", "busy"],
    ["Wiki data unavailable.", "wiki_unavailable"],
    ["Something else.", "unknown"],
  ])("503 %s → reason %s", (message, reason) => {
    const error = createAPIError({
      ...base,
      status: 503,
      message,
      headers: {},
    }) as ServiceUnavailableError;
    expect(error.reason).toBe(reason);
  });
});
