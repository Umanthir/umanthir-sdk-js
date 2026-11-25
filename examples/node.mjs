// Run from the repository root after `npm run build`: node examples/node.mjs
// Set UMANTHIR_API_KEY to also try the Tibia items (they need a token).
import { writeFile } from "node:fs/promises";
import { NotFoundError, Umanthir } from "@umanthir/sdk";

const client = new Umanthir({
  apiKey: process.env.UMANTHIR_API_KEY,
  onWarning: (warning) => console.warn(`[${warning.code}] ${warning.message}`),
});

try {
  const character = await client.characters.get("Njorn");
  console.log(character.character_information);

  const { highscores } = await client.highscores.list({ category: "experience" });
  console.log("Top 3:", highscores.rank_list.slice(0, 3));

  // TibiaWiki BR (texts in Portuguese).
  const demon = await client.wiki.creature("demon");
  console.log(demon.name, demon.hp, "HP,", demon.experience, "XP");
  console.log(
    "Loot:",
    (demon.loot ?? []).slice(0, 5).map((d) => `${d.item} (${d.rarity})`),
  );

  const spell = await client.wiki.spell("light healing");
  console.log(spell.name, spell.words, `${spell.mana} mana`);

  // Images need no token: a URL for <img src>, or the PNG bytes of a sprite.
  console.log("Gold coin image:", client.wiki.itemImageUrl(3031));

  if (process.env.UMANTHIR_API_KEY) {
    const { items, not_found } = await client.wiki.rawItemsByIds([3031, 3035]);
    console.log(
      items.map((item) => `${item.id} ${item.name}`),
      "not found:",
      not_found,
    );

    const preview = items[0]?.preview;
    if (preview) {
      await writeFile("sprite.png", await client.wiki.sprite(preview));
      console.log("Saved sprite.png");
    }
  }
} catch (error) {
  if (error instanceof NotFoundError) console.error("Not found:", error.apiMessage);
  else throw error;
}
