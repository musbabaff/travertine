import createClient from "openapi-fetch";
import { engineUrl } from "../engine";
import { mockResponse, SOURCE_HEADER } from "./mock";
import { setDataSource, type DataSource } from "./source";
import type { paths } from "./types";

const TIMEOUT_MS = 25_000;
const FALLBACK_STATUS = new Set([502, 503, 504]);

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

/**
 * fetch implementation used by the typed client.
 * - No engine configured → serve fixtures.
 * - Engine configured but unreachable (network error, timeout, 502/503/504) → serve fixtures and flag "fallback".
 * - Otherwise → the engine's response, including its 4xx errors.
 */
export function createEngineFetch(base: string | null, report: (s: DataSource) => void = setDataSource) {
  return async function engineFetch(input: Request): Promise<Response> {
    const fromFixtures = (kind: DataSource) => {
      const res = mockResponse(input.method, input.url);
      if (!res) throw new ApiRequestError(`No fixture for ${input.method} ${new URL(input.url).pathname}`);
      report(kind);
      return res;
    };
    if (!base) return fromFixtures("fixtures");
    try {
      const res = await fetch(input, { signal: AbortSignal.any([input.signal, AbortSignal.timeout(TIMEOUT_MS)]) });
      if (FALLBACK_STATUS.has(res.status)) return fromFixtures("fallback");
      report(res.headers.get(SOURCE_HEADER) === "fixtures" ? "fixtures" : "engine");
      return res;
    } catch (err) {
      if (input.signal.aborted) throw err;
      return fromFixtures("fallback");
    }
  };
}

const base = engineUrl();
export const api = createClient<paths>({ baseUrl: base ?? "http://mock.local", fetch: createEngineFetch(base) });

/** Unwraps an openapi-fetch result, throwing a typed error for non-2xx responses. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.data !== undefined) return result.data;
  const e = result.error as { message?: string; code?: string } | undefined;
  throw new ApiRequestError(e?.message ?? `HTTP ${result.response.status}`, result.response.status, e?.code);
}
