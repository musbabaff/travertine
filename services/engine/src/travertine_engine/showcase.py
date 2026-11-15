"""/v1/showcase: the multi-site validation locations, with their back-test results as computed by
scripts/validate_sites.py. The results file is committed; the engine never recomputes or edits it."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from travertine_engine.config import ENGINE_ROOT
from travertine_engine.field import make_field_id
from travertine_engine.models import Showcase, ShowcaseField, ShowcasePooled, ShowcaseValidation
from travertine_engine.validation import verdict_code

RESULTS = ENGINE_ROOT / "data" / "multisite.json"


def _pair(values: list[float] | None) -> tuple[float, float] | None:
    return None if values is None else (values[0], values[1])


def _site(row: dict[str, Any]) -> ShowcaseField:
    if row["status"] == "ok":
        validation = ShowcaseValidation(
            status="ok",
            n=row["n"],
            correlation=row["model_r"],
            correlation_ci95=_pair(row["model_ci95"]),
            baseline_correlation=row["baseline_r"],
            baseline_correlation_ci95=_pair(row["baseline_ci95"]),
            difference=row["difference"],
            difference_ci95=_pair(row["difference_ci95"]),
            verdict=verdict_code(tuple(row["difference_ci95"])),
        )
    else:
        validation = ShowcaseValidation(status="not_computed", reason=row["message"])
    return ShowcaseField(
        id=row["id"],
        name=row["name"],
        lat=row["lat"],
        lon=row["lon"],
        field_id=make_field_id(row["lat"], row["lon"]),
        validation=validation,
    )


@lru_cache(maxsize=1)
def load_showcase(path: Path = RESULTS) -> Showcase:
    data = json.loads(path.read_text(encoding="utf-8"))
    p = data.get("pooled")
    pooled = (
        ShowcasePooled(
            sites=p["sites"],
            mean_correlation=p["mean_model_r"],
            mean_correlation_ci95=_pair(p["mean_model_r_ci95"]),
            mean_baseline_correlation=p["mean_baseline_r"],
            mean_baseline_correlation_ci95=_pair(p["mean_baseline_r_ci95"]),
            mean_difference=p["mean_difference"],
            mean_difference_ci95=_pair(p["mean_difference_ci95"]),
            verdict=verdict_code(tuple(p["mean_difference_ci95"])),
        )
        if p
        else None
    )
    return Showcase(
        fields=[_site(row) for row in data["sites"]],
        pooled=pooled,
        protocol=data["protocol"],
        computed_at=data["computed_at"],
    )
