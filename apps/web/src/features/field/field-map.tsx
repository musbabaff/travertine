"use client";

import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MLMap, MapMouseEvent } from "maplibre-gl";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useI18n } from "@/i18n";
import { closeRing, type LngLat } from "@/lib/geo";
import { nativeMaxZoom, S2_NATIVE_ZOOM, satelliteProvider, satelliteStyle, VECTOR_MAX_ZOOM } from "@/lib/imagery";

export type Basemap = "map" | "satellite";
export type MapMode = "point" | "draw";

export const DENIZLI_VIEW = { center: [28.98, 37.89] as LngLat, zoom: 13 };

const VECTOR_STYLE = "https://tiles.openfreemap.org/styles/positron";
maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

// MapLibre paint cannot read CSS variables, so the resolved token values are read once on the client.
const token = (name: string, fallback: string) =>
  (typeof window !== "undefined" && getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || fallback;
const TEAL_700 = token("--color-teal-700", "#1f666b");
const TEAL_500 = token("--color-teal-500", "#2e989e");
const SURFACE = token("--color-surface", "#faf7f2");

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Props {
  basemap: Basemap;
  mode: MapMode;
  /** Committed field. */
  point: LngLat | null;
  ring: LngLat[] | null;
  /** In-progress drawing vertices. */
  draft: LngLat[];
  flyTo: { center: LngLat; zoom?: number; bounds?: [LngLat, LngLat]; key: number } | null;
  label: string;
  onMapClick: (p: LngLat, closesDraft: boolean) => void;
  onReady: (map: MLMap) => void;
}

function emptyFC(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function addOverlay(map: MLMap) {
  if (map.getSource("field")) return;
  map.addSource("field", { type: "geojson", data: emptyFC() });
  map.addSource("draft", { type: "geojson", data: emptyFC() });
  map.addLayer({ id: "field-fill", type: "fill", source: "field", filter: ["==", "$type", "Polygon"], paint: { "fill-color": TEAL_500, "fill-opacity": 0.22 } });
  map.addLayer({ id: "field-halo", type: "line", source: "field", filter: ["==", "$type", "Polygon"], paint: { "line-color": SURFACE, "line-width": 5 } });
  map.addLayer({ id: "field-line", type: "line", source: "field", filter: ["==", "$type", "Polygon"], paint: { "line-color": TEAL_700, "line-width": 2.5 } });
  map.addLayer({ id: "field-point", type: "circle", source: "field", filter: ["==", "$type", "Point"], paint: { "circle-radius": 8, "circle-color": TEAL_700, "circle-stroke-color": SURFACE, "circle-stroke-width": 3 } });
  map.addLayer({ id: "draft-line", type: "line", source: "draft", filter: ["==", "$type", "LineString"], paint: { "line-color": TEAL_700, "line-width": 2, "line-dasharray": [2, 1.5] } });
  map.addLayer({ id: "draft-vertex", type: "circle", source: "draft", filter: ["==", "$type", "Point"], paint: { "circle-radius": ["case", ["get", "first"], 7, 5], "circle-color": SURFACE, "circle-stroke-color": TEAL_700, "circle-stroke-width": 2.5 } });
}

export function FieldMap({ basemap, mode, point, ring, draft, flyTo, label, onMapClick, onReady }: Props) {
  const { t } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  /** Current zoom cap; re-applied after every style load so an async style swap cannot undo it. */
  const capRef = useRef(VECTOR_MAX_ZOOM);
  const applyCap = (z: number) => {
    capRef.current = z;
    mapRef.current?.setMaxZoom(z);
  };
  const state = useRef({ point, ring, draft, mode, onMapClick });
  useLayoutEffect(() => {
    state.current = { point, ring, draft, mode, onMapClick };
    // Static caps follow the basemap prop directly, so they hold even if the map was not ready when it changed.
    if (basemap !== "satellite") capRef.current = VECTOR_MAX_ZOOM;
    else if (satelliteProvider === "s2") capRef.current = S2_NATIVE_ZOOM;
  });

  const sync = () => {
    const map = mapRef.current;
    if (!map?.getSource("field")) return;
    const { point: p, ring: r, draft: d } = state.current;
    const fieldFC: GeoJSON.FeatureCollection = emptyFC();
    if (r && r.length >= 3) fieldFC.features.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [closeRing(r)] } });
    else if (p) fieldFC.features.push({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: p } });
    (map.getSource("field") as GeoJSONSource).setData(fieldFC);
    const draftFC: GeoJSON.FeatureCollection = emptyFC();
    if (d.length > 1) draftFC.features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: d.length >= 3 ? [...d, d[0]] : d } });
    d.forEach((c, i) => draftFC.features.push({ type: "Feature", properties: { first: i === 0 && d.length >= 3 }, geometry: { type: "Point", coordinates: c } }));
    (map.getSource("draft") as GeoJSONSource).setData(draftFC);
  };

  // Create the map once.
  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: basemap === "satellite" ? satelliteStyle() : VECTOR_STYLE,
      center: DENIZLI_VIEW.center,
      zoom: DENIZLI_VIEW.zoom,
      attributionControl: { compact: true },
      doubleClickZoom: false,
      dragRotate: false,
      pitchWithRotate: false,
      maxPitch: 0,
      maxZoom: capRef.current,
    });
    mapRef.current = map;
    // Exposed for end-to-end tests (zoom-cap assertions); read-only use.
    (container.current as HTMLDivElement & { __map?: MLMap }).__map = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    // Keep the field clear of the floating panel on wide screens.
    const pad = () => map.setPadding({ top: 0, right: 0, bottom: 0, left: window.innerWidth >= 1024 ? 440 : 0 });
    pad();
    window.addEventListener("resize", pad);
    map.on("style.load", () => {
      map.setMaxZoom(capRef.current);
      addOverlay(map);
      sync();
    });
    map.on("click", (e: MapMouseEvent) => {
      const { draft: d, mode: m } = state.current;
      let closes = false;
      if (m === "draw" && d.length >= 3) {
        const first = map.project(d[0] as [number, number]);
        closes = Math.hypot(first.x - e.point.x, first.y - e.point.y) < 14;
      }
      state.current.onMapClick([e.lngLat.lng, e.lngLat.lat], closes);
    });
    const canvas = map.getCanvas();
    canvas.setAttribute("aria-label", label);
    canvas.setAttribute("role", "application");
    onReady(map);
    return () => {
      window.removeEventListener("resize", pad);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- created once
  }, []);

  useEffect(() => {
    mapRef.current?.getCanvas().setAttribute("aria-label", label);
  }, [label]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(basemap === "satellite" ? satelliteStyle() : VECTOR_STYLE, { diff: false });
    if (basemap !== "satellite") {
      applyCap(VECTOR_MAX_ZOOM);
      return;
    }
    if (satelliteProvider === "s2") {
      applyCap(S2_NATIVE_ZOOM);
      return;
    }
    // Esri: never show imagery beyond its native zoom at the place being viewed.
    let ctrl: AbortController | null = null;
    const cap = () => {
      ctrl?.abort();
      ctrl = new AbortController();
      const { lng, lat } = map.getCenter();
      const signal = ctrl.signal;
      void nativeMaxZoom(lng, lat, signal).then((z) => {
        if (!signal.aborted) applyCap(z);
      });
    };
    cap();
    map.on("moveend", cap);
    return () => {
      ctrl?.abort();
      map.off("moveend", cap);
    };
  }, [basemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = mode === "draw" ? "crosshair" : "pointer";
  }, [mode]);

  useEffect(sync, [point, ring, draft]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    if (flyTo.bounds) {
      const pad = Math.round(Math.min(map.getContainer().clientWidth, map.getContainer().clientHeight) * 0.25);
      map.fitBounds(flyTo.bounds, { padding: pad, maxZoom: Math.min(16.5, map.getMaxZoom()), animate: !reducedMotion(), duration: 900 });
      return;
    }
    const opts = { center: flyTo.center as [number, number], zoom: Math.min(flyTo.zoom ?? Math.max(map.getZoom(), 14), map.getMaxZoom()) };
    if (reducedMotion()) map.jumpTo(opts);
    else map.flyTo({ ...opts, duration: 900 });
  }, [flyTo]);

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" data-testid="field-map" />
      {basemap === "satellite" && (
        <p data-testid="imagery-credit" className="pointer-events-none absolute left-2 top-2 max-w-[calc(100%-13rem)] rounded-sm bg-surface/90 px-1.5 py-0.5 text-xs text-ink-2 lg:left-[456px] lg:top-3">
          {satelliteProvider === "esri" ? t("field.imagery.esri") : t("field.imagery.s2")}
        </p>
      )}
    </div>
  );
}
