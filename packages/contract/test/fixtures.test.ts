import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = new URL("../", import.meta.url);
const spec = parse(readFileSync(new URL("openapi.yaml", root), "utf8"));
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`fixtures/${name}`, root), "utf8"));

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema({ $id: "spec", components: spec.components });
const validate = (ref: string, data: unknown) => {
  const v = ajv.compile({ $ref: `spec#/components/schemas/${ref}` });
  const ok = v(data);
  return ok ? [] : v.errors;
};

describe("contract fixtures validate against openapi.yaml", () => {
  it("health", () => expect(validate("Health", fixture("health.json"))).toEqual([]));
  it("crops", () => {
    const crops = fixture("crops.json");
    expect(Array.isArray(crops)).toBe(true);
    for (const c of crops) expect(validate("Crop", c)).toEqual([]);
  });
  it("field analyze request + response", () => {
    expect(validate("FieldAnalyzeRequest", fixture("field-analyze.request.json"))).toEqual([]);
    expect(validate("FieldAnalysis", fixture("field-analyze.json"))).toEqual([]);
  });
  it("rotations explore request + response", () => {
    expect(validate("RotationExploreRequest", fixture("rotations-explore.request.json"))).toEqual([]);
    expect(validate("RotationExploreResponse", fixture("rotations-explore.json"))).toEqual([]);
  });
  it("validation", () => expect(validate("Validation", fixture("validation.json"))).toEqual([]));
  it("field ndvi (30 m)", () => expect(validate("FieldNdvi", fixture("field-ndvi.json"))).toEqual([]));
});

describe("fixture consistency", () => {
  const crops = new Set(fixture("crops.json").map((c: { id: string }) => c.id));
  const explore = fixture("rotations-explore.json");
  const horizon = fixture("rotations-explore.request.json").horizon_years;

  it("rotations only reference known crops and match the horizon", () => {
    for (const r of explore.rotations) {
      expect(r.sequence).toHaveLength(horizon);
      expect(r.yearly).toHaveLength(horizon);
      r.sequence.forEach((id: string, i: number) => {
        expect(crops.has(id)).toBe(true);
        expect(r.yearly[i].crop_id).toBe(id);
      });
    }
  });

  it("rotations are sorted by total score", () => {
    const totals = explore.rotations.map((r: { scores: { total: number } }) => r.scores.total);
    expect([...totals].sort((a, b) => b - a)).toEqual(totals);
  });

  it("validation n matches the number of years", () => {
    const v = fixture("validation.json");
    expect(v.n).toBe(v.years.length);
  });

  it("every data response carries provenance", () => {
    for (const f of ["field-analyze.json", "rotations-explore.json", "validation.json"]) {
      expect(fixture(f).provenance.length).toBeGreaterThan(0);
    }
  });
});
