import createClient from "openapi-fetch";
import { engineUrl } from "../engine";
import { mockResponse, SOURCE_HEADER } from "./mock";
import { setDataSource, type DataSource } from "./source";
import type { paths } from "./types";

const TIMEOUT_MS = 25_000;
const FALLBACK_STATUS = new Set([502, 503, 504]);
/** The contract defines no 404/501, so these mean the engine does not serve this route yet. */
const NOT_SERVED_STATUS = new Set([404, 501]);

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
 * - Engine answers 404/501 (route not built yet) → serve that route's fixture, marked as fixtures in the
 *   response header only; the app-wide badge keeps reporting the live engine.
 * - Otherwise → the engine's response, including its 4xx errors.
 */
export function createEngineFetch(base: string | null, report: (s: DataSource) => void = setDataSource) {
  return async function engineFetch(input: Request): Promise<Response> {
    const body = input.method === "GET" || input.method === "HEAD" ? null : await input.clone().text();
    const fromFixtures = (kind: DataSource) => {
      const res = mockResponse(input.method, input.url, body);
      if (!res) throw new ApiRequestError(`No fixture for ${input.method} ${new URL(input.url).pathname}`);
      report(kind);
      return res;
    };
    if (!base) return fromFixtures("fixtures");
    try {
      const res = await fetch(input, { signal: AbortSignal.any([input.signal, AbortSignal.timeout(TIMEOUT_MS)]) });
      if (FALLBACK_STATUS.has(res.status)) return fromFixtures("fallback");
      if (NOT_SERVED_STATUS.has(res.status)) {
        const mock = mockResponse(input.method, input.url, body);
        if (mock) return mock;
      }
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

/** True when this response came from the contract fixtures rather than the engine. */
export const isFixtureResponse = (res: Response) => res.headers.get(SOURCE_HEADER) === "fixtures";
