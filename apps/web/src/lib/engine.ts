/** Base URL of the engine API, or null when the mock layer (contract fixtures) should be used. */
export function engineUrl(env: Record<string, string | undefined> = process.env): string | null {
  const url = env.NEXT_PUBLIC_ENGINE_URL?.trim();
  return url ? url.replace(/\/+$/, "") : null;
}

export const isMockMode = (env?: Record<string, string | undefined>) => engineUrl(env) === null;
