import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "@travertine/contract/fixtures/field-analyze.json";
import { createEngineFetch, isFixtureResponse } from "./client";
import type { DataSource } from "./source";

const req = (url: string, method = "POST") => new Request(url, { method, body: method === "POST" ? "{}" : undefined });

afterEach(() => vi.unstubAllGlobals());

describe("engine fetch with mock fallback", () => {
  it("serves fixtures when no engine is configured", async () => {
    const seen: DataSource[] = [];
    const res = await createEngineFetch(null, (s) => seen.push(s))(req("http://mock.local/v1/field/analyze"));
    expect(await res.json()).toEqual(fixture);
    expect(seen).toEqual(["fixtures"]);
  });

  it("falls back to fixtures when the engine is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const seen: DataSource[] = [];
    const res = await createEngineFetch("http://engine", (s) => seen.push(s))(req("http://engine/v1/field/analyze"));
    expect(res.status).toBe(200);
    expect(seen).toEqual(["fallback"]);
  });

  it("falls back on 503 but passes engine 4xx errors through", async () => {
    const seen: DataSource[] = [];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    await createEngineFetch("http://engine", (s) => seen.push(s))(req("http://engine/v1/field/analyze"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"code":"invalid_geometry","message":"bad"}', { status: 422 })));
    const res = await createEngineFetch("http://engine", (s) => seen.push(s))(req("http://engine/v1/field/analyze"));
    expect(res.status).toBe(422);
    expect(seen).toEqual(["fallback", "engine"]);
  });

  it("serves the fixture for a route the engine does not serve yet, without changing the badge", async () => {
    const seen: DataSource[] = [];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"detail":"Not Found"}', { status: 404 })));
    const res = await createEngineFetch("http://engine", (s) => seen.push(s))(req("http://engine/v1/validation?lat=1&lon=2", "GET"));
    expect(res.status).toBe(200);
    expect(isFixtureResponse(res)).toBe(true);
    expect(seen).toEqual([]);
  });

  it("errors for routes without a fixture", async () => {
    await expect(createEngineFetch(null, () => {})(req("http://mock.local/v1/unknown", "GET"))).rejects.toThrow(/No fixture/);
  });
});
