"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { api, isFixtureResponse, unwrap } from "@/lib/api/client";
import type { FieldAnalysis, FieldNdvi } from "@/lib/api/types";
import { toGeometry } from "@/lib/geo";
import { parseField, writeField, type FieldState } from "@/lib/url-state";

/** Field state lives in the URL so every view is shareable. */
export function useField() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const key = params.toString();
  const field = useMemo(() => parseField(new URLSearchParams(key)), [key]);

  const setField = useCallback(
    (next: FieldState | null) => {
      const qs = writeField(new URLSearchParams(window.location.search), next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  return { field, setField };
}

export function useFieldAnalysis(field: FieldState | null) {
  return useQuery<FieldAnalysis>({
    queryKey: ["field-analyze", field?.lat, field?.lon, field?.ring, field?.irrigated],
    enabled: !!field,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.POST("/v1/field/analyze", {
          body: {
            lat: field!.lat,
            lon: field!.lon,
            irrigated: field!.irrigated,
            ...(field!.ring ? { geometry: toGeometry(field!.ring) } : {}),
          },
          signal,
        }),
      ),
  });
}

/** 30 m HLS NDVI. A separate, possibly slow request (cold: about 2 minutes), loaded after the field summary. */
export function useFieldNdvi(field: FieldState | null, enabled = true) {
  return useQuery<{ data: FieldNdvi; fromFixture: boolean }>({
    queryKey: ["field-ndvi", field?.lat, field?.lon],
    enabled: !!field && enabled,
    queryFn: async ({ signal }) => {
      const res = await api.GET("/v1/field/ndvi", { params: { query: { lat: field!.lat, lon: field!.lon } }, signal });
      return { data: unwrap(res), fromFixture: isFixtureResponse(res.response) };
    },
  });
}
