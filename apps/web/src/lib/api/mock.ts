import crops from "@travertine/contract/fixtures/crops.json";
import fieldAnalyze from "@travertine/contract/fixtures/field-analyze.json";
import health from "@travertine/contract/fixtures/health.json";
import rotations from "@travertine/contract/fixtures/rotations-explore.json";
import validation from "@travertine/contract/fixtures/validation.json";
import fieldRequest from "@travertine/contract/fixtures/field-analyze.request.json";

/** Location the fixtures describe. Used to warn when demo data is shown for a different place. */
export const FIXTURE_LOCATION = { lat: fieldRequest.lat, lon: fieldRequest.lon } as const;
export const DEMO_FIELD = fieldRequest;

const routes: Record<string, unknown> = {
  "GET /v1/health": health,
  "GET /v1/crops": crops,
  "POST /v1/field/analyze": fieldAnalyze,
  "POST /v1/rotations/explore": rotations,
  "GET /v1/validation": validation,
};

export const SOURCE_HEADER = "x-travertine-source";

/** Serves a contract fixture as if it were the engine. Returns null for unknown routes. */
export function mockResponse(method: string, url: string): Response | null {
  const path = new URL(url, "http://mock.local").pathname;
  const body = routes[`${method.toUpperCase()} ${path}`];
  if (body === undefined) return null;
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", [SOURCE_HEADER]: "fixtures" },
  });
}
