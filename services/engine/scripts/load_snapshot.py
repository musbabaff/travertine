"""Copy the committed demo-field snapshot into the engine cache. No network access.

    uv run python scripts/load_snapshot.py

Exits non-zero if the snapshot is missing or none of its entries could be loaded or found in the cache.
"""

from __future__ import annotations

import json
import sys

from travertine_engine.cache import DiskCache, load_snapshot
from travertine_engine.config import Settings


def main() -> int:
    settings = Settings.from_env()
    if settings.snapshot_dir is None or not (settings.snapshot_dir / "manifest.json").exists():
        print("no snapshot found", file=sys.stderr)
        return 1
    cache = DiskCache(settings.cache_dir)
    written = load_snapshot(cache, settings.snapshot_dir)
    manifest = json.loads((settings.snapshot_dir / "manifest.json").read_text(encoding="utf-8"))
    present = sum(1 for e in manifest["entries"] if cache.get(e["key"]) is not None)
    print(
        f"snapshot: {written} entries written, {present} of {len(manifest['entries'])} present in the cache"
    )
    return 0 if present == len(manifest["entries"]) else 1


if __name__ == "__main__":
    sys.exit(main())
