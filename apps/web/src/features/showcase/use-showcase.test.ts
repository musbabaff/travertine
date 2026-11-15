import { describe, expect, it } from "vitest";
import showcase from "@travertine/contract/fixtures/showcase.json";
import type { ShowcaseField } from "@/lib/api/types";
import { pickable } from "./use-showcase";

describe("showcase picker", () => {
  it("offers only computed sites that lie on a field", () => {
    const ids = pickable(showcase.fields as ShowcaseField[]).map((f) => f.id);
    expect(ids).not.toContain("us-kansas");
    expect(ids).not.toContain("ma-settat");
    expect(ids).toContain("tr-saraykoy");
    for (const f of showcase.fields) if (f.validation.status !== "ok") expect(ids).not.toContain(f.id);
  });
});
