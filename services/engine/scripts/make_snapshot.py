"""Record the demo field's upstream responses into data/snapshot so the image can be built without network.

    uv run python scripts/make_snapshot.py
    uv run python scripts/make_snapshot.py --seed-modis-from data/cache

Fetches everything live into an empty cache, refuses to write anything unless every source answered (real soil,
a full NDVI record), then stores each response gzipped with a manifest of fetch times, URLs and checksums.

The ORNL MODIS service has long outages. `--seed-modis-from` copies MODIS seasons already fetched into another
cache directory; their fetch time is the file's modification time and the URL is rebuilt from the same request
parameters the engine uses, and the manifest marks them as seeded.
"""

from __future__ import annotations

import asyncio
import gzip
import hashlib
import json
import logging
import shutil
import sys
import tempfile
from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path

from travertine_engine.cache import DiskCache, request_url
from travertine_engine.config import ENGINE_ROOT, Settings
from travertine_engine.field import FieldService
from travertine_engine.logs import configure_logging
from travertine_engine.sources.modis import NDVI_BAND, SEASON_FIRST_DOY, SEASON_LAST_DOY, SUBSET_URL, _params
from travertine_engine.upstream import Upstream

DEMO_FIELD = (37.89, 28.98)
SNAPSHOT_DIR = ENGINE_ROOT / "data" / "snapshot"

log = logging.getLogger("make_snapshot")


def seed_modis(source_dir: Path, cache_dir: Path) -> int:
    settings = Settings.from_env()
    src, dst = DiskCache(source_dir), DiskCache(cache_dir)
    lat, lon = DEMO_FIELD
    seeded = 0
    for year in range(settings.first_year, settings.last_year + 1):
        key = dst.key("modis_mod13q1", lat, lon, {"year": year, "doy": [SEASON_FIRST_DOY, SEASON_LAST_DOY]})
        raw = src.get(key)
        if raw is None:
            continue
        fetched = datetime.fromtimestamp(src._path(key).stat().st_mtime, UTC).isoformat(timespec="seconds")
        url = request_url(SUBSET_URL, _params(lat, lon, year, NDVI_BAND))
        dst.put(key, raw, meta={"fetched_at": fetched, "url": url, "seeded_from_earlier_fetch": True})
        seeded += 1
    return seeded


async def fetch(cache_dir: Path) -> list[str]:
    settings = replace(Settings.from_env(), cache_dir=cache_dir, snapshot_dir=None)
    upstream = Upstream(timeout_s=120.0, retries=5)
    try:
        result = await FieldService(settings, upstream, DiskCache(cache_dir)).analyze(*DEMO_FIELD)
    finally:
        await upstream.aclose()
    problems = []
    if result.provenance[1].dataset.startswith("DEFAULT"):
        problems.append("SoilGrids did not answer")
    expected = settings.last_year - settings.first_year + 1
    if not result.ndvi_history or len(result.ndvi_history) < expected:
        problems.append(f"MODIS record incomplete: {len(result.ndvi_history or [])} of {expected} seasons")
    if len(result.climate) < expected:
        problems.append(f"POWER record incomplete: {len(result.climate)} of {expected} years")
    return problems


def write(cache_dir: Path, out: Path) -> int:
    settings = Settings.from_env()
    entries = []
    files = out / "files"
    shutil.rmtree(files, ignore_errors=True)
    for path in sorted(cache_dir.rglob("*.json")):
        if path.name.endswith(".meta.json"):
            continue
        key = path.relative_to(cache_dir).as_posix()[: -len(".json")]
        meta = json.loads(path.with_name(path.stem + ".meta.json").read_text(encoding="utf-8"))
        blob = gzip.compress(path.read_bytes(), compresslevel=9, mtime=0)
        target = files / f"{key}.json.gz"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(blob)
        entries.append(
            {
                "key": key,
                "source": key.split("/", 1)[0],
                "file": target.relative_to(out).as_posix(),
                "sha256": hashlib.sha256(blob).hexdigest(),
                "fetched_at": meta["fetched_at"],
                "url": meta["url"],
                **({"seeded_from_earlier_fetch": True} if meta.get("seeded_from_earlier_fetch") else {}),
            }
        )
    manifest = {
        "created_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "field": {"lat": DEMO_FIELD[0], "lon": DEMO_FIELD[1]},
        "record_years": [settings.first_year, settings.last_year],
        "note": "Upstream responses for the demo field, fetched live by scripts/make_snapshot.py. Loaded into the "
        "cache at image build and start-up; responses that use them say so in their provenance note.",
        "entries": entries,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8")
    return len(entries)


def main() -> int:
    configure_logging("INFO")
    with tempfile.TemporaryDirectory() as tmp:
        cache_dir = Path(tmp)
        if len(sys.argv) == 3 and sys.argv[1] == "--seed-modis-from":
            log.info("seeded modis seasons", extra={"seasons": seed_modis(Path(sys.argv[2]), cache_dir)})
        problems = asyncio.run(fetch(cache_dir))
        if problems:
            for p in problems:
                log.error("snapshot not written", extra={"problem": p})
            return 1
        n = write(cache_dir, SNAPSHOT_DIR)
    log.info("snapshot written", extra={"entries": n, "dir": str(SNAPSHOT_DIR)})
    return 0


if __name__ == "__main__":
    sys.exit(main())
