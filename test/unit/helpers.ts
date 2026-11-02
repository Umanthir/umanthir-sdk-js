import { vi } from "vitest";

export interface Call {
  url: string;
  init: RequestInit;
}

type Reply = Response | Error | ((call: Call) => Response | Promise<Response>);

/** Fake fetch answering with the queued replies in order; records every call. */
export function fakeFetch(...replies: Reply[]) {
  const calls: Call[] = [];
  const fn = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const call = { url: String(input), init };
    calls.push(call);
    const reply = replies.shift();
    if (reply === undefined) throw new Error("fakeFetch: no reply queued");
    if (reply instanceof Error) throw reply;
    return typeof reply === "function" ? reply(call) : reply;
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export function apiError(
  status: number,
  message: string,
  headers: Record<string, string> = {},
): Response {
  return json({ error: { status_code: status, message } }, status, headers);
}

/** Logger capturing every call, per level. */
export function memoryLogger() {
  const lines: { level: string; args: unknown[] }[] = [];
  const make =
    (level: string) =>
    (...args: unknown[]) => {
      lines.push({ level, args });
    };
  return {
    lines,
    logger: { debug: make("debug"), info: make("info"), warn: make("warn"), error: make("error") },
    text: () =>
      lines
        .map(
          (l) =>
            `${l.level} ${l.args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")}`,
        )
        .join("\n"),
  };
}
