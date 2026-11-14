# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-14

First public state, deployed at https://travertinefields.com with the engine at https://api.travertinefields.com.

### Added

- Monorepo with the OpenAPI v1 contract, fixtures built from public data, generated types, CI and agent rules.
- Engine: health, crop catalogue (12 crops cited to FAO-56 tables) and field analysis on NASA POWER daily weather,
  FAO-56 Penman-Monteith ET0 and SoilGrids soil (#1).
- Web: Field screen with map drawing, place search, field summary and an honest fixture fallback (#3).
- Web: Explore screen with priority sliders, ranked rotations and side-by-side comparison (#6).
- Engine: rotation exploration with an FAO-56 daily water-balance back-cast (#7).
- Engine: configurable CORS origin pattern for preview deployments (#8).
- Web: Evidence screen with the back-test chart and verbatim method and caveats (#9).
- Engine: MODIS NDVI history and validation against a dryness baseline with bootstrap intervals (#11).
- Web: canonical URL, Open Graph URLs, sitemap and robots on travertinefields.com (#14).
- Web: Travertine brand applied: traced logo, brand-aligned colour tokens, icons, manifest, Open Graph image,
  404 and error pages (#17).
- Contract: baseline comparison and confidence intervals on `/v1/validation` (#21).
- Contract: `GET /v1/field/ndvi` for 30 m HLS NDVI history (#22).
- CI: engine keep-alive ping and deploy after green CI (#23).
- Web: live engine connection with a waking-up hint (#24).
- Web: model-versus-baseline comparison on Evidence and 30 m NDVI beside 250 m (#28).

### Changed

- Contract fixtures regenerated from engine output (crops, field analysis, field_id) (#4).
- Vercel builds only for web or contract changes; a CI check confirms production serves each merged commit (#16).
- Engine scores exploration candidates in chunks to bound memory (#27).

### Fixed

- Engine starts without uv at runtime and serves the demo field from a committed snapshot (#18).
- Web allows up to five minutes for a first analysis of a new location before falling back (#26).

[Unreleased]: https://github.com/musbabaff/travertine/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/musbabaff/travertine/releases/tag/v0.1.0
