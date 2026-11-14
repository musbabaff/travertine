import { describe, expect, it } from "vitest";
import { engineUrl, isMockMode } from "./engine";

describe("engineUrl", () => {
  it("falls back to the mock layer when unset or blank", () => {
    expect(engineUrl({})).toBeNull();
    expect(engineUrl({ NEXT_PUBLIC_ENGINE_URL: "  " })).toBeNull();
    expect(isMockMode({})).toBe(true);
  });
  it("strips trailing slashes", () => {
    expect(engineUrl({ NEXT_PUBLIC_ENGINE_URL: "https://engine.example.org/" })).toBe("https://engine.example.org");
    expect(isMockMode({ NEXT_PUBLIC_ENGINE_URL: "http://localhost:8000" })).toBe(false);
  });
});
