import { describe, expect, it } from "vitest";
import { centroid, decodePolyline, distanceKm, encodePolyline, parseCoordinates, polygonAreaM2, toGeometry, type LngLat } from "./geo";
import demo from "@travertine/contract/fixtures/field-analyze.request.json";

const ring = demo.geometry.coordinates[0].slice(0, -1) as LngLat[];

describe("geo", () => {
  it("measures the demo field area (about 11.6 ha)", () => {
    const ha = polygonAreaM2(ring) / 10_000;
    expect(ha).toBeGreaterThan(11);
    expect(ha).toBeLessThan(12);
  });
  it("round-trips polygons through the URL encoding", () => {
    const back = decodePolyline(encodePolyline(ring))!;
    back.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(ring[i][0], 5);
      expect(p[1]).toBeCloseTo(ring[i][1], 5);
    });
  });
  it("rejects malformed polylines", () => expect(decodePolyline("_")).toBeNull());
  it("emits a closed, counter-clockwise ring", () => {
    const shoelace = (c: number[][]) => c.slice(0, -1).reduce((a, p, i) => a + p[0] * c[i + 1][1] - c[i + 1][0] * p[1], 0);
    for (const input of [ring, [...ring].reverse()]) {
      const c = toGeometry(input).coordinates[0];
      expect(c[0]).toEqual(c[c.length - 1]);
      expect(shoelace(c)).toBeGreaterThan(0);
    }
  });
  it("finds the centroid", () => {
    const [x, y] = centroid(ring);
    expect(x).toBeCloseTo(28.98015, 4);
    expect(y).toBeCloseTo(37.88995, 4);
  });
  it("parses coordinates in common formats", () => {
    expect(parseCoordinates("37.89, 28.98")).toEqual({ lat: 37.89, lon: 28.98 });
    expect(parseCoordinates("-12.5 130.8")).toEqual({ lat: -12.5, lon: 130.8 });
    expect(parseCoordinates("Denizli")).toBeNull();
    expect(parseCoordinates("95, 10")).toBeNull();
  });
  it("computes distances", () => {
    expect(distanceKm({ lat: 37.89, lon: 28.98 }, { lat: 37.89, lon: 28.98 })).toBe(0);
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(111.19, 1);
  });
});
