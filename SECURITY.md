# Security policy

## Supported versions

| Version        | Supported          |
| -------------- | ------------------ |
| Latest release | Yes                |
| Older releases | No, please upgrade |

Before 1.0.0, only the latest pre-release receives fixes.

## Reporting a vulnerability

Please **do not** open a public issue, discussion or pull request for security problems.

Report it privately through
[GitHub private vulnerability reporting](https://github.com/Umanthir/umanthir-sdk-js/security/advisories/new).
Include what you found, how to reproduce it, the affected versions and the impact you expect.

What to expect:

- Acknowledgement within 3 business days.
- An initial assessment within 7 days.
- A fix, or a mitigation plan, as soon as possible; we aim for 30 days for confirmed issues.
- Credit in the advisory, if you want it.

Problems in the Umanthir API service itself (`api.umanthir.com`) can be reported the same way; we
will route them to the right place.

## How releases are protected

- The npm package is published only from GitHub Actions, using npm trusted publishing (no long-lived
  tokens), with provenance attestations.
- The browser bundle is published with a Subresource Integrity (SRI) hash in every release.
- Every commit on `main` and `develop` is signed and goes through reviewed, checked pull requests.
