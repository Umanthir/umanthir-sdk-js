#!/usr/bin/env node
// Prints the CHANGELOG section of a version, the CDN snippet with its SRI hash, and links.
//   node scripts/release-notes.mjs <version> <sri>
import { readFileSync } from "node:fs";

const [version, sri] = process.argv.slice(2);
if (
  !/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(version ?? "") ||
  !/^sha384-[A-Za-z0-9+/=]+$/.test(sri ?? "")
) {
  console.error("usage: release-notes.mjs <version> <sha384-...>");
  process.exit(1);
}
const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const escaped = version.replace(/[.+-]/g, "\\$&");
const section = new RegExp(
  `^## \\[${escaped}\\][^\\n]*\\n([\\s\\S]*?)(?=^## \\[|(?![\\s\\S]))`,
  "m",
).exec(changelog);
if (!section) {
  console.error(`CHANGELOG.md has no section for ${version}`);
  process.exit(1);
}
const cdn = `https://cdn.jsdelivr.net/npm/@umanthir/sdk@${version}/dist/umanthir.min.js`;
process.stdout.write(`${section[1].trim()}

## Install

\`\`\`sh
npm install @umanthir/sdk@${version}
\`\`\`

Browser:

\`\`\`html
<script
  src="${cdn}"
  integrity="${sri}"
  crossorigin="anonymous"
></script>
\`\`\`

## Verify

- npm provenance: https://www.npmjs.com/package/@umanthir/sdk/v/${version}#provenance
- \`npm audit signatures\` after installing
- Build attestations: \`gh attestation verify umanthir.min.js --repo Umanthir/umanthir-sdk-js\`
`);
