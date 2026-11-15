"""/v1/validation: back-test of the engine's water-stress model against MODIS NDVI anomalies.

The protocol is fixed in docs/VALIDATION.md; change it there first, never to improve a result."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import date

import numpy as np

from travertine_engine.errors import OutOfCoverage
from travertine_engine.explore import FAO56_PROVENANCE, ExploreService
from travertine_engine.models import Validation, ValidationYear
from travertine_engine.science.crops import CropParams, crops_by_id
from travertine_engine.science.et0 import FloatArray
from travertine_engine.science.ndvi import PairedBootstrap, paired_bootstrap, zscores
from travertine_engine.science.rotations import (
    REFERENCE_ROOT_DEPTH_M,
    FieldInputs,
    agricultural_years,
    build_kc_table,
)
from travertine_engine.science.season import harvest_date, sowing_date
from travertine_engine.science.water import Elements, bare_soil_depletion, simulate

MODEL_CROP = "winter_wheat"
WINDOW_START = (4, 1)
WINDOW_END = (9, 30)
MIN_YEARS = 8
RESAMPLES = 10_000
SEED = 2026


def modelled_stress(inputs: FieldInputs, crop: CropParams) -> dict[int, float]:
    """1 − ΣETa/ΣETc of rain-fed `crop` from 1 April to harvest, each season started on 1 October of the previous
    year from the continuous bare-soil balance. The season is run in two pieces so the April-to-harvest totals can be
    read off the second one; soil water carries over between them."""
    years = [y for y in agricultural_years(inputs, [crop]) if harvest_date(crop, y) >= date(y, *WINDOW_START)]
    if not years:
        return {}
    kc = build_kc_table(inputs, [crop], years)[0]
    bare = bare_soil_depletion(
        inputs.et0, inputs.rain, inputs.awc_mm_per_m * REFERENCE_ROOT_DEPTH_M, inputs.surface
    )
    ny = len(years)
    start = np.array([inputs.index(date(y - 1, 10, 1)) for y in years])
    sow = np.array([inputs.index(sowing_date(crop, y)) for y in years])
    april = np.array([inputs.index(date(y, *WINDOW_START)) for y in years])
    before = april - sow  # crop days before 1 April
    taw = np.full(ny, inputs.awc_mm_per_m * crop.root_depth_m)
    p = np.full(ny, crop.p)
    rows = np.arange(ny)

    first = simulate(
        Elements(
            start=start,
            sow=sow - start,
            length=before,
            kc=kc,
            kc_row=rows,
            taw=taw,
            p=p,
            f0=bare[start],
            de0=np.full(ny, inputs.surface.tew_mm),
        ),
        inputs.et0,
        inputs.rain,
        inputs.surface,
        irrigated=False,
    )
    tail = np.zeros((ny, kc.shape[1]))
    for i, b in enumerate(before):
        tail[i, : kc.shape[1] - b] = kc[i, b:]
    second = simulate(
        Elements(
            start=april,
            sow=np.zeros(ny, dtype=np.int64),
            length=crop.growing_days - before,
            kc=tail,
            kc_row=rows,
            taw=taw,
            p=p,
            f0=first.f_end,
            de0=first.de_end,
        ),
        inputs.et0,
        inputs.rain,
        inputs.surface,
        irrigated=False,
    )
    stress = 1.0 - second.eta / np.maximum(second.etc, 1e-9)
    return {y: float(np.clip(s, 0.0, 1.0)) for y, s in zip(years, stress, strict=True)}


def dryness_index(inputs: FieldInputs, years: list[int]) -> dict[int, float]:
    """Baseline: 1 − ΣP/ΣET0 over 1 April to 30 September."""
    out = {}
    for y in years:
        lo, hi = inputs.index(date(y, *WINDOW_START)), inputs.index(date(y, *WINDOW_END)) + 1
        if lo < 0 or hi > inputs.n_days:
            continue
        out[y] = float(1.0 - inputs.rain[lo:hi].sum() / inputs.et0[lo:hi].sum())
    return out


@dataclass(frozen=True, slots=True)
class BackTest:
    years: list[int]
    model: FloatArray
    baseline: FloatArray
    ndvi: FloatArray
    anomaly: FloatArray
    stats: PairedBootstrap


def back_test(inputs: FieldInputs, ndvi_by_year: dict[int, float]) -> BackTest:
    crop = crops_by_id()[MODEL_CROP]
    model = modelled_stress(inputs, crop)
    baseline = dryness_index(inputs, sorted(model))
    years = sorted(set(model) & set(baseline) & set(ndvi_by_year))
    if len(years) < MIN_YEARS:
        raise OutOfCoverage(
            "Too few years with both a modelled value and a usable NDVI season.",
            details={"years": len(years), "required": MIN_YEARS},
        )
    m = np.array([model[y] for y in years])
    b = np.array([baseline[y] for y in years])
    v = np.array([ndvi_by_year[y] for y in years])
    z = zscores(v)
    return BackTest(years, m, b, v, z, paired_bootstrap(m, b, z, resamples=RESAMPLES, seed=SEED))


def verdict(ci_diff: tuple[float, float]) -> str:
    lo, hi = ci_diff
    if hi < 0:
        return (
            "The model's correlation is more negative than the baseline's, and the difference is established: "
            "its interval lies below 0."
        )
    if lo > 0:
        return (
            "The baseline's correlation is more negative than the model's, and the difference is established: "
            "its interval lies above 0."
        )
    return "A difference between the model and the baseline is not established: the interval of the difference includes 0."


def _ci(ci: tuple[float, float]) -> str:
    return f"{ci[0]:+.2f} to {ci[1]:+.2f}"


METHOD = (
    "Pearson correlation, one value per year, between modelled water stress and the standardised anomaly (z-score, "
    "sample standard deviation) of growing-season MODIS NDVI at the field-centre pixel. Modelled stress is "
    "1 − ΣETa/ΣETc of rain-fed winter wheat (sown 15 November, harvested 12 July) from 1 April to harvest, from the "
    "engine's daily FAO-56 chapter 8 root-zone water balance on NASA POWER precipitation and Penman-Monteith ET0 with "
    "the field's SoilGrids available water capacity. The same comparison is made for a baseline climatic dryness "
    "index, 1 − ΣP/ΣET0 over April–September. 95 % intervals are paired percentile bootstraps over years "
    f"({RESAMPLES:,} resamples, seed {SEED}). Protocol fixed in advance in docs/VALIDATION.md."
)


class ValidationService:
    def __init__(self, explore: ExploreService) -> None:
        self.explore = explore

    async def validate(self, lat: float, lon: float) -> Validation:
        (inputs, provenance, _), ndvi = await asyncio.gather(
            self.explore.inputs(lat, lon), self.explore.fields.ndvi(lat, lon)
        )
        result = await asyncio.to_thread(back_test, inputs, ndvi.by_year)
        s = result.stats
        n = len(result.years)
        caveats = [
            f"Model (winter-wheat water balance): r = {s.r_a:+.2f}, 95 % interval {_ci(s.ci_a)}. "
            f"Baseline (April–September 1 − P/ET0): r = {s.r_b:+.2f}, 95 % interval {_ci(s.ci_b)}. "
            f"Difference model − baseline: {s.r_a - s.r_b:+.2f}, 95 % interval {_ci(s.ci_diff)}. {verdict(s.ci_diff)}",
            "The land use of the pixel is not known. The model assumes rain-fed winter wheat; if the pixel holds an "
            "irrigated or summer crop, orchard, pasture or a mix, its greenness follows other drivers.",
            "Irrigation is not represented: irrigated fields can stay green in dry years, which weakens the relationship.",
            "NDVI is a single 250 m pixel; it may mix several fields and land uses.",
            f"{n} years is a small sample; the correlation is uncertain and shows association, not causation.",
        ]
        if ndvi.skipped:
            caveats.append(
                "Years left out for too few cloud-free NDVI composites: "
                + ", ".join(map(str, ndvi.skipped))
                + "."
            )
        return Validation(
            years=[
                ValidationYear(
                    year=y, modelled_stress=round(float(m), 3), observed_ndvi_anomaly=round(float(z), 2)
                )
                for y, m, z in zip(result.years, result.model, result.anomaly, strict=True)
            ],
            correlation=round(s.r_a, 2),
            n=n,
            method=METHOD,
            caveats=caveats,
            provenance=[*provenance, ndvi.provenance, FAO56_PROVENANCE],
        )
