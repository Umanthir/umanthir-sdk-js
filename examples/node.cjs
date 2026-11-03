// CommonJS. Run from the repository root after `npm run build`: node examples/node.cjs
const { Umanthir } = require("@umanthir/sdk");

const client = new Umanthir();

client.worlds
  .list()
  .then((worlds) => console.log(worlds))
  .catch((error) => console.error(`${error.name}: ${error.message}`));
