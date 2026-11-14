"""Fill the disk cache for the demo field so the demo keeps working when NASA POWER, SoilGrids, MODIS or HLS is
down.

    uv run python scripts/prewarm.py                 # demo field only
    uv run python scripts/prewarm.py 40.1,-88.2 ...  # extra lat,lon pairs

Exits non-zero if any location failed, so a build step can decide whether that is fatal.
"""

from __future__ import annotations

import asyncio
import logging
import sys

from travertine_engine.cache import DiskCache
from travertine_engine.config import Settings
from travertine_engine.field import FieldService
from travertine_engine.field_ndvi import FieldNdviService
from travertine_engine.logs import configure_logging
from travertine_engine.upstream import Upstream

DEMO_FIELD = (37.89, 28.98)  # near Sarayköy, Denizli, Türkiye

log = logging.getLogger("prewarm")


async def warm(points: list[tuple[float, float]]) -> int:
    settings = Settings.from_env()
    upstream = Upstream(timeout_s=max(settings.upstream_timeout_s, 120.0), retries=4)
    service = FieldService(settings, upstream, DiskCache(settings.cache_dir))
    hls = FieldNdviService(service)
    failures = 0
    try:
        for lat, lon in points:
            try:
                result = await service.analyze(lat, lon)
            except Exception:
                failures += 1
                log.exception("prewarm failed", extra={"lat": lat, "lon": lon})
                continue
            try:
                await hls.history(lat, lon)
            except Exception:
                failures += 1
                log.exception("prewarm of 30 m NDVI failed", extra={"lat": lat, "lon": lon})
            soil_default = result.provenance[1].dataset.startswith("DEFAULT")
            if soil_default:
                failures += 1
            log.info(
                "prewarmed",
                extra={"lat": lat, "lon": lon, "years": len(result.climate), "soil_default": soil_default},
            )
    finally:
        await upstream.aclose()
    return failures


def main(argv: list[str]) -> int:
    configure_logging("INFO")
    points = [DEMO_FIELD]
    for arg in argv:
        lat, lon = (float(v) for v in arg.split(","))
        points.append((lat, lon))
    return 1 if asyncio.run(warm(points)) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
