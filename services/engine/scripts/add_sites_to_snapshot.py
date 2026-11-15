"""Add the multi-site validation locations to data/snapshot, so the showcase fields open without a network call.

    uv run python scripts/add_sites_to_snapshot.py data/cache

Copies, from a cache filled by scripts/validate_sites.py, every POWER, SoilGrids and MODIS response for the sites
in that script. Each entry keeps the fetch time and URL of the live request that produced it. Existing snapshot
entries are left as they are.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import sys
from pathlib import Path

from travertine_engine.config import ENGINE_ROOT

sys.path.insert(0, str(Path(__file__).parent))
from validate_sites import SITES

SNAPSHOT_DIR = ENGINE_ROOT / "data" / "snapshot"
SOURCES = ("power_daily", "soilgrids", "modis_mod13q1")


def site_of(name: str) -> tuple[float, float]:
    lat, lon = name.split("_")[:2]
    return round(float(lat), 2), round(float(lon), 2)


def main(cache_dir: Path) -> int:
    manifest_path = SNAPSHOT_DIR / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    known = {e["key"] for e in manifest["entries"]}
    points = {(round(lat, 2), round(lon, 2)) for _, _, lat, lon in SITES}
    added = 0
    for source in SOURCES:
        for path in sorted((cache_dir / source).glob("*.json")):
            if path.name.endswith(".meta.json") or site_of(path.name) not in points:
                continue
            key = f"{source}/{path.stem}"
            if key in known:
                continue
            meta = json.loads(path.with_name(path.stem + ".meta.json").read_text(encoding="utf-8"))
            blob = gzip.compress(path.read_bytes(), compresslevel=9, mtime=0)
            target = SNAPSHOT_DIR / "files" / f"{key}.json.gz"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(blob)
            manifest["entries"].append(
                {
                    "key": key,
                    "source": source,
                    "file": target.relative_to(SNAPSHOT_DIR).as_posix(),
                    "sha256": hashlib.sha256(blob).hexdigest(),
                    "fetched_at": meta["fetched_at"],
                    "url": meta["url"],
                }
            )
            added += 1
    manifest["showcase_sites"] = [
        {"id": site_id, "name": name, "lat": lat, "lon": lon} for site_id, name, lat, lon in SITES
    ]
    manifest["note"] = (
        "Upstream responses for the demo field and the multi-site validation locations, fetched live by "
        "scripts/make_snapshot.py and scripts/validate_sites.py. Loaded into the cache at image build and start-up; "
        "responses that use them say so in their provenance note."
    )
    manifest_path.write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"added {added} entries; snapshot now has {len(manifest['entries'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1])))
