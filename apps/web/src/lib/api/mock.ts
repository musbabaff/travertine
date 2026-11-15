import crops from "@travertine/contract/fixtures/crops.json";
import fieldAnalyze from "@travertine/contract/fixtures/field-analyze.json";
import health from "@travertine/contract/fixtures/health.json";
import rotations from "@travertine/contract/fixtures/rotations-explore.json";
import validation from "@travertine/contract/fixtures/validation.json";
import fieldNdvi from "@travertine/contract/fixtures/field-ndvi.json";
import showcase from "@travertine/contract/fixtures/showcase.json";
import fieldClimate from "@travertine/contract/fixtures/field-climate.json";
import fieldSoil from "@travertine/contract/fixtures/field-soil.json";
import fieldRequest from "@travertine/contract/fixtures/field-analyze.request.json";
import exploreRequest from "@travertine/contract/fixtures/rotations-explore.request.json";
import { weightedTotal } from "../priorities";
import type { Priorities } from "./types";

/** Location the fixtures describe. Used to warn when demo data is shown for a different place. */
export const FIXTURE_LOCATION = { lat: fieldRequest.lat, lon: fieldRequest.lon } as const;
export const DEMO_FIELD = fieldRequest;
/** The only rotation horizon the fixtures contain. */
export const FIXTURE_HORIZON = exploreRequest.horizon_years;

export const SOURCE_HEADER = "x-travertine-source";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", [SOURCE_HEADER]: "fixtures" } });

/**
 * Re-ranks the fixture rotations under the requested priorities. The per-objective scores are fixture
 * values; only `total` is recomputed, with the same weighted mean the fixture builder used, so the demo
 * responds to the sliders without inventing scores.
 */
function exploreFromFixture(body: string | null): Response {
  let req: { horizon_years?: number; priorities?: Priorities } = {};
  try {
    req = body ? JSON.parse(body) : {};
  } catch {
    /* use defaults */
  }
  if (req.horizon_years !== undefined && req.horizon_years !== FIXTURE_HORIZON) {
    return json({ code: "demo_horizon_unavailable", message: `Demo data only covers ${FIXTURE_HORIZON}-year rotations.` }, 422);
  }
  const p = req.priorities ?? exploreRequest.priorities;
  const ranked = rotations.rotations
    .map((r) => ({ ...r, scores: { ...r.scores, total: weightedTotal(r.scores, p) } }))
    .sort((a, b) => b.scores.total - a.scores.total);
  return json({ ...rotations, rotations: ranked });
}

/** Serves a contract fixture as if it were the engine. Returns null for unknown routes. */
export function mockResponse(method: string, url: string, body: string | null = null): Response | null {
  const path = new URL(url, "http://mock.local").pathname;
  switch (`${method.toUpperCase()} ${path}`) {
    case "GET /v1/health":
      return json(health);
    case "GET /v1/crops":
      return json(crops);
    case "POST /v1/field/analyze":
      return json(fieldAnalyze);
    case "POST /v1/rotations/explore":
      return exploreFromFixture(body);
    case "GET /v1/validation":
      return json(validation);
    case "GET /v1/field/ndvi":
      return json(fieldNdvi);
    case "GET /v1/showcase":
      return json(showcase);
    case "GET /v1/field/climate":
      return json(fieldClimate);
    case "GET /v1/field/soil":
      return json(fieldSoil);
    default:
      return null;
  }
}
