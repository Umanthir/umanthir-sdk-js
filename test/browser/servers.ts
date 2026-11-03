import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

/** Request seen by the fake API, after CORS checks. */
export interface SeenRequest {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

// Same CORS policy as the real Umanthir API.
const ALLOWED_HEADERS = ["authorization", "content-type", "if-none-match"];
const EXPOSED =
  "ETag, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After, X-API-Version";

function listen(server: Server, host: string): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, host, () => {
      const { port } = server.address() as AddressInfo;
      resolve(`http://${host === "127.0.0.1" ? "127.0.0.1" : "localhost"}:${port}`);
    });
  });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
  });
}

function json(
  res: ServerResponse,
  status: number,
  body: unknown,
  extra: Record<string, string> = {},
) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": EXPOSED,
    "X-API-Version": "2.4.2",
    ...extra,
  });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

/** Fake Umanthir API on its own origin, enforcing the API's CORS rules. */
export async function startApi() {
  const seen: SeenRequest[] = [];
  const preflights: string[] = [];
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    if (req.method === "OPTIONS") {
      const requested = String(req.headers["access-control-request-headers"] ?? "")
        .split(",")
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);
      preflights.push(requested.join(","));
      if (!requested.every((h) => ALLOWED_HEADERS.includes(h))) {
        res.writeHead(403);
        res.end();
        return;
      }
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, If-None-Match",
      });
      res.end();
      return;
    }
    const body = await readBody(req);
    seen.push({
      method: req.method ?? "",
      path: url.pathname + url.search,
      headers: req.headers,
      body,
    });

    if (url.pathname === "/v2/community/characters/Njorn") {
      json(res, 200, { character_information: { name: "Njorn", level: 2013 }, deaths: [] });
    } else if (url.pathname.startsWith("/v2/community/characters/")) {
      json(res, 404, { error: { status_code: 404, message: "Character not found." } });
    } else if (url.pathname === "/v2/tools/online") {
      if (req.headers["if-none-match"] === '"e1"') {
        res.writeHead(304, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Expose-Headers": EXPOSED,
          ETag: '"e1"',
        });
        res.end();
      } else {
        json(res, 200, { fetched_at: "x", worlds: [], unknown: [], failed: [] }, { ETag: '"e1"' });
      }
    } else if (url.pathname === "/v2/tools/hunt/split" && req.method === "POST") {
      json(res, 200, { members: [], received: body.length });
    } else {
      json(res, 404, { error: { status_code: 404, message: "Not found." } });
    }
  });
  const origin = await listen(server, "localhost");
  return {
    origin,
    seen,
    preflights,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

/** Web page on another origin that loads dist/umanthir.min.js. */
export async function startPage() {
  const bundle = readFileSync(new URL("../../dist/umanthir.min.js", import.meta.url), "utf8");
  const server = createServer((req, res) => {
    if (req.url === "/umanthir.min.js") {
      res.writeHead(200, { "Content-Type": "text/javascript" });
      res.end(bundle);
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(
      '<!doctype html><meta charset="utf-8"><title>sdk</title><script src="/umanthir.min.js"></script>',
    );
  });
  const origin = await listen(server, "127.0.0.1");
  return { origin, close: () => new Promise<void>((r) => server.close(() => r())) };
}
