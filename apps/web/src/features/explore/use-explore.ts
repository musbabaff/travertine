"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, unwrap } from "@/lib/api/client";
import type { Crop, FarmerInputs, Priorities, RotationExploreResponse } from "@/lib/api/types";
import { parseExplore, writeExplore, type Horizon } from "@/lib/priorities";
import type { FieldState } from "@/lib/url-state";

/** Priorities and horizon live in the URL (debounced) so a ranking can be shared. */
export function useExploreParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const fromUrl = useMemo(() => parseExplore(new URLSearchParams(params.toString())), [params]);
  const [priorities, setPrioritiesState] = useState<Priorities>(fromUrl.priorities);
  const [horizon, setHorizonState] = useState<Horizon>(fromUrl.horizon);
  const [debounced, setDebounced] = useState<Priorities>(fromUrl.priorities);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(priorities), 300);
    return () => clearTimeout(id);
  }, [priorities]);

  useEffect(() => {
    const qs = writeExplore(new URLSearchParams(window.location.search), debounced, horizon).toString();
    if (qs !== window.location.search.slice(1)) router.replace(`${pathname}?${qs}`, { scroll: false });
  }, [debounced, horizon, router, pathname]);

  const setPriority = useCallback((k: keyof Priorities, v: number) => setPrioritiesState((p) => ({ ...p, [k]: v })), []);
  const setAll = useCallback((p: Priorities) => setPrioritiesState(p), []);
  return { priorities, debounced, horizon, setPriority, setAll, setHorizon: setHorizonState };
}

export interface ExploreExtras {
  scenario?: { precipitation_factor: number; temperature_change_c: number };
  farmer?: FarmerInputs | null;
}

export function useRotations(
  field: FieldState | null,
  priorities: Priorities,
  horizon: Horizon,
  current: string[] = [],
  language: "en" | "tr" = "en",
  extras: ExploreExtras = {},
) {
  return useQuery<RotationExploreResponse>({
    queryKey: ["rotations", field?.lat, field?.lon, field?.irrigated, priorities, horizon, current.join(","), extras.scenario ?? null, extras.farmer ?? null, language],
    enabled: !!field,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.POST("/v1/rotations/explore", {
          body: {
            lat: field!.lat,
            lon: field!.lon,
            irrigated: field!.irrigated,
            horizon_years: horizon,
            priorities,
            language,
            ...(current.length ? { current_rotation: current } : {}),
            ...(extras.scenario ? { scenario: extras.scenario } : {}),
            ...(extras.farmer ? { farmer_inputs: extras.farmer } : {}),
          },
          signal,
        }),
      ),
  });
}

export function useCrops() {
  return useQuery<Crop[]>({
    queryKey: ["crops"],
    staleTime: Infinity,
    queryFn: async ({ signal }) => unwrap(await api.GET("/v1/crops", { signal })),
  });
}
