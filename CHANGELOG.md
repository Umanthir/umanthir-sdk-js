# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- API contract 2.7.0.
- `tools.serverSave(timeZone)`: the next server save in an IANA time zone and how long until it.
- `wiki.houses()`, `wiki.house(slug)` and `wiki.houseFloor(slug, z)`: the houses published from the
  game client, their assembly JSON and one transparent PNG per floor.
- `session` in the result of `tools.splitHunt`: hunt date, start time and duration.
- `AuthenticationError` (401), `ForbiddenError` (403) and `GoneError` (410), also on the browser
  global.
- `APIError.code`, `RateLimitError.reason` and the `houses_unavailable` reason of
  `ServiceUnavailableError`.

## [1.0.0] - 2026-11-02

First stable release. It covers every data route of the Umanthir API v2 (contract 2.4.2) and keeps
the public API of 0.1.0-beta.1.

### Added

- README: loading the browser bundle from JavaScript with SRI (`crossOrigin` in camelCase) and the
  Content Security Policy directives it needs.

## [0.1.0-beta.1] - 2026-11-02

First pre-release, published with the `next` dist-tag.

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
- Warnings: stale data served from the API cache (`stale: true`), low rate limit, retries, API version mismatch, deprecations, API key in a browser,
  unencrypted base URL and failing hooks.
- `characters.get(name)`.
- Community resources: `highscores.list(filters)`, `highscores.character(name, filters)`,
  `worlds.list()`, `worlds.get(world)`, `drome.rotations()`, `drome.rotations(world, page?)`,
  `killStatistics.get(world)`, `fansites.list()`, `guilds.list(world)`, `guilds.get(name)`,
  `polls.list({ page })`, `houses.list(world, town, filters)` and `houses.get(world, houseId)`.
- Library resources: `library.achievements({ grade })`, `library.boostableBosses()`,
  `library.creatures({ creature_race })`, `library.experienceTable()`, `library.maps({ region })`,
  `library.spells({ spell })` and `library.worldQuests({ worldquest })`.
- Tools resources: `online.list(worlds, { fields, ifNoneMatch })` (ETag, `notModified` on 304,
  warnings for stale, failed and unknown worlds), `online.character(name)`,
  `tools.shareExperience(levels)`, `tools.vocationStatus(vocation, level)`, `tools.rawSkills(params)`,
  `tools.exerciseWeapons(charges)`, `tools.experienceForLevel(level)`,
  `tools.levelForExperience(experience)` (number or bigint), `tools.experienceGoal(target, from)`
  and `tools.splitHunt(text)` (sent once as `text/plain`, never logged).
- Release workflow: npm trusted publishing with provenance, build attestations, SBOM and the SRI
  hash of the browser bundle in every GitHub release.
- Contract types `components` and `operations`, and the helpers `OperationQuery`, `OperationPath`
  and `Loose`, are exported. A public API report (`etc/umanthir-sdk.api.md`) is checked in CI.
- Optional properties of every options and filter type accept an explicit `undefined`, so code
  compiled with `exactOptionalPropertyTypes` can pass values such as `ifNoneMatch: etag`.
- Browser bundle tested in Chromium, Firefox and WebKit against an API with the real CORS rules;
  examples for the browser, Node.js ESM and CommonJS.
- Wiki resources: `wiki.rashidLocation()`, `wiki.categories()`, `wiki.list(category)` and
  `wiki.get(category, name)`.

[Unreleased]: https://github.com/Umanthir/umanthir-sdk-js/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Umanthir/umanthir-sdk-js/compare/v0.1.0-beta.1...v1.0.0
[0.1.0-beta.1]: https://github.com/Umanthir/umanthir-sdk-js/releases/tag/v0.1.0-beta.1
