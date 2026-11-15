"""Disk cache for upstream responses, keyed by source, rounded coordinates and request parameters.

Entries never expire: the datasets we cache are historical records or static maps. Each entry has a sidecar
`<key>.meta.json` saying when and from which URL it was fetched; entries copied from the bundled snapshot
(`data/snapshot`) are marked as such so responses can say they did not come from a live request.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import logging
import os
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

from travertine_engine.prov_text import snapshot_note
from travertine_engine.text import Language

log = logging.getLogger(__name__)

_snapshot_reads: ContextVar[dict[str, dict[str, Any]] | None] = ContextVar("snapshot_reads", default=None)


def round_coord(value: float, places: int = 3) -> float:
    return round(value, places)


def request_url(url: str, params: Any = None) -> str:
    return str(httpx.URL(url, params=params))


class SnapshotReads:
    """Snapshot entries read while this tracker was active, by cache source (the key's first path part)."""

    def __init__(self, reads: dict[str, dict[str, Any]]) -> None:
        self.reads = reads

    def fetch(self, source: str) -> tuple[str, str] | None:
        """(fetch date, host) of the snapshot entry this source was served from, or None."""
        meta = self.reads.get(source)
        if meta is None:
            return None
        return meta["fetched_at"][:10], httpx.URL(meta["url"]).host

    def note(self, source: str, lang: Language = "en") -> str:
        hit = self.fetch(source)
        return snapshot_note(lang, *hit) if hit else ""


@contextmanager
def snapshot_reads() -> Iterator[SnapshotReads]:
    reads: dict[str, dict[str, Any]] = {}
    token = _snapshot_reads.set(reads)
    try:
        yield SnapshotReads(reads)
    finally:
        _snapshot_reads.reset(token)


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

    def _meta_path(self, key: str) -> Path:
        return self.root / f"{key}.meta.json"

    def meta(self, key: str) -> dict[str, Any] | None:
        try:
            with self._meta_path(key).open(encoding="utf-8") as fh:
                value: dict[str, Any] = json.load(fh)
                return value
        except (OSError, json.JSONDecodeError):
            return None

    def get(self, key: str) -> Any | None:
        path = self._path(key)
        try:
            with path.open(encoding="utf-8") as fh:
                value = json.load(fh)
        except FileNotFoundError:
            return None
        except (OSError, json.JSONDecodeError):
            path.unlink(missing_ok=True)
            return None
        reads = _snapshot_reads.get()
        if reads is not None:
            meta = self.meta(key)
            if meta and meta.get("snapshot"):
                reads.setdefault(key.split("/", 1)[0], meta)
        return value

    def put(
        self, key: str, value: Any, *, url: str | None = None, meta: dict[str, Any] | None = None
    ) -> None:
        self._write(self._path(key), value)
        if meta is None:
            meta = {"fetched_at": datetime.now(UTC).isoformat(timespec="seconds"), "url": url}
        self._write(self._meta_path(key), meta)

    @staticmethod
    def _write(path: Path, value: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump(value, fh, separators=(",", ":"))
            os.replace(tmp, path)
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise


def load_snapshot(cache: DiskCache, snapshot_dir: Path) -> int:
    """Copy bundled upstream responses into the cache without any network call. Existing entries are kept.
    Returns the number of entries written; a missing snapshot directory is not an error."""
    manifest_path = snapshot_dir / "manifest.json"
    if not manifest_path.exists():
        return 0
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    written = 0
    for entry in manifest["entries"]:
        key = entry["key"]
        if cache._path(key).exists():
            continue
        blob = (snapshot_dir / entry["file"]).read_bytes()
        if hashlib.sha256(blob).hexdigest() != entry["sha256"]:
            log.warning("snapshot entry failed its checksum, skipped", extra={"key": key})
            continue
        payload = json.loads(gzip.decompress(blob))
        cache.put(
            key, payload, meta={"fetched_at": entry["fetched_at"], "url": entry["url"], "snapshot": True}
        )
        written += 1
    return written
