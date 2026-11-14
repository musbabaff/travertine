import turfArea from "@turf/area";
import type { PolygonGeometry } from "./api/types";

export type LngLat = [number, number];

/** Area of a polygon in square metres (geodesic). */
export function polygonAreaM2(ring: LngLat[]): number {
  if (ring.length < 3) return 0;
  return turfArea({ type: "Polygon", coordinates: [closeRing(ring)] });
}

export function closeRing(ring: LngLat[]): LngLat[] {
  if (ring.length === 0) return ring;
  const [f, l] = [ring[0], ring[ring.length - 1]];
  return f[0] === l[0] && f[1] === l[1] ? ring : [...ring, f];
}

/** Ensures counter-clockwise outer ring as required by RFC 7946. */
export function toGeometry(ring: LngLat[]): PolygonGeometry {
  const closed = closeRing(ring);
  let sum = 0;
  for (let i = 0; i < closed.length - 1; i++) sum += (closed[i + 1][0] - closed[i][0]) * (closed[i + 1][1] + closed[i][1]);
  const ccw = sum < 0 ? closed : [...closed].reverse();
  return { type: "Polygon", coordinates: [ccw.map(([x, y]) => [round(x, 6), round(y, 6)])] };
}

/** Area-weighted centroid of a simple polygon; falls back to the vertex mean for degenerate shapes. */
export function centroid(ring: LngLat[]): LngLat {
  const c = closeRing(ring);
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < c.length - 1; i++) {
    const f = c[i][0] * c[i + 1][1] - c[i + 1][0] * c[i][1];
    a += f;
    cx += (c[i][0] + c[i + 1][0]) * f;
    cy += (c[i][1] + c[i + 1][1]) * f;
  }
  if (Math.abs(a) < 1e-12) {
    const n = ring.length || 1;
    return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/** [[west, south], [east, north]] of a ring. */
export function bbox(ring: LngLat[]): [LngLat, LngLat] {
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  return [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]];
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

/** Parses "37.89, 28.98" or "37.89 28.98" as lat, lon. */
export function parseCoordinates(text: string): { lat: number; lon: number } | null {
  const m = text.trim().match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1].replace(",", ".")), lon = Number(m[2].replace(",", "."));
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

// ---- Google encoded polyline (precision 5), used to keep the field boundary in the URL ----
export function encodePolyline(ring: LngLat[]): string {
  let out = "", pLat = 0, pLon = 0;
  const enc = (v: number) => {
    let s = v < 0 ? ~(v << 1) : v << 1, r = "";
    while (s >= 0x20) { r += String.fromCharCode((0x20 | (s & 0x1f)) + 63); s >>= 5; }
    return r + String.fromCharCode(s + 63);
  };
  for (const [lon, lat] of ring) {
    const la = Math.round(lat * 1e5), lo = Math.round(lon * 1e5);
    out += enc(la - pLat) + enc(lo - pLon);
    pLat = la; pLon = lo;
  }
  return out;
}

export function decodePolyline(str: string): LngLat[] | null {
  const pts: LngLat[] = [];
  let i = 0, lat = 0, lon = 0;
  const next = () => {
    let shift = 0, result = 0, b: number;
    do {
      if (i >= str.length) throw new Error("truncated");
      b = str.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  try {
    while (i < str.length) {
      lat += next(); lon += next();
      pts.push([lon / 1e5, lat / 1e5]);
    }
  } catch {
    return null;
  }
  return pts.every(([x, y]) => Math.abs(x) <= 180 && Math.abs(y) <= 90) ? pts : null;
}
