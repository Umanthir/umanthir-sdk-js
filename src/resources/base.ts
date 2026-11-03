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

  /** Full request, for routes that need status or headers (e.g. 304 with ETag). */
  protected send<T>(request: TransportRequest): Promise<TransportResponse<T>> {
    return this.#transport.request<T>(request);
  }

  protected warn(warning: UmanthirWarning): void {
    this.#transport.warn(warning);
  }
}

/** Makes every property optional and accepts an explicit `undefined` (friendly to `exactOptionalPropertyTypes`). */
export type Loose<T> = { [K in keyof T]?: T[K] | undefined };

/** Encodes one path segment. */
export function seg(value: string | number): string {
  return encodeURIComponent(String(value));
}
