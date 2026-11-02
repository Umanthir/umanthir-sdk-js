import { describe, expectTypeOf, it } from "vitest";
import type {
  Character,
  CharacterInfo,
  Death,
  ErrorBody,
  HighscoreCategory,
  HighscorePage,
  OnlineBatch,
} from "../../src/index.js";

describe("public schema types", () => {
  it("Character keeps the API shape (snake_case, required deaths)", () => {
    expectTypeOf<Character["character_information"]>().toEqualTypeOf<CharacterInfo>();
    expectTypeOf<Character["deaths"]>().toEqualTypeOf<Death[]>();
  });

  it("ErrorBody is the API error envelope", () => {
    expectTypeOf<ErrorBody>().toEqualTypeOf<{ error: { message: string; status_code: number } }>();
  });

  it("enums become string unions", () => {
    expectTypeOf<"experience">().toExtend<HighscoreCategory>();
    expectTypeOf<"not-a-category">().not.toExtend<HighscoreCategory>();
  });

  it("schemas are not any", () => {
    expectTypeOf<HighscorePage>().not.toBeAny();
    expectTypeOf<OnlineBatch>().not.toBeAny();
  });
});

describe("client method types", () => {
  it("characters.get resolves to Character", async () => {
    const { Umanthir } = await import("../../src/index.js");
    const client = new Umanthir();
    expectTypeOf(client.characters.get).parameter(0).toEqualTypeOf<string>();
    expectTypeOf(client.characters.get).returns.toEqualTypeOf<Promise<Character>>();
  });
});
