import type {
  QueryValue,
  RequestOptions,
  Transport,
  TransportRequest,
  TransportResponse,
} from "../core/transport.js";
import type { UmanthirWarning } from "../core/warnings.js";

/** Shared plumbing of the API resources. */
export abstract class Resource {
  readonly #transport: Transport;

  /** @internal */
  public constructor(transport: Transport) {
    this.#transport = transport;
  }

  /** @internal GET a JSON resource. `path` must already have its dynamic segments encoded. */
  protected async call<T>(
    path: string,
    options: RequestOptions | undefined,
    query?: Readonly<Record<string, QueryValue>>,
  ): Promise<T> {
    const response = await this.#transport.request<T>(
      query === undefined
        ? { method: "GET", path, options }
        : { method: "GET", path, options, query },
    );
    return response.data as T;
  }

  /** @internal Full request, for routes that need status or headers (e.g. 304 with ETag). */
  protected send<T>(request: TransportRequest): Promise<TransportResponse<T>> {
    return this.#transport.request<T>(request);
  }

  /** @internal */
  protected warn(warning: UmanthirWarning): void {
    this.#transport.warn(warning);
  }

  /**
   * @internal Call at the start of a method marked `@deprecated`: warns once per client
   * (`DEPRECATED`), pointing to the replacement. Removal only happens in a major version.
   */
  protected deprecated(method: string, replacement: string): void {
    this.#transport.warnOnce(`sdk-deprecated:${method}`, {
      code: "DEPRECATED",
      message: `${method} is deprecated and will be removed in the next major version; use ${replacement}.`,
      details: { method, replacement },
    });
  }
}

import type { operations } from "../generated/openapi.js";

/** Query parameters of an API operation (from the contract). */
export type OperationQuery<K extends keyof operations> = NonNullable<
  operations[K]["parameters"]["query"]
>;
/** Path parameters of an API operation (from the contract). */
export type OperationPath<K extends keyof operations> = NonNullable<
  operations[K]["parameters"]["path"]
>;

/** Makes every property optional and accepts an explicit `undefined` (friendly to `exactOptionalPropertyTypes`). */
export type Loose<T> = { [K in keyof T]?: T[K] | undefined };

/** Encodes one path segment. */
export function seg(value: string | number): string {
  return encodeURIComponent(String(value));
}
