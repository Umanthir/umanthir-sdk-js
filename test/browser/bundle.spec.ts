import { expect, test } from "@playwright/test";
import { startApi, startPage } from "./servers.js";

let api: Awaited<ReturnType<typeof startApi>>;
let site: Awaited<ReturnType<typeof startPage>>;

test.beforeAll(async () => {
  api = await startApi();
  site = await startPage();
});

test.afterAll(async () => {
  await api.close();
  await site.close();
});

test.beforeEach(async ({ page }) => {
  api.seen.length = 0;
  api.preflights.length = 0;
  await page.goto(site.origin);
});

test("the global Umanthir is the client class with the error classes", async ({ page }) => {
  const info = await page.evaluate(() => {
    const U = (window as unknown as { Umanthir: Record<string, unknown> & (new () => object) })
      .Umanthir;
    return {
      type: typeof U,
      version: typeof U.version,
      formatDate: (U.formatDate as (d: string, p: string) => string)("2011-01-07", "dd/MM/yyyy"),
      errors: [
        "NotFoundError",
        "RateLimitError",
        "ValidationError",
        "UmanthirError",
        "AuthenticationError",
        "ForbiddenError",
        "GoneError",
      ].every((n) => typeof U[n] === "function"),
    };
  });
  expect(info).toEqual({
    type: "function",
    version: "string",
    formatDate: "07/01/2011",
    errors: true,
  });
});

test("README example: new Umanthir().characters.get(...).then(...)", async ({ page }) => {
  const result = await page.evaluate((base) => {
    // biome-ignore lint/suspicious/noExplicitAny: browser global
    const U = (window as any).Umanthir;
    return new U({ baseURL: base, logLevel: "off" }).characters
      .get("Njorn")
      .then((c: { character_information: { name: string } }) => c.character_information.name);
  }, api.origin);
  expect(result).toBe("Njorn");
  // Simple GET: no CORS preflight, no User-Agent override, no custom headers.
  expect(api.preflights).toEqual([]);
  const headers = api.seen[0]?.headers ?? {};
  expect(headers.authorization).toBeUndefined();
  expect(Object.keys(headers).filter((h) => h.startsWith("x-"))).toEqual([]);
});

test("API errors are instances of the global error classes", async ({ page }) => {
  const result = await page.evaluate((base) => {
    // biome-ignore lint/suspicious/noExplicitAny: browser global
    const U = (window as any).Umanthir;
    return new U({ baseURL: base, logLevel: "off" }).characters
      .get("Nobody")
      .catch((e: Error & { status: number; apiMessage: string }) => ({
        notFound: e instanceof U.NotFoundError,
        base: e instanceof U.UmanthirError,
        status: e.status,
        message: e.apiMessage,
      }));
  }, api.origin);
  expect(result).toEqual({
    notFound: true,
    base: true,
    status: 404,
    message: "Character not found.",
  });
});

test("invalid input rejects without a request", async ({ page }) => {
  const result = await page.evaluate((base) => {
    // biome-ignore lint/suspicious/noExplicitAny: browser global
    const U = (window as any).Umanthir;
    return new U({ baseURL: base, logLevel: "off" }).characters
      .get("a/b")
      .catch((e: Error) => e instanceof U.ValidationError);
  }, api.origin);
  expect(result).toBe(true);
  expect(api.seen).toEqual([]);
});

test("apiKey: the preflight asks only for Authorization and the call succeeds, with a warning", async ({
  page,
}) => {
  const warnings: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "warning") warnings.push(m.text());
  });
  const result = await page.evaluate((base) => {
    // biome-ignore lint/suspicious/noExplicitAny: browser global
    const U = (window as any).Umanthir;
    return new U({ baseURL: base, apiKey: "browser-test-key" }).characters
      .get("Njorn")
      .then(() => "ok");
  }, api.origin);
  expect(result).toBe("ok");
  expect(api.preflights).toEqual(["authorization"]);
  expect(api.seen[0]?.headers.authorization).toBe("Bearer browser-test-key");
  expect(warnings.some((w) => w.includes("API_KEY_IN_BROWSER"))).toBe(true);
});

test("debug logs go to the browser console without the API key", async ({ page }) => {
  const lines: string[] = [];
  page.on("console", (m) => lines.push(m.text()));
  await page.evaluate((base) => {
    // biome-ignore lint/suspicious/noExplicitAny: browser global
    const U = (window as any).Umanthir;
    return new U({ baseURL: base, apiKey: "browser-test-key", debug: true }).characters.get(
      "Njorn",
    );
  }, api.origin);
  const text = lines.join("\n");
  expect(text).toContain("→ GET");
  expect(text).toContain("← 200 GET");
  expect(text).toContain("X-API-Version=2.4.2");
  expect(text).not.toContain("browser-test-key");
});

test("online.list: ETag and 304 work through CORS (If-None-Match allowed)", async ({ page }) => {
  const result = await page.evaluate(async (base) => {
    // biome-ignore lint/suspicious/noExplicitAny: browser global
    const U = (window as any).Umanthir;
    const c = new U({ baseURL: base, logLevel: "off" });
    const first = await c.online.list(["Antica"]);
    const second = await c.online.list(["Antica"], { ifNoneMatch: first.etag });
    return { etag: first.etag, first: first.notModified, second: second.notModified };
  }, api.origin);
  expect(result).toEqual({ etag: '"e1"', first: false, second: true });
  expect(api.preflights).toEqual(["if-none-match"]);
});

test("splitHunt: text/plain POST without a CORS preflight", async ({ page }) => {
  const result = await page.evaluate((base) => {
    // biome-ignore lint/suspicious/noExplicitAny: browser global
    const U = (window as any).Umanthir;
    return new U({ baseURL: base, logLevel: "off" }).tools.splitHunt(
      "A\n  Balance: 1\nB\n  Balance: 2\n",
    );
  }, api.origin);
  expect(result).toMatchObject({ members: [] });
  expect(api.preflights).toEqual([]);
  expect(api.seen[0]?.method).toBe("POST");
  expect(String(api.seen[0]?.headers["content-type"])).toContain("text/plain");
});
