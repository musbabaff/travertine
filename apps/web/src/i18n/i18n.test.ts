import { describe, expect, it } from "vitest";
import en from "./en.json";
import tr from "./tr.json";
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
  it("interpolates variables", () => {
    expect(format("en", "field.draw.points", { count: 4 })).toBe("4 corners");
  });
});
