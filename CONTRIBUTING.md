# Contributing

Thanks for your interest in improving the Umanthir SDK.

## Ground rules

- Be respectful and constructive.
- Security issues are reported privately (see [SECURITY.md](./SECURITY.md)), never in issues or pull requests.
- The published package has **no runtime dependencies**. New development dependencies need a clear
  justification in the pull request.

## Branches

We use the [GitFlow](https://nvie.com/posts/a-successful-git-branching-model/) branching model.

| Branch                                                        | Purpose                                                              |
| ------------------------------------------------------------- | -------------------------------------------------------------------- |
| `main`                                                        | Released code. Changes only through release or hotfix pull requests. |
| `develop`                                                     | Integration branch. Pull requests target `develop`.                  |
| `feature/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>` | Your work, branched from `develop`.                                  |

Both `main` and `develop` are protected: changes go through pull requests, checks must pass and
commits must be signed.

## Commits

- Follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`,
  `chore:`, `test:`, `refactor:`, `perf:`, `ci:`, `build:`.
- [Sign your commits](https://docs.github.com/authentication/managing-commit-signature-verification)
  (SSH or GPG). Unsigned commits cannot be merged.
- Write the message in English and explain why the change is needed.

## Development

Requirements: Node.js 22.18 or later (see `.nvmrc`).

```sh
npm ci --ignore-scripts   # install exactly what the lockfile pins, without install scripts
npm run verify            # forbidden files, lint, typecheck, tests, build, package checks, size
```

Useful scripts:

| Script                            | What it does                                     |
| --------------------------------- | ------------------------------------------------ |
| `npm test`                        | Unit tests with coverage (90% minimum)           |
| `npm run build`                   | Builds `dist/` (ESM, CJS, types, browser bundle) |
| `npm run test:dist`               | Smoke tests of the built files                   |
| `npm run lint` / `npm run format` | Biome lint and formatting                        |
| `npm run check:package`           | publint and arethetypeswrong                     |
| `npm run size`                    | Browser bundle size budget                       |

## Pull requests

1. Branch from an up-to-date `develop`.
2. Add or update tests for every behavior change.
3. Add a line to the `Unreleased` section of [CHANGELOG.md](./CHANGELOG.md) for user-visible changes.
4. State the versioning impact (MAJOR, MINOR, PATCH or none) in the pull request.
5. Make sure `npm run verify` passes locally.

Do not commit secrets, `.env` files, editor or assistant configuration files. CI rejects them.
