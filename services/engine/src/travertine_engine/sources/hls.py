"""Harmonized Landsat Sentinel-2 (HLS v2.0) surface reflectance at one point, from the Microsoft Planetary Computer
STAC catalogue (collections hls2-l30 and hls2-s30) and its point-value data API. Anonymous access; the Planetary
Computer copy of HLS v2.0 starts in 2020."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any

from travertine_engine.cache import DiskCache, request_url
from travertine_engine.errors import UpstreamUnavailable
from travertine_engine.upstream import Upstream

SEARCH_URL = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
POINT_URL = "https://planetarycomputer.microsoft.com/api/data/v1/item/point/{lon},{lat}"
SOURCE = "HLS (Planetary Computer)"
FIRST_YEAR = 2020
# Red and narrow NIR in each product (HLS v2.0 user guide, Table 3: L30 B04/B05, S30 B04/B8A).
BANDS = {"hls2-l30": ("B04", "B05"), "hls2-s30": ("B04", "B8A")}
SENSOR = {"hls2-l30": "L30", "hls2-s30": "S30"}
MAX_SCENE_CLOUD = (
    80.0  # scenes cloudier than this rarely have a clear pixel; the pixel's own Fmask decides the rest
)
FILL = -9999.0
PAGE = 1000
CONCURRENCY = 8


@dataclass(frozen=True, slots=True)
class Observation:
    day: date
    sensor: str  # L30 or S30
    red: float
    nir: float
    fmask: int

    @property
    def clear(self) -> bool:
        """Fmask (HLS v2.0 user guide, Table 9): bit 0 (cirrus) is unused in v2.0; bits 1–5 are cloud, adjacent to
        cloud or shadow, cloud shadow, snow/ice and water; bits 6–7 the aerosol level. Clear = none of bits 1–5 set
        and aerosol not high."""
        return (self.fmask & 0b111110) == 0 and (self.fmask >> 6) & 0b11 != 0b11

    @property
    def ndvi(self) -> float | None:
        if self.red <= 0 or self.nir <= 0:
            return None
        return (self.nir - self.red) / (self.nir + self.red)


async def _scenes(
    upstream: Upstream, collection: str, lat: float, lon: float, year: int
) -> list[dict[str, Any]]:
    params: dict[str, Any] | None = {
        "collections": collection,
        "bbox": f"{lon:.5f},{lat:.5f},{lon:.5f},{lat:.5f}",
        "datetime": f"{year}-01-01/{year}-12-31",
        "limit": PAGE,
    }
    url = SEARCH_URL
    features: list[dict[str, Any]] = []
    while True:
        page = await upstream.get_json(SOURCE, url, params)
        if not isinstance(page, dict) or not isinstance(page.get("features"), list):
            raise UpstreamUnavailable("Planetary Computer STAC search returned an unexpected payload.")
        features.extend(page["features"])
        nxt = [link["href"] for link in page.get("links", []) if link.get("rel") == "next"]
        if not nxt or not page["features"]:
            return features
        url, params = nxt[0], None


def _pick(features: list[dict[str, Any]]) -> list[tuple[str, date]]:
    """One scene per acquisition: overlapping MGRS tiles repeat the same pixel, so keep the first tile per date."""
    seen: dict[date, str] = {}
    for f in sorted(features, key=lambda f: str(f["id"])):
        props = f.get("properties", {})
        cloud = props.get("eo:cloud_cover")
        if cloud is not None and float(cloud) > MAX_SCENE_CLOUD:
            continue
        day = datetime.fromisoformat(str(props["datetime"]).replace("Z", "+00:00")).date()
        seen.setdefault(day, str(f["id"]))
    return sorted(((item, day) for day, item in seen.items()), key=lambda x: x[1])


async def _point(
    upstream: Upstream, collection: str, item: str, lat: float, lon: float
) -> tuple[float, float, int] | None:
    red, nir = BANDS[collection]
    url = POINT_URL.format(lon=f"{lon:.5f}", lat=f"{lat:.5f}")
    params = [
        ("collection", collection),
        ("item", item),
        ("assets", red),
        ("assets", nir),
        ("assets", "Fmask"),
    ]
    raw = await upstream.get_json(SOURCE, url, params)
    values = raw.get("values") if isinstance(raw, dict) else None
    if not isinstance(values, list) or len(values) != 3 or any(v is None for v in values):
        return None
    r, n, m = (float(v) for v in values)
    if FILL in (r, n) or m == 255:
        return None
    return r, n, int(m)


async def _year(
    upstream: Upstream, cache: DiskCache, lat: float, lon: float, year: int, gate: asyncio.Semaphore
) -> list[Observation]:
    key = cache.key("hls_point", lat, lon, {"year": year, "v": 2}, places=4)
    raw: Any = cache.get(key)
    if raw is None:
        rows: list[list[Any]] = []
        for collection in BANDS:
            async with gate:
                scenes = _pick(await _scenes(upstream, collection, lat, lon, year))

            async def one(item: str, day: date, collection: str = collection) -> list[Any] | None:
                async with gate:
                    v = await _point(upstream, collection, item, lat, lon)
                return None if v is None else [day.isoformat(), SENSOR[collection], *v]

            rows.extend(r for r in await asyncio.gather(*(one(i, d) for i, d in scenes)) if r is not None)
        raw = sorted(rows)
        if year < datetime.now(UTC).year:  # the current year keeps growing
            cache.put(
                key,
                raw,
                url=request_url(
                    SEARCH_URL,
                    {
                        "bbox": f"{lon:.5f},{lat:.5f},{lon:.5f},{lat:.5f}",
                        "datetime": f"{year}-01-01/{year}-12-31",
                    },
                ),
            )
    return [
        Observation(day=date.fromisoformat(d), sensor=s, red=r, nir=n, fmask=int(m)) for d, s, r, n, m in raw
    ]


async def fetch_hls(
    upstream: Upstream, cache: DiskCache, lat: float, lon: float, last_year: int
) -> list[Observation]:
    gate = asyncio.Semaphore(CONCURRENCY)
    years = range(FIRST_YEAR, last_year + 1)
    per_year = await asyncio.gather(*(_year(upstream, cache, lat, lon, y, gate) for y in years))
    return [o for obs in per_year for o in obs]
