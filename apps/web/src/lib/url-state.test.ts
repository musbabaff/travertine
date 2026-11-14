import { describe, expect, it } from "vitest";
import { parseField, writeField } from "./url-state";

describe("field URL state", () => {
  it("round-trips a polygon field", () => {
    const field = { lat: 37.88995, lon: 28.98015, ring: [[28.9781, 37.8885], [28.9822, 37.8885], [28.9822, 37.8914]] as [number, number][], irrigated: true };
    const parsed = parseField(writeField(new URLSearchParams("tab=x"), field))!;
    expect(parsed.lat).toBeCloseTo(field.lat, 5);
    expect(parsed.ring).toHaveLength(3);
    expect(parsed.irrigated).toBe(true);
  });
  it("keeps unrelated params and clears the field", () => {
    const p = writeField(new URLSearchParams("lat=1&lon=2&w=0.5"), null);
    expect(p.toString()).toBe("w=0.5");
    expect(parseField(p)).toBeNull();
  });
  it("rejects out-of-range coordinates", () => {
    expect(parseField(new URLSearchParams("lat=120&lon=2"))).toBeNull();
    expect(parseField(new URLSearchParams("lat=abc&lon=2"))).toBeNull();
  });
});
