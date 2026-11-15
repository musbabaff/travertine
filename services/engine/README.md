# services/engine

The Travertine science engine. It fetches open Earth observation and soil data, computes reference
evapotranspiration and soil properties, and serves the `/v1` API defined in
[`packages/contract/openapi.yaml`](../../packages/contract/openapi.yaml).

**Owner: engine agent.** The web agent does not edit this directory (see [`CLAUDE.md`](../../CLAUDE.md)).
Contract changes are requested through GitHub issues labelled `contract`.

Methods are described in [`docs/METHODOLOGY.md`](../../docs/METHODOLOGY.md), datasets in
[`docs/DATA_SOURCES.md`](../../docs/DATA_SOURCES.md).

## Endpoints

| Endpoint | Status |
|---|---|
| `GET /v1/health` | implemented |
| `GET /v1/crops` | implemented — 12 crops from `data/crops.yaml`, every value cited to an FAO table |
| `POST /v1/field/analyze` | implemented — NASA POWER daily climate (2001 to the last full year), FAO-56 Penman-Monteith ET0, SoilGrids soil and available water capacity, MODIS growing-season NDVI history |
| `GET /v1/field/climate`, `/v1/field/soil`, `/v1/field/vegetation` | implemented — the three parts of `/v1/field/analyze` on their own, so the client shows climate as soon as NASA POWER answers (about 3.5 s for a new location) while SoilGrids (often 20 s or more) and MODIS load separately; `climate` starts the other two in the background |
| `GET /v1/field/ndvi` | implemented — 30 m HLS NDVI history since 2020 at the field centre, with its difference from MODIS for the same years |
| `GET /v1/showcase` | implemented — the eight multi-site validation locations, their back-test results from `data/multisite.json` and the pooled result; their data are in the snapshot |
| `POST /v1/rotations/explore` | implemented — FAO-56 water-balance back-cast of every valid rotation over every historical window; `language: "en" \| "tr"` sets the language of `explanation[]`; `current_rotation` (1–5 crop ids, repeated to fill the horizon) is scored with the same model and returned as `baseline` with `rule_violations[]`, and every alternative carries `vs_baseline` |
| `GET /v1/validation` | implemented — modelled stress vs MODIS NDVI anomalies with a baseline and bootstrap intervals; protocol in `docs/VALIDATION.md`; `?language=tr` for Turkish caveats |

Interactive docs are served at `/docs` when the engine runs.

## Setup

Python 3.12 and [uv](https://docs.astral.sh/uv/).

```bash
cd services/engine
uv sync
uv run python -m uvicorn travertine_engine.main:app --reload --port 8000
```

## Checks

```bash
uv run pytest            # unit, property and contract tests (no network)
uv run ruff check . && uv run ruff format --check .
uv run mypy              # strict
```

The contract tests read `packages/contract/openapi.yaml` and validate every response against it.

## Cache, snapshot and pre-warming

Upstream responses are cached as JSON under `data/cache/` (git-ignored), keyed by source, coordinates rounded to
0.001° and request parameters, with a `.meta.json` beside each entry recording when and from which URL it was
fetched. Entries do not expire because the cached datasets are historical records or static maps.

The demo field (37.89 N, 28.98 E) does not depend on any upstream being up. `data/snapshot/` holds its NASA POWER,
SoilGrids and MODIS responses, gzipped, with `manifest.json` listing each file's fetch time, request URL and SHA-256.
The engine copies the snapshot into the cache at start-up (and the image does so at build), without network access.
Responses built from snapshot entries say so in their provenance note, with the fetch date and host.

```bash
uv run python scripts/make_snapshot.py                            # refetch everything live; refuses partial data
uv run python scripts/make_snapshot.py --seed-modis-from data/cache  # reuse MODIS seasons already fetched
uv run python scripts/load_snapshot.py                            # snapshot -> cache, offline
uv run python scripts/prewarm.py                                  # fetch the demo field live into the cache
uv run python scripts/prewarm.py 40.10,-88.20                     # plus any extra lat,lon pairs
```

The current snapshot (14 November 2026): POWER and SoilGrids fetched live; the 25 MODIS seasons come from a fetch
earlier the same day because the ORNL service was answering 502 at the time, and the manifest marks them
`seeded_from_earlier_fetch`.

Since 15 November 2026 the snapshot also holds the eight multi-site validation locations (`scripts/validate_sites.py`):
POWER, SoilGrids and every complete MODIS season, as fetched live for the multi-site run on 14 November. They open
offline in about a second. At two of them (Settat, Great Bend) SoilGrids has no complete prediction, so their field
analysis uses the labelled default soil, exactly as a live request would. To add them to a fresh snapshot:

```bash
uv run python scripts/validate_sites.py                     # fetches the sites live into data/cache
uv run python scripts/add_sites_to_snapshot.py data/cache   # copies their responses into data/snapshot
```

## Environment variables

All optional. See the root `.env.example`.

| Variable | Default | Meaning |
|---|---|---|
| `ENGINE_CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `ENGINE_CORS_ORIGIN_REGEX` | unset | Extra origins matched by a full-match regex, for preview deployments |
| `ENGINE_CACHE_DIR` | `services/engine/data/cache` | Disk cache location |
| `ENGINE_WARM_FIELDS` | unset (image: `37.89,28.98`) | `lat,lon;lat,lon` fields whose rotation scores are computed in the background after start-up |
| `ENGINE_WARM_SHOWCASE` | unset (image: `1`) | after those, also warm the `/v1/showcase` fields at the 3-year horizon (rain-fed and irrigated); measured locally: 3.5 s and +3 MB per site, 146 MB in all |
| `ENGINE_SNAPSHOT_DIR` | `services/engine/data/snapshot` | Bundled upstream responses loaded into the cache at start-up |
| `ENGINE_FIRST_YEAR` / `ENGINE_LAST_YEAR` | 2001 / last full calendar year | Climate record period |
| `ENGINE_UPSTREAM_TIMEOUT_S` | 90 | Per-request timeout for upstream calls |
| `ENGINE_UPSTREAM_RETRIES` | 3 | Retries with exponential backoff and jitter |
| `ENGINE_RATE_LIMIT_PER_MINUTE` | 60 | Per-client token bucket on `/v1/*` (health excluded), per instance |
| `ENGINE_LOG_LEVEL` | `INFO` | JSON logs to stdout, each line carries the request id |
| `PORT` | 8000 | Listening port in the container |

## Container

```bash
docker build -t travertine-engine services/engine
docker run -p 8000:8000 -e ENGINE_CORS_ORIGINS=http://localhost:3000 travertine-engine
```

The image runs as an unprivileged user (uid 10001) without uv at runtime: the virtualenv is on `PATH` and the command
is plain `uvicorn`, bound to `0.0.0.0` and `$PORT` (8000 if unset). `HOME` and `XDG_CACHE_HOME` point into `/tmp`;
the only directory the server writes is `ENGINE_CACHE_DIR` (`/app/data/cache`), which that user owns. The build loads
the snapshot offline and then tries a live refresh capped at 30 seconds that cannot fail the build.
`ENGINE_LAST_YEAR` is fixed at 2025 in the image so the record matches the snapshot.

## Deployment (Render)

Live at `https://travertine-engine.onrender.com` (`https://api.travertinefields.com` once DNS is in place, #20).

| Setting | Value |
|---|---|
| Service | Render web service, Free instance (512 MB RAM, shared CPU) |
| Source | `main`, root directory `services/engine`, Docker |
| Health check path | `/v1/health` |
| `ENGINE_CORS_ORIGINS` | `https://travertinefields.com,https://www.travertinefields.com,https://travertine-bice.vercel.app,http://localhost:3000` |
| `ENGINE_CORS_ORIGIN_REGEX` | `^https://travertine-[a-z0-9-]+-musbabaffs-projects\.vercel\.app$` |
| Deploys | GitHub Actions calls the Render deploy hook after CI passes on `main` (secret `RENDER_DEPLOY_HOOK_URL`) |

The disk is not persistent. The demo field is served from the snapshot inside the image, so a restart loses
nothing for it; other locations are fetched again after a restart.

**Which commit is live.** `/v1/health` reports the version with the deployed commit as build metadata, for example
`0.1.0+69b6d7b` (from Render's `RENDER_GIT_COMMIT`, or `ENGINE_COMMIT` elsewhere). After a merge, compare it with
`git rev-parse --short=7 origin/main`; the old container keeps answering until the new one is up.

**Sleep and warm-up.** A free instance spins down after 15 minutes without requests; the first request afterwards
waits for the container to start. A scheduled workflow pings `/v1/health` every 10 minutes. Before a demo, wake it
and fill the in-memory rotation tables by hand:

```bash
curl -fsS -m 180 https://travertine-engine.onrender.com/v1/health
curl -fsS -m 180 -H 'content-type: application/json' -d '{"lat":37.89,"lon":28.98,"horizon_years":4,"priorities":{"water":0.8,"income":0.4,"soil":0.6,"risk":0.5},"irrigated":false}' https://travertine-engine.onrender.com/v1/rotations/explore -o /dev/null
```

**Warm-up inside the engine.** After start-up the engine computes the demo field's candidate scores for 3, 4 and
5 years, rain-fed and irrigated, in the background. These do not depend on the user's priorities, so later explore
requests only weigh them and describe the top ten.

**Memory.** Peak RSS on the demo field, measured on Linux: 115 MB after start-up and analysis, 124 MB for a 3-year
explore, 125 MB for 4 years, 146 MB for 5 years.

**Rollback.** In the Render dashboard: travertine-engine → Events → pick an earlier successful deploy → Rollback
(the free plan keeps the two most recent previous deploys). To roll back in git instead, revert the merge commit on
`main` through a pull request; the deploy hook redeploys once CI passes.

Errors follow the contract `Error` schema: `invalid_request` (422), `out_of_coverage` (422), `not_found` (404),
`rate_limited` (429, with `Retry-After`), `upstream_unavailable` (502), `internal_error` (500). Every response carries an
`X-Request-ID` header; send your own to correlate logs.
