# Umanthir SDK for JavaScript and TypeScript

Official SDK for the [Umanthir API](https://api.umanthir.com), for Node.js and browsers.

> **Status: pre-release.** The package is under active development and is not published to npm yet.
> The API below is the planned public surface of version 1.0.
- Written in TypeScript, ships ESM, CommonJS and type declarations
- Browser bundle `umanthir.min.js` exposing the global `Umanthir`
- Zero runtime dependencies
- Typed responses, typed errors, warnings and opt-in request/response debug logs

## Installation

```sh
npm install @umanthir/sdk
```

Browser, from a CDN (pin the exact version and use the `integrity` hash published with each release):

```html
<script
  src="https://cdn.jsdelivr.net/npm/@umanthir/sdk@<version>/dist/umanthir.min.js"
  integrity="sha384-<hash from the release notes>"
  crossorigin="anonymous"
></script>
```

## Usage

Node.js / bundlers:

```ts
import { Umanthir } from "@umanthir/sdk";

const client = new Umanthir();
const character = await client.characters.get("Njorn");
```

Browser:

```html
<script>
  const client = new Umanthir();
  client.characters.get("Njorn").then(console.log);
</script>
```

Responses keep the exact shape of the Umanthir API (`snake_case` fields, ISO-8601 dates as strings).

## Requirements

- Node.js 22.18 or later
- Evergreen browsers (ES2022)

## Compatibility

| SDK        | Umanthir API |
| ---------- | ------------ |
| unreleased | v2 (2.4.x)   |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Report security issues privately as described in
[SECURITY.md](./SECURITY.md), never in public issues.

## License

[MIT](./LICENSE)
