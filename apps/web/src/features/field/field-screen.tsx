"use client";

import type { Map as MLMap } from "maplibre-gl";
import { ArrowRight, Check, Crosshair, MapPinned, Trash2, Undo2, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import { DEMO_FIELD } from "@/lib/api/mock";
import { bbox, centroid, polygonAreaM2, type LngLat } from "@/lib/geo";
import { FieldMap, type Basemap, type MapMode } from "./field-map";
import { FieldSummary, FieldSummaryError, FieldSummarySkeleton } from "./field-summary";
import { PlaceSearch } from "./place-search";
import { useField, useFieldAnalysis } from "./use-field";

const demoRing = DEMO_FIELD.geometry.coordinates[0].slice(0, -1) as LngLat[];

export function FieldScreen() {
  const { t, n } = useI18n();
  const { field, setField } = useField();
  const analysis = useFieldAnalysis(field);
  const params = useSearchParams();
  const qs = params.toString();
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<MapMode>("draw");
  // In the URL (b=sat) so it survives re-renders of the route and can be shared.
  const basemap: Basemap = params.get("b") === "sat" ? "satellite" : "map";
  const setBasemap = useCallback(
    (next: Basemap) => {
      const p = new URLSearchParams(window.location.search);
      if (next === "satellite") p.set("b", "sat");
      else p.delete("b");
      const s = p.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [router, pathname],
  );
  const [draft, setDraft] = useState<LngLat[]>([]);
  const [flyTo, setFlyTo] = useState<{ center: LngLat; zoom?: number; bounds?: [LngLat, LngLat]; key: number } | null>(null);
  const [coarse, setCoarse] = useState(false);
  const mapRef = useRef<MLMap | null>(null);
  const didInitialFly = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read pointer type after mount
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  // When opening a shared URL, centre the map on the field once (not when the user marks a new field).
  useEffect(() => {
    if (didInitialFly.current) return;
    didInitialFly.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time camera move for shared links
    if (field) setFlyTo({ center: [field.lon, field.lat], zoom: 15, bounds: field.ring ? bbox(field.ring) : undefined, key: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  const commitRing = useCallback(
    (ring: LngLat[]) => {
      const [lon, lat] = centroid(ring);
      setField({ lat, lon, ring, irrigated: field?.irrigated ?? false });
      setDraft([]);
    },
    [field?.irrigated, setField],
  );

  const onMapClick = useCallback(
    (p: LngLat, closes: boolean) => {
      if (mode === "point") {
        setField({ lat: p[1], lon: p[0], ring: null, irrigated: field?.irrigated ?? false });
        return;
      }
      if (closes) commitRing(draft);
      else setDraft((d) => [...d, p]);
    },
    [mode, draft, commitRing, setField, field?.irrigated],
  );

  // Keyboard shortcuts while drawing.
  useEffect(() => {
    if (mode !== "draw" || draft.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") setDraft([]);
      else if (e.key === "Backspace") setDraft((d) => d.slice(0, -1));
      else if (e.key === "Enter" && draft.length >= 3) commitRing(draft);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, draft, commitRing]);

  const useCenter = () => {
    const c = mapRef.current?.getCenter();
    if (c) setField({ lat: c.lat, lon: c.lng, ring: null, irrigated: field?.irrigated ?? false });
  };

  const useDemo = () => {
    setDraft([]);
    setField({ lat: DEMO_FIELD.lat, lon: DEMO_FIELD.lon, ring: demoRing, irrigated: DEMO_FIELD.irrigated });
    setFlyTo({ center: [DEMO_FIELD.lon, DEMO_FIELD.lat], bounds: bbox(demoRing), key: Date.now() });
  };

  const areaM2 = field?.ring ? polygonAreaM2(field.ring) : null;
  const areaText = areaM2 === null ? null : areaM2 >= 10_000 ? `${n(areaM2 / 10_000, 2)} ${t("unit.ha")}` : `${n(areaM2)} ${t("unit.m2")}`;

  return (
    <div className="flex flex-1 flex-col lg:relative lg:h-[calc(100svh-57px)] lg:flex-none lg:overflow-hidden">
      {/* Map */}
      <div className="relative h-[52svh] min-h-[320px] md:h-[56svh] lg:absolute lg:inset-0 lg:h-auto">
        <FieldMap
          basemap={basemap}
          mode={mode}
          point={field ? [field.lon, field.lat] : null}
          ring={field?.ring ?? null}
          draft={draft}
          flyTo={flyTo}
          label={t("field.map.label")}
          onMapClick={onMapClick}
          onReady={(m) => (mapRef.current = m)}
        />
        <div className="absolute right-3 top-3 w-44 rounded-md bg-surface/95 p-1 shadow-2 lg:right-4 lg:top-4">
          <Segmented
            label={t("field.basemap.label")}
            hideLabel
            value={basemap}
            onChange={setBasemap}
            options={[
              { value: "map", label: t("field.basemap.map") },
              { value: "satellite", label: t("field.basemap.satellite") },
            ]}
          />
        </div>
        {mode === "draw" && draft.length > 0 && (
          <div className="absolute inset-x-3 bottom-10 mx-auto flex max-w-md flex-wrap items-center gap-2 rounded-lg bg-surface p-2 pl-3 shadow-3 lg:bottom-8 lg:left-[456px] lg:right-auto lg:mx-0">
            <span className="mr-auto text-sm tabular-nums text-ink-2" aria-live="polite">
              {t("field.draw.points", { count: draft.length })}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setDraft((d) => d.slice(0, -1))}>
              <Undo2 aria-hidden className="size-4" strokeWidth={1.5} />
              <span className="sr-only sm:not-sr-only">{t("field.draw.undo")}</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft([])}>
              <X aria-hidden className="size-4" strokeWidth={1.5} />
              <span className="sr-only sm:not-sr-only">{t("field.draw.cancel")}</span>
            </Button>
            <Button size="sm" variant="primary" disabled={draft.length < 3} onClick={() => commitRing(draft)}>
              <Check aria-hidden className="size-4" strokeWidth={1.5} />
              {t("field.draw.finish")}
            </Button>
          </div>
        )}
      </div>

      {/* Panel */}
      <aside
        id="main"
        tabIndex={-1}
        aria-labelledby="field-title"
        className="relative z-10 bg-surface px-4 pb-10 pt-5 md:px-6 lg:absolute lg:bottom-4 lg:left-4 lg:top-4 lg:w-[424px] lg:overflow-y-auto lg:[scrollbar-width:thin] lg:rounded-lg lg:border lg:border-border lg:px-5 lg:pb-6 lg:shadow-3"
      >
        <div className="mx-auto max-w-2xl space-y-5 lg:max-w-none">
          <div>
            <h1 id="field-title" className="text-h2 font-semibold tracking-[-0.01em]">
              {t("field.title")}
            </h1>
            <p className="mt-1 text-sm text-ink-2">{t("field.intro")}</p>
          </div>

          <PlaceSearch onSelect={(center) => setFlyTo({ center, zoom: 14, key: Date.now() })} />

          <div className="space-y-2">
            <Segmented
              label={t("field.mode.label")}
              value={mode}
              onChange={(m) => {
                setMode(m);
                setDraft([]);
              }}
              options={[
                { value: "draw", label: t("field.mode.draw") },
                { value: "point", label: t("field.mode.point") },
              ]}
            />
            <p className="text-xs text-ink-muted">{mode === "draw" ? t(coarse ? "field.draw.hint.touch" : "field.draw.hint") : t("field.point.hint")}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" onClick={useCenter}>
                <Crosshair aria-hidden className="size-4" strokeWidth={1.5} />
                {t("field.useCenter")}
              </Button>
              <Button size="sm" onClick={useDemo} data-cosmo-tour="demo-field">
                <MapPinned aria-hidden className="size-4" strokeWidth={1.5} />
                {t("field.demo")}
              </Button>
            </div>
          </div>

          {field && (
            <div className="space-y-4 rounded-md bg-sunken p-4">
              <dl className="grid grid-cols-2 gap-4">
                <div className="min-w-0">
                  <dt className="text-xs text-ink-muted">{t("field.location")}</dt>
                  <dd className="mt-0.5 text-sm font-medium tabular-nums text-ink">
                    {n(Math.abs(field.lat), 4)}° {field.lat >= 0 ? "N" : "S"}, {n(Math.abs(field.lon), 4)}° {field.lon >= 0 ? "E" : "W"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-ink-muted">{t("field.area")}</dt>
                  <dd className="mt-0.5 text-sm font-medium tabular-nums text-ink" data-testid="field-area">
                    {areaText ?? <span className="text-xs font-normal text-ink-muted">{t("field.area.point")}</span>}
                  </dd>
                </div>
              </dl>
              <Switch label={t("field.irrigated")} description={t("field.irrigated.desc")} checked={field.irrigated} onChange={(v) => setField({ ...field, irrigated: v })} />
              <Button size="sm" variant="ghost" className="-ml-3" onClick={() => { setField(null); setDraft([]); }}>
                <Trash2 aria-hidden className="size-4" strokeWidth={1.5} />
                {t("field.clear")}
              </Button>
            </div>
          )}

          {!field && (
            <div className="border-t border-border pt-5">
              <EmptyState title={t("empty.title")} body={t("empty.body")} />
            </div>
          )}

          {field && (
            <div>
              <h2 className="mb-4 text-h3 font-semibold">{t("summary.title")}</h2>
              {analysis.isPending ? (
                <FieldSummarySkeleton />
              ) : analysis.isError ? (
                <FieldSummaryError message={analysis.error.message} onRetry={() => analysis.refetch()} />
              ) : (
                <>
                  <FieldSummary data={analysis.data} field={field} />
                  <Link
                    href={`/app/explore?${qs}`}
                    className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-600"
                  >
                    {t("explore.cta")}
                    <ArrowRight aria-hidden className="size-4" strokeWidth={1.5} />
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
