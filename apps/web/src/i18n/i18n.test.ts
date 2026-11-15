import { describe, expect, it } from "vitest";
import en from "./en.json";
import tr from "./tr.json";
import { SAME_IN_BOTH_KEYS } from "./allowlist";
import { format } from "./index";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("locale files", () => {
  it("have identical keys", () => {
    expect(Object.keys(tr).sort()).toEqual(Object.keys(en).sort());
  });
  it("use the same placeholders per key", () => {
    for (const [k, v] of Object.entries(en)) expect(placeholders((tr as Record<string, string>)[k]), k).toEqual(placeholders(v));
  });
  it("contain no empty strings or emoji", () => {
    for (const dict of [en, tr])
      for (const [k, v] of Object.entries(dict)) {
        expect(v.trim(), k).not.toBe("");
        expect(/\p{Emoji_Presentation}/u.test(v), k).toBe(false);
      }
  });
  it("translate every Turkish value unless it is a listed name, symbol or unit", () => {
    const same = Object.entries(tr).filter(([k, v]) => (en as Record<string, string>)[k] === v && !SAME_IN_BOTH_KEYS.has(k)).map(([k]) => k);
    expect(same).toEqual([]);
  });
  it("address the reader formally in Turkish interface text (Cosmo keeps its own voice)", () => {
    const informal = /(sen|senin|sana|seni)|(?:yorsun|ebilirsin|abilirsin)|[^\s]+(?:nın|nin|nun|nün)\s(?:için|yerine)/i;
    const hits = Object.entries(tr).filter(([k, v]) => !k.startsWith("cosmo.") && informal.test(v)).map(([k]) => k);
    expect(hits).toEqual([]);
  });
  it("interpolates variables", () => {
    expect(format("en", "field.draw.points", { count: 4 })).toBe("4 corners");
  });
});
