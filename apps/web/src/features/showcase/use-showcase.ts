"use client";

import { useQuery } from "@tanstack/react-query";
import { api, isFixtureResponse, unwrap } from "@/lib/api/client";
import type { Showcase, ShowcaseField } from "@/lib/api/types";

/**
 * Sites the picker never offers, with the reason shown next to it. The validation protocol and its results stay as
 * computed; this only decides which points are offered as example fields.
 */
export const NOT_A_FIELD = new Set(["us-kansas"]);

export function useShowcase() {
  return useQuery<{ data: Showcase; fromFixture: boolean }>({
    queryKey: ["showcase"],
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const res = await api.GET("/v1/showcase", { signal });
      return { data: unwrap(res), fromFixture: isFixtureResponse(res.response) };
    },
  });
}

/** Example fields: sites with a computed back-test whose point lies on farmland. */
export function pickable(fields: ShowcaseField[]) {
  return fields.filter((f) => f.validation.status === "ok" && !NOT_A_FIELD.has(f.id));
}
