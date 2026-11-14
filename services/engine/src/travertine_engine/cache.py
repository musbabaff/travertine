"""Disk cache for upstream responses, keyed by source, rounded coordinates and request parameters.

Entries never expire: the datasets we cache are historical records or static maps, and the pre-warm script
(`scripts/prewarm.py`) relies on cached entries surviving an upstream outage. Delete the directory to refresh.
"""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any


def round_coord(value: float, places: int = 3) -> float:
    return round(value, places)


class DiskCache:
    def __init__(self, root: Path) -> None:
        self.root = root

    def key(self, source: str, lat: float, lon: float, params: dict[str, Any], places: int = 3) -> str:
        blob = json.dumps(
            {"lat": round_coord(lat, places), "lon": round_coord(lon, places), **params},
            sort_keys=True,
            separators=(",", ":"),
        )
        digest = hashlib.sha256(blob.encode()).hexdigest()[:24]
        return (
            f"{source}/{round_coord(lat, places):+.{places}f}_{round_coord(lon, places):+.{places}f}_{digest}"
        )

    def _path(self, key: str) -> Path:
        return self.root / f"{key}.json"

    def get(self, key: str) -> Any | None:
        path = self._path(key)
        try:
            with path.open(encoding="utf-8") as fh:
                return json.load(fh)
        except FileNotFoundError:
            return None
        except (OSError, json.JSONDecodeError):
            path.unlink(missing_ok=True)
            return None

    def put(self, key: str, value: Any) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump(value, fh, separators=(",", ":"))
            os.replace(tmp, path)
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise
