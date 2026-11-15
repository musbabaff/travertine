"""Multi-site back-test, exactly as fixed in docs/VALIDATION.md section 4. Writes docs/validation/multisite.json.

    uv run python scripts/validate_sites.py

Sites and settings are fixed in the protocol; do not edit them here without changing the protocol first.
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys
from datetime import UTC, datetime
from typing import Any

from travertine_engine.cache import DiskCache
from travertine_engine.config import ENGINE_ROOT, Settings
from travertine_engine.errors import EngineError, OutOfCoverage, UpstreamUnavailable
from travertine_engine.explore import ExploreService
from travertine_engine.field import FieldService
from travertine_engine.logs import configure_logging
from travertine_engine.science.ndvi import pooled_paired_bootstrap
from travertine_engine.text import verdict
from travertine_engine.upstream import Upstream
from travertine_engine.validation import RESAMPLES, SEED, BackTest, back_test

SITES = [
    ("tr-saraykoy", "Sarayköy, Denizli, Türkiye", 37.89, 28.98),
    ("tr-cihanbeyli", "Cihanbeyli, Konya, Türkiye", 38.65, 32.93),
    ("tr-polatli", "Polatlı, Ankara, Türkiye", 39.58, 32.15),
    ("ma-settat", "Settat, Chaouia, Morocco", 33.00, -7.62),
    ("es-tierra-de-campos", "Tierra de Campos, Valladolid, Spain", 41.95, -4.95),
    ("ro-baragan", "Bărăgan plain, Călărași, Romania", 44.35, 27.20),
    ("us-kansas", "Great Bend, Kansas, USA", 38.36, -98.76),
    ("fr-beauce", "Beauce, Eure-et-Loir, France", 48.25, 1.75),
]
OUT = ENGINE_ROOT.parents[1] / "docs" / "validation" / "multisite.json"

log = logging.getLogger("validate_sites")


def _r(x: float) -> float:
    return round(x, 3)


def _ci(ci: tuple[float, float]) -> list[float]:
    return [_r(ci[0]), _r(ci[1])]


async def run_site(explore: ExploreService, lat: float, lon: float) -> tuple[BackTest, dict[str, Any]]:
    (inputs, provenance, texture), ndvi = await asyncio.gather(
        explore.inputs(lat, lon), explore.fields.ndvi(lat, lon)
    )
    soil_note = next((p.note for p in provenance if p.dataset.startswith("DEFAULT")), None)
    if soil_note is not None:
        # A site run on the placeholder soil is not the protocol's model, so it gets no result.
        if "has no prediction" in soil_note:
            raise OutOfCoverage(
                "SoilGrids has no complete prediction (mean and 5th/95th percentiles) at this point."
            )
        raise UpstreamUnavailable("SoilGrids did not answer; the site needs its real soil.")
    result = back_test(inputs, ndvi.by_year)
    s = result.stats
    return result, {
        "n": len(result.years),
        "years": [result.years[0], result.years[-1]],
        "soil_texture": texture,
        "awc_mm": inputs.awc_mm_per_m,
        "mean_ndvi": _r(float(result.ndvi.mean())),
        "ndvi_seasons_skipped": ndvi.skipped,
        "model_r": _r(s.r_a),
        "model_ci95": _ci(s.ci_a),
        "baseline_r": _r(s.r_b),
        "baseline_ci95": _ci(s.ci_b),
        "difference": _r(s.r_a - s.r_b),
        "difference_ci95": _ci(s.ci_diff),
        "verdict": verdict(s.ci_diff),
    }


async def main_async() -> int:
    settings = Settings.from_env()
    upstream = Upstream(timeout_s=120.0, retries=5)
    explore = ExploreService(FieldService(settings, upstream, DiskCache(settings.cache_dir)))
    rows: list[dict[str, Any]] = []
    series = []
    try:
        for site_id, name, lat, lon in SITES:
            row: dict[str, Any] = {"id": site_id, "name": name, "lat": lat, "lon": lon}
            try:
                result, stats = await run_site(explore, lat, lon)
            except EngineError as exc:
                row.update(status=exc.code, message=exc.message)
                log.warning("site not computed", extra={"site": site_id, "reason": exc.message})
            else:
                row.update(status="ok", **stats)
                series.append((result.model, result.baseline, result.anomaly))
            rows.append(row)
            log.info("site done", extra={"site": site_id, "status": row["status"]})
    finally:
        await upstream.aclose()
    pooled = None
    if len(series) >= 2:
        p = pooled_paired_bootstrap(series, resamples=RESAMPLES, seed=SEED)
        pooled = {
            "sites": p.sites,
            "mean_model_r": _r(p.mean_r_a),
            "mean_model_r_ci95": _ci(p.ci_a),
            "mean_baseline_r": _r(p.mean_r_b),
            "mean_baseline_r_ci95": _ci(p.ci_b),
            "mean_difference": _r(p.mean_diff),
            "mean_difference_ci95": _ci(p.ci_diff),
            "verdict": verdict(p.ci_diff),
        }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "computed_at": datetime.now(UTC).isoformat(timespec="seconds"),
                "protocol": "docs/VALIDATION.md section 4",
                "record_years": [settings.first_year, settings.last_year],
                "resamples": RESAMPLES,
                "seed": SEED,
                "sites": rows,
                "pooled": pooled,
            },
            indent=1,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    log.info("written", extra={"path": str(OUT)})
    return 0 if all(r["status"] == "ok" for r in rows) else 1


if __name__ == "__main__":
    configure_logging("INFO")
    sys.exit(asyncio.run(main_async()))
