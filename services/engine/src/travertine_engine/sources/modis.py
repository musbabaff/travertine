"""MODIS/Terra MOD13Q1 v061 NDVI at one pixel, from Microsoft Planetary Computer (STAC catalogue and point-value
API), falling back to the ORNL DAAC MODIS web service (https://modis.ornl.gov/data/modis_webservice.html). Both serve
the same LP DAAC granules: for the demo pixel, 20 composites in 2005 and 2023 gave identical NDVI and reliability
values from the two. No account is needed for either."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

from travertine_engine.cache import DiskCache, request_url
from travertine_engine.errors import UpstreamUnavailable
from travertine_engine.upstream import Upstream

SUBSET_URL = "https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset"
PC_SEARCH_URL = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
PC_POINT_URL = "https://planetarycomputer.microsoft.com/api/data/v1/item/point/{lon},{lat}"
PC_COLLECTION = "modis-13Q1-061"
PC_SOURCE = "MODIS (Planetary Computer)"
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


def _params(lat: float, lon: float, year: int, band: str) -> dict[str, Any]:
    return {
        "latitude": f"{lat:.4f}",
        "longitude": f"{lon:.4f}",
        "band": band,
        "startDate": f"A{year}{SEASON_FIRST_DOY:03d}",
        "endDate": f"A{year}{SEASON_LAST_DOY:03d}",
        "kmAboveBelow": 0,
        "kmLeftRight": 0,
    }


async def _band(upstream: Upstream, lat: float, lon: float, year: int, band: str) -> dict[int, int]:
    raw = await upstream.get_json("MODIS (ORNL DAAC)", SUBSET_URL, _params(lat, lon, year, band))
    if not isinstance(raw, dict) or not isinstance(raw.get("subset"), list):
        raise UpstreamUnavailable("MODIS web service returned an unexpected payload.", details={"year": year})
    out: dict[int, int] = {}
    for item in raw["subset"]:
        doy = int(str(item["modis_date"])[5:])
        data = item.get("data") or []
        if data:
            out[doy] = int(data[0])
    return out


async def _season_ornl(upstream: Upstream, lat: float, lon: float, year: int) -> tuple[list[list[int]], str]:
    ndvi, rel = await asyncio.gather(
        _band(upstream, lat, lon, year, NDVI_BAND), _band(upstream, lat, lon, year, RELIABILITY_BAND)
    )
    # The NDVI request stands for both: the reliability band is the same query with another band name.
    url = request_url(SUBSET_URL, _params(lat, lon, year, NDVI_BAND))
    return [[doy, ndvi[doy], rel.get(doy, -1)] for doy in sorted(ndvi)], url


async def _season_pc(upstream: Upstream, lat: float, lon: float, year: int) -> tuple[list[list[int]], str]:
    search = {
        "collections": PC_COLLECTION,
        "bbox": f"{lon:.5f},{lat:.5f},{lon:.5f},{lat:.5f}",
        "datetime": f"{year}-03-15/{year}-10-15",
        "limit": 100,
    }
    page = await upstream.get_json(PC_SOURCE, PC_SEARCH_URL, search)
    if not isinstance(page, dict) or not isinstance(page.get("features"), list):
        raise UpstreamUnavailable("Planetary Computer returned an unexpected MODIS search payload.")
    items: dict[int, str] = {}
    for feature in sorted(page["features"], key=lambda f: str(f["id"])):
        ident = str(feature["id"])  # MOD13Q1.A<year><doy>.h20v05.061.<processing time>; MYD13Q1 is Aqua
        if ident.startswith(f"MOD13Q1.A{year}"):
            doy = int(ident[13:16])
            if SEASON_FIRST_DOY <= doy <= SEASON_LAST_DOY:
                items.setdefault(doy, ident)

    async def point(doy: int, item: str) -> list[int]:
        params = [
            ("collection", PC_COLLECTION),
            ("item", item),
            ("assets", NDVI_BAND),
            ("assets", RELIABILITY_BAND),
        ]
        raw = await upstream.get_json(
            PC_SOURCE, PC_POINT_URL.format(lon=f"{lon:.5f}", lat=f"{lat:.5f}"), params
        )
        values = raw.get("values") if isinstance(raw, dict) else None
        if not isinstance(values, list) or len(values) != 2 or values[0] is None:
            return [doy, NDVI_FILL, -1]
        return [doy, int(values[0]), int(values[1]) if values[1] is not None else -1]

    rows = await asyncio.gather(*(point(d, i) for d, i in sorted(items.items())))
    return list(rows), request_url(PC_SEARCH_URL, search)


async def _season(upstream: Upstream, cache: DiskCache, lat: float, lon: float, year: int) -> list[Composite]:
    key = cache.key("modis_mod13q1", lat, lon, {"year": year, "doy": [SEASON_FIRST_DOY, SEASON_LAST_DOY]})
    raw: Any = cache.get(key)
    if raw is None:
        try:
            raw, url = await _season_pc(upstream, lat, lon, year)
        except UpstreamUnavailable:
            raw, url = await _season_ornl(upstream, lat, lon, year)
        if len(raw) == SEASON_COMPOSITES:  # a season still being processed is fetched again next time
            cache.put(key, raw, url=url)
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
