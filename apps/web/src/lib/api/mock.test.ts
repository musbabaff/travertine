import { describe, expect, it } from "vitest";
import fixture from "@travertine/contract/fixtures/rotations-explore.json";
import { FIXTURE_HORIZON, mockResponse } from "./mock";

const explore = async (body: object) => (await mockResponse("POST", "http://x/v1/rotations/explore", JSON.stringify(body))!).json();

describe("mock rotations", () => {
  it("re-ranks by priorities without changing objective scores", async () => {
    const water = await explore({ horizon_years: FIXTURE_HORIZON, priorities: { water: 1, income: 0, soil: 0, risk: 0 } });
    const income = await explore({ horizon_years: FIXTURE_HORIZON, priorities: { water: 0, income: 1, soil: 0, risk: 0 } });
    expect(water.rotations[0].scores.total).toBe(Math.max(...fixture.rotations.map((r) => r.scores.water)));
    expect(income.rotations[0].scores.total).toBe(Math.max(...fixture.rotations.map((r) => r.scores.income)));
    const original = Object.fromEntries(fixture.rotations.map((r) => [r.sequence.join(), r.scores.water]));
    for (const r of water.rotations) expect(r.scores.water).toBe(original[r.sequence.join()]);
  });
  it("refuses horizons the fixtures do not contain", async () => {
    const res = mockResponse("POST", "http://x/v1/rotations/explore", JSON.stringify({ horizon_years: 5 }))!;
    expect(res.status).toBe(422);
  });
});
