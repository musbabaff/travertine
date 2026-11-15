"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { api, isFixtureResponse, unwrap } from "@/lib/api/client";
import type { FieldAnalysis, FieldNdvi, NdviYear, Provenance, Soil } from "@/lib/api/types";
import { isMockMode } from "@/lib/engine";
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

/** The field analysis as it arrives: climate first, soil and vegetation when their own requests answer. */
export interface FieldView extends Omit<FieldAnalysis, "soil"> {
  soil?: Soil;
  soilPending: boolean;
  ndviPending: boolean;
}

export interface FieldViewQuery {
  data: FieldView | undefined;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

const coords = (field: FieldState) => ({ params: { query: { lat: field.lat, lon: field.lon } } });

/**
 * With a live engine, climate, soil and vegetation come from their own endpoints, so the climate (a few seconds for
 * a new location) shows without waiting for SoilGrids or MODIS (often 20–30 s). Without an engine, the analysis
 * fixture answers in one piece.
 */
export function useFieldAnalysis(field: FieldState | null): FieldViewQuery {
  const mock = isMockMode();
  const full = useQuery<FieldAnalysis>({
    queryKey: ["field-analyze", field?.lat, field?.lon, field?.ring, field?.irrigated],
    enabled: !!field && mock,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.POST("/v1/field/analyze", {
          body: { lat: field!.lat, lon: field!.lon, irrigated: field!.irrigated, ...(field!.ring ? { geometry: toGeometry(field!.ring) } : {}) },
          signal,
        }),
      ),
  });
  const climate = useQuery({
    queryKey: ["field-climate", field?.lat, field?.lon],
    enabled: !!field && !mock,
    queryFn: async ({ signal }) => unwrap(await api.GET("/v1/field/climate", { ...coords(field!), signal })),
  });
  const soil = useQuery({
    queryKey: ["field-soil", field?.lat, field?.lon],
    enabled: !!field && !mock,
    queryFn: async ({ signal }) => unwrap(await api.GET("/v1/field/soil", { ...coords(field!), signal })),
  });
  const vegetation = useQuery({
    queryKey: ["field-vegetation", field?.lat, field?.lon],
    enabled: !!field && !mock,
    retry: false,
    queryFn: async ({ signal }) => {
      const res = await api.GET("/v1/field/vegetation", { ...coords(field!), signal });
      return isFixtureResponse(res.response) ? null : unwrap(res);
    },
  });

  if (mock) {
    return {
      data: full.data ? { ...full.data, soilPending: false, ndviPending: false } : undefined,
      isPending: full.isPending,
      isError: full.isError,
      error: full.error,
      refetch: () => void full.refetch(),
    };
  }
  const c = climate.data;
  const ndvi: NdviYear[] | undefined = vegetation.data?.ndvi_history;
  const provenance: Provenance[] = c
    ? [...c.provenance, ...(soil.data?.provenance ?? []), ...(vegetation.data?.provenance ?? [])]
    : [];
  return {
    data: c
      ? {
          field_id: c.field_id,
          climate: c.climate,
          soil: soil.data?.soil,
          ndvi_history: ndvi && ndvi.length ? ndvi : undefined,
          provenance,
          soilPending: soil.isPending,
          ndviPending: vegetation.isPending,
        }
      : undefined,
    isPending: climate.isPending,
    isError: climate.isError,
    error: climate.error,
    refetch: () => {
      void climate.refetch();
      if (soil.isError) void soil.refetch();
      if (vegetation.isError) void vegetation.refetch();
    },
  };
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
