# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Package scaffold: ESM, CommonJS, type declarations and the browser bundle `umanthir.min.js`.
- Public types for every schema of the Umanthir API contract (2.4.2), with the OpenAPI names.
- `Umanthir` client with `baseURL`, optional `apiKey`, `timeout`, `maxRetries`, custom `fetch`,
  log levels, `debug`, custom `logger`, `logBodies` and the `onRequest`, `onResponse` and
  `onWarning` hooks.
- Typed errors: `ValidationError`, `ConnectionError`, `TimeoutError`, `AbortError` and `APIError`
  with `BadRequestError`, `NotFoundError`, `RateLimitError`, `UpstreamError` and
  `ServiceUnavailableError`.
- Retries with exponential backoff and `Retry-After` for network errors, 429, 502, 503 and 520.
- Warnings: low rate limit, retries, API version mismatch, deprecations, API key in a browser,
  unencrypted base URL and failing hooks.
- `characters.get(name)`.
