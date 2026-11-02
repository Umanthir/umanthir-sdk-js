export { DEFAULT_BASE_URL, Umanthir, type UmanthirOptions } from "./client.js";
export { API_CONTRACT_VERSION, SUPPORTED_API_MAJOR } from "./contract.js";
export type { Logger, LogLevel } from "./core/logger.js";
export type { RequestInfo, RequestOptions, ResponseInfo } from "./core/transport.js";
export type { UmanthirWarning, WarningCode } from "./core/warnings.js";
export {
  AbortError,
  APIError,
  BadRequestError,
  ConnectionError,
  NotFoundError,
  RateLimitError,
  type RateLimitInfo,
  ServiceUnavailableError,
  type ServiceUnavailableReason,
  TimeoutError,
  UmanthirError,
  UpstreamError,
  ValidationError,
} from "./errors.js";
export type * from "./generated/schemas.js";
export type { CharactersResource } from "./resources/characters.js";
export { VERSION } from "./version.js";
