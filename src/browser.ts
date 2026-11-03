/**
 * Entry of the browser bundle (`umanthir.min.js`).
 *
 * The global `Umanthir` is the client class itself, so `new Umanthir()` works,
 * and the error classes hang from it (`Umanthir.NotFoundError`, ...).
 */
import { Umanthir } from "./client.js";
import * as errors from "./errors.js";

const ERROR_CLASSES = {
  UmanthirError: errors.UmanthirError,
  ValidationError: errors.ValidationError,
  ConnectionError: errors.ConnectionError,
  TimeoutError: errors.TimeoutError,
  AbortError: errors.AbortError,
  APIError: errors.APIError,
  BadRequestError: errors.BadRequestError,
  NotFoundError: errors.NotFoundError,
  RateLimitError: errors.RateLimitError,
  UpstreamError: errors.UpstreamError,
  ServiceUnavailableError: errors.ServiceUnavailableError,
};

for (const [name, value] of Object.entries(ERROR_CLASSES)) {
  Object.defineProperty(Umanthir, name, { value, enumerable: true });
}

export default Umanthir;
