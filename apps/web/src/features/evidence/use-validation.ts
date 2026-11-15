"use client";

import { useQuery } from "@tanstack/react-query";
import { api, isFixtureResponse, unwrap } from "@/lib/api/client";
import type { Validation } from "@/lib/api/types";
import type { FieldState } from "@/lib/url-state";

export interface ValidationResult {
  data: Validation;
  /** True when the contract fixture answered (no engine, engine unreachable, or engine does not serve /v1/validation yet). */
  fromFixture: boolean;
}

export function useValidation(field: FieldState | null, language: "en" | "tr" = "en") {
  return useQuery<ValidationResult>({
    queryKey: ["validation", field?.lat, field?.lon, language],
    enabled: !!field,
    queryFn: async ({ signal }) => {
      const res = await api.GET("/v1/validation", { params: { query: { lat: field!.lat, lon: field!.lon, language } }, signal });
      return { data: unwrap(res), fromFixture: isFixtureResponse(res.response) };
    },
  });
}

/** First and last year of the back-test, or null when there are no years. */
export function period(v: Validation): [number, number] | null {
  if (!v.years.length) return null;
  const ys = v.years.map((y) => y.year);
  return [Math.min(...ys), Math.max(...ys)];
}
