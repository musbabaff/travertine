import type { StyleSpecification } from "maplibre-gl";

/**
 * Satellite imagery sources.
 *
 * Primary: Esri World Imagery through an ArcGIS Location Platform API key (NEXT_PUBLIC_ARCGIS_API_KEY). Sub-metre to
 * about 1 m in most farmland, commercial use allowed under the Location Platform terms, 2 M free tiles a month.
 * Required attribution: "Powered by Esri" plus the data credits.
 *
 * Keyless fallback: EOX Sentinel-2 cloudless 2016, the only s2cloudless layer under CC BY 4.0 (later years are
 * CC BY-NC-SA). It is 10 m imagery, so the map is capped at its native zoom instead of stretching it.
 *
 * Tiles are never shown beyond their native zoom: the map's maxZoom follows `nativeMaxZoom()` for Esri and a fixed cap
 * for the fallback.
 */
export const ARCGIS_KEY = process.env.NEXT_PUBLIC_ARCGIS_API_KEY || null;

const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const ESRI_HOST = "https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer";

/** Deepest zoom level Esri World Imagery publishes anywhere we request. */
export const ESRI_DEEPEST = 19;
/** 10 m Sentinel-2 pixels are about one screen pixel at zoom 14 (9.5 m at the equator, finer towards the poles). */
export const S2_NATIVE_ZOOM = 14;
export const VECTOR_MAX_ZOOM = 19;

export type SatelliteProvider = "esri" | "s2";
export const satelliteProvider: SatelliteProvider = ARCGIS_KEY ? "esri" : "s2";

export const ESRI_ATTRIBUTION =
  'Powered by <a href="https://www.esri.com" target="_blank" rel="noreferrer">Esri</a> | Esri, Maxar, Earthstar Geographics, and the GIS User Community';
/** Official wording for the CC BY 4.0 2016 layer (WMTS capabilities of tiles.maps.eox.at). */
export const S2_ATTRIBUTION =
  '<a href="https://cloudless.eox.at" target="_blank" rel="noreferrer">EOxCloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016), <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>';

export function satelliteStyle(): StyleSpecification {
  const source = ARCGIS_KEY
    ? { type: "raster" as const, tiles: [`${ESRI_HOST}/tile/{z}/{y}/{x}?token=${ARCGIS_KEY}`], tileSize: 256, maxzoom: ESRI_DEEPEST, attribution: ESRI_ATTRIBUTION }
    : {
        type: "raster" as const,
        tiles: ["https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg"],
        tileSize: 256,
        maxzoom: S2_NATIVE_ZOOM,
        attribution: S2_ATTRIBUTION,
      };
  return { version: 8, glyphs: GLYPHS, sources: { imagery: source }, layers: [{ id: "imagery", type: "raster", source: "imagery" }] };
}

/** Slippy-map tile column and row containing a point. */
export function tileAt(lng: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const rad = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180;
  return { x: Math.floor(((lng + 180) / 360) * n), y: Math.floor(((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2) * n) };
}

/**
 * Deepest zoom at which Esri World Imagery has real (not resampled) tiles at this point, from the service's tilemap.
 * Falls back to a conservative level when the lookup fails.
 */
export async function nativeMaxZoom(lng: number, lat: number, signal?: AbortSignal, fetcher: typeof fetch = fetch, key: string | null = ARCGIS_KEY): Promise<number> {
  const FLOOR = 13;
  const SAFE = 16;
  if (!key) return S2_NATIVE_ZOOM;
  try {
    for (let z = ESRI_DEEPEST; z > FLOOR; z--) {
      const { x, y } = tileAt(lng, lat, z);
      const res = await fetcher(`${ESRI_HOST}/tilemap/${z}/${y}/${x}/1/1?f=json&token=${key}`, { signal });
      if (!res.ok) return SAFE;
      const body = (await res.json()) as { data?: number[] };
      if (!body.data) return SAFE;
      if (body.data[0] === 1) return z;
    }
    return FLOOR;
  } catch {
    return SAFE;
  }
}
