"use client";

import { useQuery } from "@tanstack/react-query";
import { api, isFixtureResponse, unwrap } from "@/lib/api/client";
import type { FieldCalendar } from "@/lib/api/types";
import type { FieldState } from "@/lib/url-state";

/** Sowing and harvest dates, bare-field periods and monthly vulnerability of one sequence (engine #70). */
export function useCalendar(field: FieldState | null, sequence: string[], language: "en" | "tr") {
  return useQuery<{ data: FieldCalendar; fromFixture: boolean }>({
    queryKey: ["field-calendar", field?.lat, field?.lon, sequence.join(","), language],
    enabled: !!field && sequence.length > 0,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const res = await api.POST("/v1/field/calendar", { body: { lat: field!.lat, lon: field!.lon, sequence, language }, signal });
      return { data: unwrap(res), fromFixture: isFixtureResponse(res.response) };
    },
  });
}
