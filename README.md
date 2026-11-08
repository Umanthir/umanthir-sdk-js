# Umanthir SDK for JavaScript and TypeScript

Official SDK for the [Umanthir API](https://api.umanthir.com), for Node.js and browsers.

> **Status: pre-release.** The package is under active development and is not published to npm yet.
- Every data route of the Umanthir API v2, with responses typed from the API contract
- ESM, CommonJS and type declarations for Node.js and bundlers
- Browser bundle `umanthir.min.js` (about 7 kB gzip) exposing the global `Umanthir`
- Typed errors, warnings, timeouts, retries with `Retry-After`, cancellation and opt-in debug logs
- Zero runtime dependencies

## Contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Client options](#client-options)
- [Resources](#resources)
- [Errors](#errors)
- [Warnings](#warnings)
- [Debug logs and hooks](#debug-logs-and-hooks)
- [Timeouts, retries and cancellation](#timeouts-retries-and-cancellation)
- [API keys](#api-keys)
- [TypeScript](#typescript)
- [Compatibility](#compatibility)
- [Security](#security)

## Installation

```sh
npm install @umanthir/sdk
```

Browser, from a CDN. Pin the exact version and use the `integrity` hash published with each release:

```html
<script
  src="https://cdn.jsdelivr.net/npm/@umanthir/sdk@<version>/dist/umanthir.min.js"
  integrity="sha384-<hash from the release notes>"
  crossorigin="anonymous"
></script>
```

Loading the bundle from JavaScript: set `crossOrigin` in camelCase. A lowercase `script.crossorigin`
does not enable CORS, so the browser refuses the integrity check and blocks the script:

```js
const script = document.createElement("script");
script.src = "https://cdn.jsdelivr.net/npm/@umanthir/sdk@<version>/dist/umanthir.min.js";
script.integrity = "sha384-<hash from the release notes>";
script.crossOrigin = "anonymous";
script.onload = () => {
  const client = new Umanthir();
  client.characters.get("Njorn").then(console.log);
};
document.head.append(script);
```

With a Content Security Policy, allow `https://cdn.jsdelivr.net` in `script-src` and
`https://api.umanthir.com` (or your `baseURL`) in `connect-src`.

Requirements: Node.js 22.18 or later, or an evergreen browser (ES2022).

## Quick start

Node.js and bundlers (ESM):

```ts
import { NotFoundError, Umanthir } from "@umanthir/sdk";

const client = new Umanthir();

try {
  const character = await client.characters.get("Njorn");
  console.log(character.character_information.level);
} catch (error) {
  if (error instanceof NotFoundError) console.log("No such character");
  else throw error;
}
```

CommonJS:

```js
const { Umanthir } = require("@umanthir/sdk");

new Umanthir().worlds.list().then((worlds) => console.log(worlds.players_online));
```

Browser:

```html
<script>
  const client = new Umanthir();
  client.characters
    .get("Njorn")
    .then(console.log)
    .catch((error) => {
      if (error instanceof Umanthir.NotFoundError) console.log("No such character");
    });
</script>
```

Responses keep the exact shape of the Umanthir API: `snake_case` fields and ISO-8601 dates as strings.
More examples are in [`examples/`](./examples).

## Client options

All options are optional.

| Option       | Default                    | Description                                                                                                        |
| ------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `baseURL`    | `https://api.umanthir.com` | API address. Must use `https`; `http` is allowed only for `localhost`.                                             |
| `apiKey`     | —                          | Sent as `Authorization: Bearer <apiKey>`. Never logged. See [API keys](#api-keys).                                 |
| `timeout`    | `30000`                    | Timeout of each attempt, in milliseconds.                                                                          |
| `maxRetries` | `2`                        | Retries after a network error, 429, 502, 503 or 520 (GET only).                                                    |
| `fetch`      | global `fetch`             | Custom `fetch` implementation.                                                                                     |
| `logLevel`   | `"warn"`                   | `"off"`, `"error"`, `"warn"`, `"info"` or `"debug"`. In Node.js, `UMANTHIR_LOG` sets it when the option is absent. |
| `debug`      | `false`                    | Shortcut for `logLevel: "debug"`.                                                                                  |
| `logger`     | `console`                  | Any object with `debug`, `info`, `warn` and `error` methods (pino, winston, ...).                                  |
| `logBodies`  | `false`                    | Include response bodies, truncated to 2 KB, in debug logs.                                                         |
| `onRequest`  | —                          | Called before every attempt, with redacted headers.                                                                |
| `onResponse` | —                          | Called after every attempt that got a response.                                                                    |
| `onWarning`  | —                          | Called for every [warning](#warnings).                                                                             |

Every method also accepts per-call options as its last argument: `{ signal, timeout, maxRetries }`.

## Resources

### Community

| Method                                                                         | Returns          |
| ------------------------------------------------------------------------------ | ---------------- |
| `characters.get(name)`                                                         | `Character`      |
| `highscores.list({ world, category, vocation, protection, types, page })`      | `HighscorePage`  |
| `highscores.character(name, { world, category, vocation, protection, types })` | `RankHit`        |
| `worlds.list()`                                                                | `WorldList`      |
| `worlds.get(world)`                                                            | `WorldDetail`    |
| `drome.rotations()`                                                            | `Rotations`      |
| `drome.rotations(world, page?)`                                                | `DromeRank`      |
| `killStatistics.get(world)`                                                    | `KillStatistics` |
| `fansites.list()`                                                              | `Fansites`       |
| `guilds.list(world)`                                                           | `GuildList`      |
| `guilds.get(name)`                                                             | `GuildDetail`    |
| `polls.list({ page })`                                                         | `Polls`          |
| `houses.list(world, town, { state, type, order })`                             | `HouseList`      |
| `houses.get(world, houseId)`                                                   | `HouseDetail`    |

```ts
const page = await client.highscores.list({
  world: "Antica",
  category: "magiclevel",
  vocation: "sorcerers",
});
const houses = await client.houses.list("Antica", "Thais", { state: "auctioned" });
```

### Library

| Method                                 | Returns           |
| -------------------------------------- | ----------------- |
| `library.achievements({ grade })`      | `AchievementList` |
| `library.boostableBosses()`            | `Bosses`          |
| `library.creatures({ creature_race })` | `Creatures`       |
| `library.experienceTable()`            | `ExperienceTable` |
| `library.maps({ region })`             | `MapList`         |
| `library.spells({ spell })`            | `SpellList`       |
| `library.worldQuests({ worldquest })`  | `WorldQuestList`  |

### Tools

| Method                                                           | Returns                                    |
| ---------------------------------------------------------------- | ------------------------------------------ |
| `online.list(worlds, { fields, ifNoneMatch })`                   | `{ notModified, etag, data: OnlineBatch }` |
| `online.character(name)`                                         | `Online`                                   |
| `tools.shareExperience(level \| levels[])`                       | `ShareExperience`                          |
| `tools.vocationStatus(vocation, level)`                          | `VocationStatus`                           |
| `tools.rawSkills({ vocation, sword, magic, loyalty, ... })`      | `RawSkills`                                |
| `tools.exerciseWeapons(charges)`                                 | `ExerciseTime`                             |
| `tools.experienceForLevel(level)`                                | `LevelExperience`                          |
| `tools.levelForExperience(experience)`                           | `ExperienceStatus`                         |
| `tools.experienceGoal(targetLevel, { level } \| { experience })` | `ExperienceGoal`                           |
| `tools.serverSave(timeZone)`                                     | `ServerSave`                               |
| `tools.splitHunt(analyzerText)`                                  | `HuntSplit`                                |

`online.list` reads up to 100 worlds in one call and supports ETags: an unchanged list answers
`notModified: true` and does not use quota.

```ts
let etag: string | undefined;
const res = await client.online.list(["Antica", "Yonabra"], { ifNoneMatch: etag });
if (!res.notModified) console.log(res.data.worlds);
etag = res.etag;
```

`levelForExperience` and `experienceGoal` accept a `bigint` for experience above 2^53.
`splitHunt` takes the text copied from the Party Hunt Analyzer; it is sent once (never retried) and
never logged. Its result has `session` with the hunt `date`, `start_time` and `duration`, as the
game shows them, or `null` when the text does not bring those lines.

`serverSave` takes an IANA time zone and answers the hour of the next server save there and how
long until it:

```ts
const save = await client.tools.serverSave("America/Sao_Paulo");
console.log(save.server_save_time, save.time_until.text); // 06:00 13 hours, 39 minutes
```

### Wiki

Data from TibiaWiki BR (texts in Portuguese).

| Method                             | Returns            |
| ---------------------------------- | ------------------ |
| `wiki.rashidLocation()`            | `RashidLocation`   |
| `wiki.categories()`                | `WikiCategoryList` |
| `wiki.list(category)`              | `WikiItemList`     |
| `wiki.get(category, name)`         | `WikiItem`         |
| `wiki.houses({ town, guildhall })` | `ClientHouseList`  |
| `wiki.house(slug)`                 | `HouseAssembly`    |
| `wiki.houseFloor(slug, z)`         | `Uint8Array` (PNG) |

```ts
const axe = await client.wiki.get("axes", "hellforged axe");
```

`wiki.houses` lists the houses published from the game client, which are not the auctions of
`houses.list`. A house that left the client throws `GoneError`; a renamed one has its new slug in
`replacedBy`.

```ts
import { writeFile } from "node:fs/promises";

const png = await client.wiki.houseFloor("thais-clanhall", 7);
await writeFile("floor-7.png", png);
```

## Errors

Every error thrown by the SDK extends `UmanthirError`. Errors from the API extend `APIError`, which
carries `status`, `apiMessage` (the API's `error.message`), `method`, `url`, `headers`, `body`,
`retryAfter` (seconds) and `apiVersion`.

| Class                     | When                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ValidationError`         | An argument was rejected before sending the request (bad name, page, level, ...).                        |
| `ConnectionError`         | The API could not be reached (DNS, TLS, connection reset, offline).                                      |
| `TimeoutError`            | An attempt took longer than `timeout` (extends `ConnectionError`).                                       |
| `AbortError`              | The request was cancelled through your `signal`.                                                         |
| `BadRequestError`         | 400: the API rejected an argument (`Unknown vocation.`, `Invalid page.`, ...).                           |
| `AuthenticationError`     | 401: the `apiKey` is malformed, unknown, revoked or expired.                                             |
| `ForbiddenError`          | 403: a site key used from another origin (`code: "origin_not_allowed"`).                                 |
| `NotFoundError`           | 404: character, guild, world, house, item or route not found.                                            |
| `GoneError`               | 410: the house left the client; `reason`, and `replacedBy` when renamed.                                 |
| `RateLimitError`          | 429: limit exceeded; `reason`, and `rateLimit` holds `{ limit, remaining, reset }`.                      |
| `UpstreamError`           | 502 or 520: the API could not read tibia.com.                                                            |
| `ServiceUnavailableError` | 503; `reason` is `"maintenance"`, `"busy"`, `"wiki_unavailable"`, `"houses_unavailable"` or `"unknown"`. |
| `APIError`                | Any other error status.                                                                                  |

```ts
import { RateLimitError, ServiceUnavailableError } from "@umanthir/sdk";

try {
  await client.guilds.get("Alanui Institute");
} catch (error) {
  if (error instanceof RateLimitError) console.log(`Try again in ${error.retryAfter} s`);
  else if (error instanceof ServiceUnavailableError && error.reason === "maintenance") {
    console.log("tibia.com is under maintenance");
  } else throw error;
}
```

In the browser bundle the classes are available on the global: `Umanthir.NotFoundError`,
`Umanthir.RateLimitError`, and so on.

## Warnings

Warnings report conditions that do not fail the call. They go to the logger at level `warn` and to
`onWarning({ code, message, details })`.

| Code                   | When                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `STALE_DATA`           | The API served a cached copy because the new tibia.com read failed (`stale: true`). |
| `PARTIAL_FAILURE`      | Some worlds of `online.list` failed or do not exist.                                |
| `RATE_LIMIT_LOW`       | 10% or less of the rate limit window is left.                                       |
| `RETRYING`             | A request is being retried, with the reason and the delay.                          |
| `API_VERSION_MISMATCH` | The API answered with another major version than the SDK supports.                  |
| `DEPRECATED`           | The API marked the route as deprecated (`Deprecation` or `Sunset` headers).         |
| `API_KEY_IN_BROWSER`   | An `apiKey` is used in a browser.                                                   |
| `INSECURE_BASE_URL`    | The base URL uses `http` (local development only).                                  |
| `HOOK_FAILED`          | An `onRequest` or `onResponse` hook threw; the request continued.                   |

```ts
const client = new Umanthir({
  onWarning: (warning) => metrics.increment(`umanthir.warning.${warning.code}`),
});
```

## Debug logs and hooks

```ts
const client = new Umanthir({ debug: true });
await client.characters.get("Njorn");
// [umanthir] → GET https://api.umanthir.com/v2/community/characters/Njorn (attempt 1)
// [umanthir] ← 200 GET https://api.umanthir.com/v2/community/characters/Njorn 182ms X-API-Version=2.7.0 RateLimit-Remaining=59
```

In Node.js, `UMANTHIR_LOG=debug node app.js` enables it without code changes. Credentials are always
replaced by `[REDACTED]`; response bodies are logged only with `logBodies: true`, truncated to 2 KB;
request bodies are never logged.

Hooks receive structured data, for metrics or tracing:

```ts
const client = new Umanthir({
  onResponse: ({ method, url, status, durationMs, attempt }) =>
    console.log(method, url, status, `${durationMs}ms`, `attempt ${attempt}`),
});
```

Nothing leaves your process: the SDK has no telemetry.

## Timeouts, retries and cancellation

- Each attempt has a timeout (`timeout`, 30 s by default).
- GET requests are retried after a network error, 429, 502, 503 or 520, up to `maxRetries` (2), with
  exponential backoff and jitter. A `Retry-After` from the API is honored when it is up to 30 s;
  longer waits are not retried and surface as the error, with `retryAfter` set.
- POST (`tools.splitHunt`) is never retried.
- Pass an `AbortSignal` to cancel a call, including any pending retry:

```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 5_000);
await client.highscores.list({}, { signal: controller.signal, maxRetries: 0 });
```

## API keys

The Umanthir API can be used without a key. When you have one, pass it as `apiKey`; it is sent as
`Authorization: Bearer <key>` and never appears in logs, hooks, errors, `JSON.stringify(client)` or
`console.log(client)`.

Do not ship a key in browser code: anyone using the page can read it. The SDK warns with
`API_KEY_IN_BROWSER` when it sees one. Keep keys on your server and call the API from there.

The exception is a site key, a key the Umanthir team issues for one website. It is meant for the
browser: the API accepts it only from that site's exact origins, with a cap per visitor IP. The
warning still appears, and you can ignore it for a site key.

With a key, the limits are the ones of your plan: a peak per minute per key and a monthly quota per
application, and `RateLimitError.reason` tells them apart (`rate_limit`, `ip_limit`,
`monthly_quota`, `daily_quota`). A used-up quota is not retried: `retryAfter` says when it returns.

## TypeScript

Every response type is exported with the name of its schema in the API contract (`Character`,
`HighscorePage`, `GuildDetail`, ...), as are the option types (`UmanthirOptions`, `RequestOptions`,
`HighscoreListOptions`, ...). Filters only accept the values the API knows:

```ts
import type { Character, HighscoreListOptions } from "@umanthir/sdk";

const filters: HighscoreListOptions = { vocation: "sorcerers", category: "magiclevel" };
// { vocation: "wizards" } is a compile error.
```

`API_CONTRACT_VERSION` holds the version of the API contract the types were generated from.

## Compatibility

| SDK          | Umanthir API        |
| ------------ | ------------------- |
| 1.0.0        | v2 (contract 2.4.2) |
| 0.1.0-beta.1 | v2 (contract 2.4.2) |

The SDK follows [Semantic Versioning](https://semver.org/). Breaking changes to the public API only
happen in major versions, after a deprecation period.

## Security

- Report vulnerabilities privately, as described in [SECURITY.md](./SECURITY.md).
- Releases are published only from GitHub Actions with npm trusted publishing and provenance; the
  browser bundle comes with a Subresource Integrity hash.
- Base URLs must use `https`; path and query values are validated and encoded; requests send no
  cookies and refuse redirects.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE)
