import { describe, expect, it } from "vitest";
import rotations from "@travertine/contract/fixtures/rotations-explore.json";
import en from "@/i18n/en.json";
import tr from "@/i18n/tr.json";
import type { RotationExploreResponse } from "@/lib/api/types";
import { askField, fieldStarters, type FieldContext } from "./field-answers";

const ctx = (extra: Partial<FieldContext> = {}): FieldContext => ({
  cropName: (id) => id,
  n: (v, d = 0) => v.toFixed(d),
  ...extra,
});
const response = rotations as unknown as RotationExploreResponse;

describe("Cosmo field answers", () => {
  it("names the first-ranked rotation from the engine response", () => {
    const r = askField("Which rotation ranks first, and why?", ctx({ rotations: response }))!;
    expect(r.text).toBe("cosmo.f.top");
    expect(r.vars?.seq).toBe(response.rotations[0].sequence.join(" → "));
    expect(r.vars?.total).toBe(response.rotations[0].scores.total.toFixed(2));
    expect(r.lines).toEqual(response.rotations[0].explanation.slice(0, 2));
  });

  it("adds up the yearly water deficits of the first rotation", () => {
    const r = askField("Su açığı ne kadar?", ctx({ rotations: response }))!;
    const sum = response.rotations[0].yearly.reduce((s, y) => s + y.water_deficit_mm, 0);
    expect(r.text).toBe("cosmo.f.deficit");
    expect(r.vars?.deficit).toBe(sum.toFixed(0));
  });

  it("says so when the data an answer needs is not loaded", () => {
    expect(askField("Which rotation ranks first?", ctx())?.text).toBe("cosmo.f.needExplore");
    expect(askField("How does my current rotation compare?", ctx({ rotations: response }))?.text).toBe("cosmo.f.noCurrent");
    expect(askField("What climate hazards does this field face?", ctx())?.text).toBe("cosmo.f.needField");
  });

  it("lists the datasets behind the numbers", () => {
    const r = askField("Bu sayılar nereden geliyor?", ctx({ provenance: response.provenance }))!;
    expect(r.lines).toEqual([...new Set(response.provenance.map((p) => p.dataset))]);
  });

  it("leaves other questions to the general guide", () => {
    expect(askField("What is NDVI?", ctx({ rotations: response }))).toBeNull();
  });

  it("chips match the intents they stand for, in both languages", () => {
    for (const dict of [en, tr] as Record<string, string>[]) {
      for (const key of fieldStarters("/app/explore", true)) {
        const reply = askField(dict[key], ctx({ rotations: response }));
        expect(reply, `${key}: ${dict[key]}`).not.toBeNull();
      }
    }
    expect(fieldStarters("/app/explore", false)).toEqual([]);
  });

  it("every answer template exists in both languages", () => {
    const keys = Object.keys(en).filter((k) => k.startsWith("cosmo.f.") || k.startsWith("cosmo.q."));
    for (const k of keys) expect((tr as Record<string, string>)[k], k).toBeTruthy();
  });
});
