/**
 * Entry of the browser bundle (`umanthir.min.js`).
 *
 * The global `Umanthir` is the client class itself, so `new Umanthir()` works,
 * and the error classes hang from it (`Umanthir.UmanthirError`).
 */
import { Umanthir } from "./client.js";
import { UmanthirError } from "./errors.js";

Object.defineProperty(Umanthir, "UmanthirError", {
  value: UmanthirError,
  enumerable: true,
});

export default Umanthir;
