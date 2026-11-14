from __future__ import annotations

import gzip
import hashlib
import json
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from travertine_engine.cache import DiskCache, load_snapshot, snapshot_reads
from travertine_engine.config import ENGINE_ROOT, Settings
from travertine_engine.errors import UpstreamUnavailable
from travertine_engine.main import create_app
from travertine_engine.upstream import Upstream

SNAPSHOT = ENGINE_ROOT / "data" / "snapshot"


class NoNetwork(Upstream):
    def __init__(self) -> None:
        super().__init__(timeout_s=1, retries=0)
        self.calls = 0

    async def get_json(self, source: str, url: str, params: Any = None) -> Any:
        self.calls += 1
        raise UpstreamUnavailable(f"{source}: network disabled in this test")


def test_demo_field_is_served_from_the_snapshot_offline(tmp_path: Path) -> None:
    manifest = json.loads((SNAPSHOT / "manifest.json").read_text(encoding="utf-8"))
    first, last = manifest["record_years"]
    settings = Settings(
        cache_dir=tmp_path / "cache",
        snapshot_dir=SNAPSHOT,
        first_year=first,
        last_year=last,
        rate_limit_per_minute=1000,
    )
    upstream = NoNetwork()
    with TestClient(create_app(settings, upstream)) as c:
        r = c.post("/v1/field/analyze", json={"lat": 37.89, "lon": 28.98, "irrigated": False})
        assert r.status_code == 200, r.text
        body = r.json()
        explore = c.post(
            "/v1/rotations/explore",
            json={
                "lat": 37.89,
                "lon": 28.98,
                "horizon_years": 3,
                "priorities": {"water": 0.8, "income": 0.4, "soil": 0.6, "risk": 0.5},
                "irrigated": False,
            },
        )
    assert upstream.calls == 0
    assert len(body["climate"]) == last - first + 1
    assert body["soil"]["texture"]
    assert len(body["ndvi_history"]) == last - first + 1
    datasets = {p["dataset"].split(" ")[0]: p["note"] for p in body["provenance"]}
    assert not any(d.startswith("DEFAULT") for d in datasets)
    for name in ("NASA", "SoilGrids", "MODIS/Terra"):
        assert "bundled snapshot" in datasets[name]
    assert explore.status_code == 200, explore.text
    assert explore.json()["rotations"]


def test_snapshot_entries_match_their_checksums() -> None:
    manifest = json.loads((SNAPSHOT / "manifest.json").read_text(encoding="utf-8"))
    sources = {e["source"] for e in manifest["entries"]}
    assert {"power_daily", "soilgrids", "modis_mod13q1"} <= sources
    for e in manifest["entries"]:
        blob = (SNAPSHOT / e["file"]).read_bytes()
        assert hashlib.sha256(blob).hexdigest() == e["sha256"]
        assert e["url"].startswith("https://")
        assert e["fetched_at"]


def test_corrupt_snapshot_entry_is_skipped(tmp_path: Path) -> None:
    snap = tmp_path / "snap"
    (snap / "files").mkdir(parents=True)
    good = gzip.compress(b'{"a": 1}')
    (snap / "files" / "x.json.gz").write_bytes(good)
    entries = [
        {
            "key": "s/ok",
            "file": "files/x.json.gz",
            "sha256": hashlib.sha256(good).hexdigest(),
            "fetched_at": "2026-11-14T00:00:00+00:00",
            "url": "https://example.org/a",
        },
        {
            "key": "s/bad",
            "file": "files/x.json.gz",
            "sha256": "0" * 64,
            "fetched_at": "2026-11-14T00:00:00+00:00",
            "url": "https://example.org/a",
        },
    ]
    (snap / "manifest.json").write_text(json.dumps({"entries": entries}), encoding="utf-8")
    cache = DiskCache(tmp_path / "cache")
    assert load_snapshot(cache, snap) == 1
    assert cache.get("s/bad") is None
    with snapshot_reads() as reads:
        assert cache.get("s/ok") == {"a": 1}
    assert "2026-11-14" in reads.note("s")
    assert "example.org" in reads.note("s")


def test_live_entries_record_where_they_came_from(tmp_path: Path) -> None:
    cache = DiskCache(tmp_path)
    cache.put("src/k", [1, 2], url="https://example.org/q?x=1")
    meta = cache.meta("src/k")
    assert meta is not None
    assert meta["url"] == "https://example.org/q?x=1"
    with snapshot_reads() as reads:
        cache.get("src/k")
    assert reads.note("src") == ""


def test_missing_snapshot_is_not_an_error(tmp_path: Path) -> None:
    assert load_snapshot(DiskCache(tmp_path / "c"), tmp_path / "none") == 0
