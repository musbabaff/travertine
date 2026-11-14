import { describe, expect, it } from "vitest";
import { DEFAULT_PRIORITIES, parseExplore, weightedTotal, writeExplore } from "./priorities";
import fixture from "@travertine/contract/fixtures/rotations-explore.json";
import request from "@travertine/contract/fixtures/rotations-explore.request.json";

describe("priorities URL state", () => {
  it("round-trips priorities and horizon, keeping other params", () => {
    const p = writeExplore(new URLSearchParams("lat=1&lon=2"), { water: 0.8, income: 0.25, soil: 0, risk: 1 }, 5);
    expect(p.get("lat")).toBe("1");
    expect(parseExplore(p)).toEqual({ priorities: { water: 0.8, income: 0.25, soil: 0, risk: 1 }, horizon: 5 });
  });
  it("clamps and falls back on invalid input", () => {
    expect(parseExplore(new URLSearchParams("p=2,-1,0.5,0.5&h=7"))).toEqual({ priorities: { water: 1, income: 0, soil: 0.5, risk: 0.5 }, horizon: 4 });
    expect(parseExplore(new URLSearchParams("p=a,b")).priorities).toEqual(DEFAULT_PRIORITIES);
  });
});

describe("weightedTotal", () => {
  it("reproduces the fixture totals for the fixture request", () => {
    for (const r of fixture.rotations) expect(weightedTotal(r.scores, request.priorities)).toBeCloseTo(r.scores.total, 2);
  });
  it("uses equal weights when all priorities are zero", () => {
    expect(weightedTotal({ water: 1, income: 0, soil: 1, risk: 0 }, { water: 0, income: 0, soil: 0, risk: 0 })).toBe(0.5);
  });
});
