import { centroid, decodePolyline, encodePolyline, round, type LngLat } from "./geo";

/** The field as stored in the URL so any view can be shared. */
export interface FieldState {
  lat: number;
  lon: number;
  ring: LngLat[] | null;
  irrigated: boolean;
}

export function parseField(params: URLSearchParams): FieldState | null {
  const ring = params.get("f") ? decodePolyline(params.get("f")!) : null;
  const validRing = ring && ring.length >= 3 ? ring : null;
  let lat = Number(params.get("lat")), lon = Number(params.get("lon"));
  if (validRing && (!params.has("lat") || !params.has("lon"))) [lon, lat] = centroid(validRing);
  if (!params.has("lat") && !validRing) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon, ring: validRing, irrigated: params.get("irr") === "1" };
}

export function writeField(params: URLSearchParams, field: FieldState | null): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const k of ["lat", "lon", "f", "irr"]) next.delete(k);
  if (!field) return next;
  next.set("lat", String(round(field.lat, 5)));
  next.set("lon", String(round(field.lon, 5)));
  if (field.ring) next.set("f", encodePolyline(field.ring));
  if (field.irrigated) next.set("irr", "1");
  return next;
}
