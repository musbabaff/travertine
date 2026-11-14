"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { api, unwrap } from "@/lib/api/client";
import type { FieldAnalysis } from "@/lib/api/types";
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
