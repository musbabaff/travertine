# services/engine

The Travertine engine: fetches and caches open Earth observation data, runs the field water balance and rotation
scoring, and serves the `/v1` API defined in [`packages/contract/openapi.yaml`](../../packages/contract/openapi.yaml).

**Owner: engine agent.** The web agent does not edit this directory (see [`CLAUDE.md`](../../CLAUDE.md)).

## Contract

Implement every endpoint exactly as specified, including units and the `provenance` array. The JSON files in
[`packages/contract/fixtures/`](../../packages/contract/fixtures/) show the expected shapes; fixtures marked
"Fixture only" in their provenance note are placeholders that should be replaced with real engine output.

Need a contract change? Open an issue describing the change and why; the web agent makes it in a `contract: ...` PR.

## CI

The root workflow runs engine tests automatically when this directory contains a `pyproject.toml` (runs `pytest`) or a
`package.json` with a `test` script.

## Setup

To be written by the engine agent: language and version, install, run, test, environment variables
(see the root `.env.example`).
