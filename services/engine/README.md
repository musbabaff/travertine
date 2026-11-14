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
| `POST /v1/rotations/explore` | implemented — FAO-56 water-balance back-cast of every valid rotation over every historical window |
| `GET /v1/validation` | implemented — modelled stress vs MODIS NDVI anomalies with a baseline and bootstrap intervals; protocol in `docs/VALIDATION.md` |

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

## Cache and pre-warming

Upstream responses are cached as JSON under `data/cache/` (git-ignored), keyed by source, coordinates rounded to
0.001° and request parameters. Entries do not expire because the cached datasets are historical records or static
maps.

```bash
uv run python scripts/prewarm.py                    # demo field near Sarayköy, Denizli (37.89 N, 28.98 E)
uv run python scripts/prewarm.py 40.10,-88.20       # plus any extra lat,lon pairs
```

The Docker build runs the pre-warm step, so the deployed image answers the demo field even when NASA POWER or
SoilGrids is down.

## Environment variables

All optional. See the root `.env.example`.

| Variable | Default | Meaning |
|---|---|---|
| `ENGINE_CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `ENGINE_CORS_ORIGIN_REGEX` | unset | Extra origins matched by a full-match regex, for preview deployments |
| `ENGINE_CACHE_DIR` | `services/engine/data/cache` | Disk cache location |
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

Errors follow the contract `Error` schema: `invalid_request` (422), `out_of_coverage` (422), `not_found` (404),
`rate_limited` (429, with `Retry-After`), `upstream_unavailable` (502), `internal_error` (500). Every response carries an
`X-Request-ID` header; send your own to correlate logs.
