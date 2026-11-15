"use client";

import { useQuery } from "@tanstack/react-query";
import { api, isFixtureResponse, unwrap } from "@/lib/api/client";
import type { FieldHazards } from "@/lib/api/types";
import type { FieldState } from "@/lib/url-state";

/** Frost, heat, heavy-rain and dry-spell indices per year from NASA POWER (engine #70). */
export function useHazards(field: FieldState | null, enabled = true) {
  return useQuery<{ data: FieldHazards; fromFixture: boolean }>({
    queryKey: ["field-hazards", field?.lat, field?.lon],
    enabled: !!field && enabled,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const res = await api.GET("/v1/field/hazards", { params: { query: { lat: field!.lat, lon: field!.lon } }, signal });
      return { data: unwrap(res), fromFixture: isFixtureResponse(res.response) };
    },
  });
}
