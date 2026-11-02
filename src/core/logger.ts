import { readEnv } from "./env.js";

/** Log levels, from silent to most verbose. */
export type LogLevel = "off" | "error" | "warn" | "info" | "debug";

/** Anything with the `console` logging methods, e.g. `console`, pino or winston. */
export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

const ORDER: Record<LogLevel, number> = { off: 0, error: 1, warn: 2, info: 3, debug: 4 };
const LEVELS = Object.keys(ORDER) as LogLevel[];
const PREFIX = "[umanthir]";
export const REDACTED = "[REDACTED]";
const SECRET_HEADERS = new Set(["authorization", "proxy-authorization", "cookie", "set-cookie"]);

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === "string" && (LEVELS as string[]).includes(value);
}

/** Level from `UMANTHIR_LOG` (Node.js only), when it holds a valid level. */
export function envLogLevel(): LogLevel | undefined {
  const value = readEnv("UMANTHIR_LOG")?.trim().toLowerCase();
  return isLogLevel(value) ? value : undefined;
}

/** Copy of the headers with credentials replaced by `[REDACTED]`. */
export function redactHeaders(headers: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = SECRET_HEADERS.has(key.toLowerCase()) ? REDACTED : value;
  }
  return out;
}

/** Shortens text to `max` characters, marking the cut. */
export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}… (${text.length - max} more chars)`;
}

/** Level-aware wrapper around a {@link Logger}, with a fixed prefix. */
export class LevelLogger {
  readonly #sink: Logger;
  readonly #level: number;

  public constructor(level: LogLevel, sink: Logger) {
    this.#level = ORDER[level];
    this.#sink = sink;
  }

  public enabled(level: Exclude<LogLevel, "off">): boolean {
    return this.#level >= ORDER[level];
  }

  public debug(message: string, data?: unknown): void {
    if (this.enabled("debug")) this.#write("debug", message, data);
  }

  public info(message: string, data?: unknown): void {
    if (this.enabled("info")) this.#write("info", message, data);
  }

  public warn(message: string, data?: unknown): void {
    if (this.enabled("warn")) this.#write("warn", message, data);
  }

  public error(message: string, data?: unknown): void {
    if (this.enabled("error")) this.#write("error", message, data);
  }

  #write(level: Exclude<LogLevel, "off">, message: string, data: unknown): void {
    try {
      if (data === undefined) this.#sink[level](`${PREFIX} ${message}`);
      else this.#sink[level](`${PREFIX} ${message}`, data);
    } catch {
      // A broken logger must never break a request.
    }
  }
}
