import { ValidationError } from "../errors.js";

const NBSP = / /g;
// Characters the API rejects in names (400 "Invalid name.").
const NAME_FORBIDDEN = /[/\\?#&]/;
// Guild and town names also reject `%`.
const STRICT_FORBIDDEN = /[/\\?#&%]/;
// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what we reject
const CONTROL = /[\u0000-\u001f\u007f]/;

export interface NameOptions {
  /** Also reject `%` (guilds, towns, houses). */
  strict?: boolean;
  /** Accept any printable character (still encoded in the URL). */
  anyText?: boolean;
  /** Maximum length. Default: 100. */
  max?: number;
}

/** Validates a name used in a URL path and returns it normalized (NBSP → space, trimmed). */
export function pathName(label: string, value: unknown, options: NameOptions = {}): string {
  if (typeof value !== "string") throw new ValidationError(`${label} must be a string.`);
  const normalized = value.replace(NBSP, " ").trim();
  if (normalized === "") throw new ValidationError(`${label} must not be empty.`);
  if (normalized.length > (options.max ?? 100)) throw new ValidationError(`${label} is too long.`);
  if (CONTROL.test(normalized)) throw new ValidationError(`${label} contains control characters.`);
  if (options.anyText) return normalized;
  const forbidden = options.strict ? STRICT_FORBIDDEN : NAME_FORBIDDEN;
  if (forbidden.test(normalized)) {
    throw new ValidationError(
      `${label} must not contain ${options.strict ? "/ \\ ? # & or %" : "/ \\ ? # or &"}.`,
    );
  }
  return normalized;
}

/** Validates a positive integer (>= min). */
export function positiveInt(label: string, value: unknown, min = 1): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min) {
    throw new ValidationError(`${label} must be an integer greater than or equal to ${min}.`);
  }
  return value;
}

/** Validates free text sent in a query string (encoded by URLSearchParams). */
export function queryText(label: string, value: unknown, max = 100): string {
  if (typeof value !== "string") throw new ValidationError(`${label} must be a string.`);
  const normalized = value.replace(NBSP, " ").trim();
  if (normalized === "") throw new ValidationError(`${label} must not be empty.`);
  if (normalized.length > max) throw new ValidationError(`${label} is too long.`);
  if (CONTROL.test(normalized)) throw new ValidationError(`${label} contains control characters.`);
  return normalized;
}

/** Validates an integer within [min, max]. */
export function intInRange(label: string, value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new ValidationError(`${label} must be an integer between ${min} and ${max}.`);
  }
  return value;
}
