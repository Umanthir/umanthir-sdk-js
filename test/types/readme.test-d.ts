// The README examples, type-checked so the documentation cannot drift from the SDK.
// They are compiled, never executed.
import { describe, expectTypeOf, it } from "vitest";
import {
  type Character,
  type HighscoreListOptions,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  Umanthir,
  type UmanthirWarning,
} from "../../src/index.js";

declare const metrics: { increment(name: string): void };

describe("README examples", () => {
  it("compile", () => {
    async function quickStart() {
      const client = new Umanthir();
      try {
        const character = await client.characters.get("Njorn");
        expectTypeOf(character).toEqualTypeOf<Character>();
        console.log(character.character_information.level);
      } catch (error) {
        if (error instanceof NotFoundError) console.log("No such character");
        else throw error;
      }
      new Umanthir().worlds.list().then((worlds) => console.log(worlds.players_online));
    }

    async function resources(client: Umanthir) {
      await client.highscores.list({
        world: "Antica",
        category: "magiclevel",
        vocation: "sorcerers",
      });
      await client.houses.list("Antica", "Thais", { state: "auctioned" });
      let etag: string | undefined;
      const res = await client.online.list(["Antica", "Yonabra"], { ifNoneMatch: etag });
      if (!res.notModified) console.log(res.data.worlds);
      etag = res.etag;
      await client.wiki.get("axes", "hellforged axe");
      await client.tools.levelForExperience(10n ** 18n);
      await client.tools.experienceGoal(600, { level: 500 });
    }

    async function errors(client: Umanthir) {
      try {
        await client.guilds.get("Alanui Institute");
      } catch (error) {
        if (error instanceof RateLimitError) console.log(`Try again in ${error.retryAfter} s`);
        else if (error instanceof ServiceUnavailableError && error.reason === "maintenance") {
          console.log("tibia.com is under maintenance");
        } else throw error;
      }
    }

    function options() {
      new Umanthir({
        onWarning: (warning: UmanthirWarning) =>
          metrics.increment(`umanthir.warning.${warning.code}`),
      });
      new Umanthir({ debug: true });
      new Umanthir({
        onResponse: ({ method, url, status, durationMs, attempt }) =>
          console.log(method, url, status, `${durationMs}ms`, `attempt ${attempt}`),
      });
    }

    async function cancellation(client: Umanthir) {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5_000);
      await client.highscores.list({}, { signal: controller.signal, maxRetries: 0 });
    }

    const filters: HighscoreListOptions = { vocation: "sorcerers", category: "magiclevel" };
    // @ts-expect-error: unknown vocation is a compile error
    const wrong: HighscoreListOptions = { vocation: "wizards" };

    expectTypeOf(quickStart).toBeFunction();
    expectTypeOf([resources, errors, options, cancellation, filters, wrong]).not.toBeAny();
  });
});
