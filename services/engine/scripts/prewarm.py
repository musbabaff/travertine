"""Fill the disk cache for the demo field (and any extra points) from the live services.

    uv run python scripts/prewarm.py                 # demo field
    uv run python scripts/prewarm.py 40.1,-88.2 ...  # extra lat,lon pairs
    uv run python scripts/prewarm.py --refresh       # image build: 30 s cap, never fails

The image does not depend on this: the demo field is loaded from the committed snapshot first
(`scripts/load_snapshot.py`). Without `--refresh` the exit code is non-zero if any location failed.
"""

from __future__ import annotations

import asyncio
import logging
import sys

from travertine_engine.cache import DiskCache
from travertine_engine.config import Settings
from travertine_engine.field import FieldService
from travertine_engine.logs import configure_logging
from travertine_engine.upstream import Upstream

DEMO_FIELD = (37.89, 28.98)  # near Sarayköy, Denizli, Türkiye
REFRESH_BUDGET_S = 30.0

log = logging.getLogger("prewarm")


async def warm(points: list[tuple[float, float]], *, quick: bool) -> int:
    settings = Settings.from_env()
    upstream = Upstream(timeout_s=10.0 if quick else 120.0, retries=0 if quick else 4)
    service = FieldService(settings, upstream, DiskCache(settings.cache_dir))
    failures = 0
    try:
        for lat, lon in points:
            try:
                result = await service.analyze(lat, lon)
            except Exception:
                failures += 1
                log.exception("prewarm failed", extra={"lat": lat, "lon": lon})
                continue
            soil_default = result.provenance[1].dataset.startswith("DEFAULT")
            failures += soil_default or not result.ndvi_history
            log.info(
                "prewarmed",
                extra={
                    "lat": lat,
                    "lon": lon,
                    "years": len(result.climate),
                    "soil_default": soil_default,
                    "ndvi_years": len(result.ndvi_history or []),
                },
            )
    finally:
        await upstream.aclose()
    return failures


def main(argv: list[str]) -> int:
    configure_logging("INFO")
    refresh = "--refresh" in argv
    points = [DEMO_FIELD]
    for arg in argv:
        if arg.startswith("--"):
            continue
        lat, lon = (float(v) for v in arg.split(","))
        points.append((lat, lon))
    if not refresh:
        return 1 if asyncio.run(warm(points, quick=False)) else 0
    try:
        failures = asyncio.run(asyncio.wait_for(warm(points, quick=True), REFRESH_BUDGET_S))
    except Exception:
        log.warning("live refresh stopped; the cache keeps the snapshot", exc_info=True)
        return 0
    if failures:
        log.warning("live refresh incomplete; the cache keeps the snapshot", extra={"failures": failures})
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
