import { describe, expect, it, vi } from "vitest";
import { nativeMaxZoom, S2_NATIVE_ZOOM, tileAt } from "./imagery";

const tilemap = (deepest: number) =>
  vi.fn(async (url: string | URL | Request) => {
    const z = Number(String(url).match(/tilemap\/(\d+)\//)![1]);
    return new Response(JSON.stringify({ data: [z <= deepest ? 1 : 0], valid: true }));
  }) as unknown as typeof fetch;

describe("imagery zoom cap", () => {
  it("finds the tile containing the demo field (checked against Esri's tilemap)", () => {
    expect(tileAt(28.98, 37.89, 18)).toEqual({ x: 152174, y: 101218 });
  });
  it("returns the deepest level with real tiles", async () => {
    expect(await nativeMaxZoom(28.98, 37.89, undefined, tilemap(18), "k")).toBe(18);
    expect(await nativeMaxZoom(28.98, 37.89, undefined, tilemap(15), "k")).toBe(15);
  });
  it("uses the Sentinel-2 native zoom without a key and a safe level when the lookup fails", async () => {
    expect(await nativeMaxZoom(0, 0, undefined, tilemap(18), null)).toBe(S2_NATIVE_ZOOM);
    const failing = vi.fn(async () => new Response("", { status: 500 })) as unknown as typeof fetch;
    expect(await nativeMaxZoom(0, 0, undefined, failing, "k")).toBe(16);
  });
});
