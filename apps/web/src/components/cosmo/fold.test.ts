import { describe, expect, it } from "vitest";
import rotations from "@travertine/contract/fixtures/rotations-explore.json";
import en from "@/i18n/en.json";
import tr from "@/i18n/tr.json";
import type { RotationExploreResponse } from "@/lib/api/types";
import { fold } from "@/lib/fold";
import { askCosmo } from "./brain";
import { askField, type FieldContext } from "./field-answers";

const ctx: FieldContext = {
  rotations: rotations as unknown as RotationExploreResponse,
  provenance: (rotations as unknown as RotationExploreResponse).provenance,
  cropName: (id) => id,
  n: (v, d = 0) => v.toFixed(d),
};
const answer = (q: string, page = "/app/explore") => (askField(q, ctx) ?? askCosmo(q, page)).text;
const plain = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/ı/g, "i").replace(/İ/g, "I");

describe("fold", () => {
  it("keeps NDVI as ndvi and folds Turkish letters", () => {
    expect(fold("NDVI NEDİR?")).toBe("ndvi nedir");
    expect(fold("Şu  DENGESİ, nedir!")).toBe("su dengesi nedir");
    expect(fold("ışık çiğ ÖĞÜT")).toBe("isik cig ogut");
    expect(fold("ET₀")).toBe("et₀");
  });
});

describe("Cosmo answers do not depend on case or Turkish letters", () => {
  const chips = Object.keys(en).filter((k) => k.startsWith("cosmo.q."));
  for (const [lang, dict] of [["en", en], ["tr", tr]] as const) {
    for (const key of chips) {
      const chip = (dict as Record<string, string>)[key];
      it(`${lang} ${key}: "${chip}"`, () => {
        const expected = answer(chip);
        expect(answer(chip.toLocaleUpperCase("tr-TR"))).toBe(expected);
        expect(answer(chip.toUpperCase())).toBe(expected);
        expect(answer(chip.toLocaleLowerCase("tr-TR"))).toBe(expected);
        expect(answer(plain(chip))).toBe(expected);
      });
    }
  }

  it.each([
    ["NDVI NEDIR", "cosmo.gloss.ndvi"],
    ["NDVI nedir?", "cosmo.gloss.ndvi"],
    ["ndvi nedir", "cosmo.gloss.ndvi"],
    ["WHAT IS NDVI", "cosmo.gloss.ndvi"],
    ["EVAPOTRANSPIRASYON NEDIR", "cosmo.gloss.et"],
    ["what is et0", "cosmo.gloss.et"],
    ["SU DENGESİ NEDİR", "cosmo.gloss.waterBalance"],
    ["su dengesi nedir", "cosmo.gloss.waterBalance"],
    ["DON RISKI NEDIR", "cosmo.gloss.frost"],
  ])("%s", (q, key) => {
    expect(answer(q, "/app/evidence")).toBe(key);
  });
});
