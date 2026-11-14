/**
 * Base URL of the engine API, or null when the mock layer (contract fixtures) should be used.
 * NEXT_PUBLIC_* values must be read as literal `process.env.X` expressions so Next.js inlines them.
 */
export function engineUrl(env: Record<string, string | undefined> = { NEXT_PUBLIC_ENGINE_URL: process.env.NEXT_PUBLIC_ENGINE_URL }): string | null {
  const url = env.NEXT_PUBLIC_ENGINE_URL?.trim();
  return url ? url.replace(/\/+$/, "") : null;
}

export const isMockMode = (env?: Record<string, string | undefined>) => engineUrl(env) === null;
