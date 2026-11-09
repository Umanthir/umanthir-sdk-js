import { ValidationError } from "./errors.js";

/** Options of {@link formatDate}. */
export interface FormatDateOptions {
  /** IANA time zone of the result, such as `America/Sao_Paulo`. Defaults to `UTC`. */
  timeZone?: string | undefined;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const TOKEN = /'[^']*'|yyyy|MM|dd|HH|hh|mm|ss|a/g;
const TIME_TOKENS: ReadonlySet<string> = new Set(["HH", "hh", "mm", "ss", "a"]);

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isCalendarDate(year: string, month: string, day: string): boolean {
  const at = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return at.getUTCMonth() === Number(month) - 1 && at.getUTCDate() === Number(day);
}

function formatter(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    throw new ValidationError("timeZone must be an IANA name, such as America/Sao_Paulo.");
  }
}

function checkedTimestamp(value: unknown): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new ValidationError("The date is invalid.");
    return value;
  }
  const match = typeof value === "string" ? TIMESTAMP.exec(value) : null;
  const at = match === null ? undefined : new Date(value as string);
  if (
    match === null ||
    at === undefined ||
    Number.isNaN(at.getTime()) ||
    !isCalendarDate(match[1] as string, match[2] as string, match[3] as string)
  ) {
    throw new ValidationError(
      "date must be a date from the API (RFC 3339 or yyyy-MM-dd) or a Date.",
    );
  }
  return at;
}

/**
 * Formats a date from the API, which come as text in UTC.
 *
 * Tokens: `yyyy`, `MM`, `dd`, `hh` (12 hours), `HH` (24 hours), `mm`, `ss` and `a` (AM/PM). Text
 * between single quotes is kept as it is. A pattern with `hh` and no `a` ends with ` AM` or ` PM`.
 * A date without a time, such as `2018-01-16`, never changes day with the time zone.
 *
 * @param date Date text from the API, or a `Date`.
 * @param pattern Pattern made of the tokens above.
 * @throws {ValidationError} for an invalid date, pattern or time zone, or when the pattern asks
 * for the time of a date that has none.
 *
 * @example
 * ```ts
 * formatDate("2011-01-07T03:41:16Z", "dd/MM/yyyy"); // 07/01/2011
 * formatDate("2011-01-07T03:41:16Z", "dd/MM/yyyy - hh:mm"); // 07/01/2011 - 03:41 AM
 * formatDate("2011-01-07T03:41:16Z", "HH:mm", { timeZone: "Asia/Tokyo" }); // 12:41
 * ```
 */
export function formatDate(
  date: string | Date,
  pattern: string,
  options: FormatDateOptions = {},
): string {
  if (typeof pattern !== "string" || pattern === "") {
    throw new ValidationError("pattern must be a non-empty string.");
  }
  const tokens: readonly string[] = pattern.match(TOKEN) ?? [];
  if (/[A-Za-z']/.test(pattern.replace(TOKEN, ""))) {
    throw new ValidationError(
      "pattern accepts yyyy, MM, dd, hh, HH, mm, ss and a; quote other text with single quotes.",
    );
  }
  const format = formatter(options.timeZone ?? "UTC");

  const dateOnly = typeof date === "string" ? DATE_ONLY.exec(date) : null;
  let values: Record<string, string>;
  if (dateOnly !== null) {
    const [, year, month, day] = dateOnly as unknown as [string, string, string, string];
    if (!isCalendarDate(year, month, day)) {
      throw new ValidationError(
        "date must be a date from the API (RFC 3339 or yyyy-MM-dd) or a Date.",
      );
    }
    if (tokens.some((token) => TIME_TOKENS.has(token))) {
      throw new ValidationError(
        `${date as string} has no time; pattern can only ask for yyyy, MM and dd.`,
      );
    }
    values = { year, month, day, hour: "00", minute: "00", second: "00" };
  } else {
    values = {};
    for (const part of format.formatToParts(checkedTimestamp(date))) values[part.type] = part.value;
  }

  const hour = Number(values["hour"]);
  const meridiem = hour < 12 ? "AM" : "PM";
  const replacements: Record<string, string> = {
    yyyy: (values["year"] as string).padStart(4, "0"),
    MM: values["month"] as string,
    dd: values["day"] as string,
    HH: pad(hour),
    hh: pad(hour % 12 || 12),
    mm: values["minute"] as string,
    ss: values["second"] as string,
    a: meridiem,
  };
  const text = pattern.replace(TOKEN, (token) =>
    token.startsWith("'") ? token.slice(1, -1) : (replacements[token] as string),
  );
  return tokens.includes("hh") && !tokens.includes("a") ? `${text} ${meridiem}` : text;
}
