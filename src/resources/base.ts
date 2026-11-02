import type { QueryValue, RequestOptions, Transport } from "../core/transport.js";

/** Shared plumbing of the API resources. */
export abstract class Resource {
  readonly #transport: Transport;

  public constructor(transport: Transport) {
    this.#transport = transport;
  }

  /** GET a JSON resource. `path` must already have its dynamic segments encoded. */
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
}

/** Encodes one path segment. */
export function seg(value: string | number): string {
  return encodeURIComponent(String(value));
}
