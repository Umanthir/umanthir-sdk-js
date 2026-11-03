// Run from the repository root after `npm run build`: node examples/node.mjs
import { NotFoundError, Umanthir } from "@umanthir/sdk";

const client = new Umanthir({
  onWarning: (warning) => console.warn(`[${warning.code}] ${warning.message}`),
});

try {
  const character = await client.characters.get("Njorn");
  console.log(character.character_information);

  const { highscores } = await client.highscores.list({ category: "experience" });
  console.log("Top 3:", highscores.rank_list.slice(0, 3));
} catch (error) {
  if (error instanceof NotFoundError) console.error("Not found:", error.apiMessage);
  else throw error;
}
