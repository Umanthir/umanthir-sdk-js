/**
 * Entry of the browser bundle (`umanthir.min.js`).
 *
 * The global `Umanthir` is the client class itself, so `new Umanthir()` works,
 * and the error classes and helpers hang from it (`Umanthir.NotFoundError`, `Umanthir.formatDate`).
 */
import { Umanthir } from "./client.js";
import * as errors from "./errors.js";
import { formatDate } from "./format-date.js";

const STATICS = {
  formatDate,
  UmanthirError: errors.UmanthirError,
  ValidationError: errors.ValidationError,
  ConnectionError: errors.ConnectionError,
  TimeoutError: errors.TimeoutError,
  AbortError: errors.AbortError,
  APIError: errors.APIError,
  BadRequestError: errors.BadRequestError,
  AuthenticationError: errors.AuthenticationError,
  ForbiddenError: errors.ForbiddenError,
  NotFoundError: errors.NotFoundError,
  GoneError: errors.GoneError,
  RateLimitError: errors.RateLimitError,
  UpstreamError: errors.UpstreamError,
  ServiceUnavailableError: errors.ServiceUnavailableError,
};

for (const [name, value] of Object.entries(STATICS)) {
  Object.defineProperty(Umanthir, name, { value, enumerable: true });
}

export default Umanthir;
