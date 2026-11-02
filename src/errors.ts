/**
 * Base class of every error thrown by the SDK.
 *
 * Use `instanceof UmanthirError` to tell SDK errors apart from other failures.
 */
export class UmanthirError extends Error {
  public override readonly name: string = "UmanthirError";

  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    // Keep `instanceof` working when the class is transpiled or bundled.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
