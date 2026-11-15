import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page, Route } from "@playwright/test";
import { encodePolyline, type LngLat } from "../src/lib/geo";

const fixture = (name: string) => readFileSync(join(__dirname, "../../../packages/contract/fixtures", name), "utf8");

const ROUTES: Record<string, string> = {
  "/v1/health": "health.json",
  "/v1/crops": "crops.json",
  "/v1/field/analyze": "field-analyze.json",
  "/v1/rotations/explore": "rotations-explore.json",
  "/v1/validation": "validation.json",
  "/v1/field/ndvi": "field-ndvi.json",
  "/v1/field/climate": "field-climate.json",
  "/v1/field/soil": "field-soil.json",
  "/v1/field/vegetation": "field-vegetation.json",
  "/v1/showcase": "showcase.json",
  "/v1/field/hazards": "field-hazards.json",
  "/v1/field/calendar": "field-calendar.json",
};

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

/** "partial": engine is live but does not serve /v1/validation or /v1/field/ndvi yet (404). */
export type EngineMode = "ok" | "slow" | "error" | "down" | "partial";

/** Fakes the engine at http://engine.test using contract fixtures. */
export async function fakeEngine(page: Page, mode: EngineMode = "ok") {
  await page.route("http://engine.test/**", async (route: Route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (mode === "down") return route.abort("connectionrefused");
    const path = new URL(req.url()).pathname;
    if (mode === "error") {
      return route.fulfill({ status: 422, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify({ code: "out_of_coverage", message: "No soil data for this location." }) });
    }
    if (mode === "slow") await new Promise(() => {}); // never resolves: loading state
    const file = mode === "partial" && (path === "/v1/validation" || path === "/v1/field/ndvi") ? undefined : ROUTES[path];
    if (!file) return route.fulfill({ status: 404, headers: cors, body: "{}" });
    return route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: fixture(file) });
  });
}

const demo = JSON.parse(fixture("field-analyze.request.json"));
const ring = demo.geometry.coordinates[0].slice(0, -1) as LngLat[];
export const DEMO_QUERY = `lat=37.88995&lon=28.98015&f=${encodeURIComponent(encodePolyline(ring))}`;
