interface NodeLikeProcess {
  versions?: { node?: string };
  env?: Record<string, string | undefined>;
}

function nodeProcess(): NodeLikeProcess | undefined {
  const p = (globalThis as { process?: NodeLikeProcess }).process;
  return typeof p?.versions?.node === "string" ? p : undefined;
}

/** True in browsers (and browser-like workers), false in Node.js and other server runtimes. */
export function isBrowser(): boolean {
  const g = globalThis as { window?: unknown; document?: unknown };
  return typeof g.window !== "undefined" && typeof g.document !== "undefined";
}

/** Node.js version (e.g. "24.1.0"), or undefined outside Node.js. */
export function nodeVersion(): string | undefined {
  return nodeProcess()?.versions?.node;
}

/** Reads an environment variable in Node.js; always undefined in browsers. */
export function readEnv(name: string): string | undefined {
  return nodeProcess()?.env?.[name];
}
