/** Statuses worth retrying: rate limited and temporary upstream failures. */
export const RETRYABLE_STATUS: ReadonlySet<number> = new Set([429, 502, 503, 520]);

/** Methods safe to retry (no side effects). */
export const IDEMPOTENT_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD"]);

export const BASE_DELAY_MS = 500;
export const MAX_DELAY_MS = 30_000;

/**
 * Parses `Retry-After` (delta seconds or HTTP date) into milliseconds.
 * Returns undefined when absent or invalid.
 */
export function parseRetryAfter(value: string | undefined, now: number): number | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, date - now);
}

/** Exponential backoff with full jitter in [50%, 100%] of the step, capped. */
export function backoffDelay(attempt: number, random: () => number): number {
  const step = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
  return Math.round(step * (0.5 + random() * 0.5));
}

/** Resolves after `ms`, or rejects with the signal's reason when it aborts first. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
