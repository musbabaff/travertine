"""MODIS/Terra MOD13Q1 v061 NDVI through the ORNL DAAC MODIS web service
(https://modis.ornl.gov/data/modis_webservice.html). No account is needed."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

from travertine_engine.cache import DiskCache
from travertine_engine.errors import UpstreamUnavailable
from travertine_engine.upstream import Upstream

SUBSET_URL = "https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset"
NDVI_BAND = "250m_16_days_NDVI"
RELIABILITY_BAND = "250m_16_days_pixel_reliability"
NDVI_FILL = -3000
NDVI_SCALE = 0.0001
# Composites starting on day 97 to 241: ten 16-day periods from early April to late September. The service caps a
# subset request at ten dates, so one request per band covers one growing season.
SEASON_FIRST_DOY = 97
SEASON_LAST_DOY = 241
SEASON_COMPOSITES = 10
CONCURRENCY = 3  # the service throttles bursts; with 6 seasons in flight most requests needed retries


@dataclass(frozen=True, slots=True)
class Composite:
    doy: int
    ndvi: float | None  # None for fill
    reliability: int  # 0 good, 1 marginal, 2 snow/ice, 3 cloudy, -1 fill


async def _band(upstream: Upstream, lat: float, lon: float, year: int, band: str) -> dict[int, int]:
    params = {
        "latitude": f"{lat:.4f}",
        "longitude": f"{lon:.4f}",
        "band": band,
        "startDate": f"A{year}{SEASON_FIRST_DOY:03d}",
        "endDate": f"A{year}{SEASON_LAST_DOY:03d}",
        "kmAboveBelow": 0,
        "kmLeftRight": 0,
    }
    raw = await upstream.get_json("MODIS (ORNL DAAC)", SUBSET_URL, params)
    if not isinstance(raw, dict) or not isinstance(raw.get("subset"), list):
        raise UpstreamUnavailable("MODIS web service returned an unexpected payload.", details={"year": year})
    out: dict[int, int] = {}
    for item in raw["subset"]:
        doy = int(str(item["modis_date"])[5:])
        data = item.get("data") or []
        if data:
            out[doy] = int(data[0])
    return out


async def _season(upstream: Upstream, cache: DiskCache, lat: float, lon: float, year: int) -> list[Composite]:
    key = cache.key("modis_mod13q1", lat, lon, {"year": year, "doy": [SEASON_FIRST_DOY, SEASON_LAST_DOY]})
    raw: Any = cache.get(key)
    if raw is None:
        ndvi, rel = await asyncio.gather(
            _band(upstream, lat, lon, year, NDVI_BAND), _band(upstream, lat, lon, year, RELIABILITY_BAND)
        )
        raw = [[doy, ndvi[doy], rel.get(doy, -1)] for doy in sorted(ndvi)]
        if len(raw) == SEASON_COMPOSITES:  # a season still being processed is fetched again next time
            cache.put(key, raw)
    return [
        Composite(doy=int(d), ndvi=None if v == NDVI_FILL else v * NDVI_SCALE, reliability=int(r))
        for d, v, r in raw
    ]


async def fetch_ndvi_seasons(
    upstream: Upstream, cache: DiskCache, lat: float, lon: float, years: range
) -> dict[int, list[Composite]]:
    gate = asyncio.Semaphore(CONCURRENCY)

    async def one(year: int) -> tuple[int, list[Composite]]:
        async with gate:
            return year, await _season(upstream, cache, lat, lon, year)

    return dict(await asyncio.gather(*(one(y) for y in years)))
