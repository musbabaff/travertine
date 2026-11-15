"""/v1/rotations/explore: rank rotations for a field under the user's priorities."""

from __future__ import annotations

import asyncio
import logging
import time
from collections import OrderedDict
from dataclasses import dataclass
from functools import lru_cache

import numpy as np

from travertine_engine import text
from travertine_engine.errors import InvalidRequest
from travertine_engine.field import FieldService, parse_field_id, power_provenance, resolve_soil
from travertine_engine.models import (
    Priorities,
    Provenance,
    Rotation,
    RotationExploreRequest,
    RotationExploreResponse,
    RotationScores,
    RotationYear,
)
from travertine_engine.science.climate import annual_summary
from travertine_engine.science.crops import CropParams, load_crops
from travertine_engine.science.rotations import (
    Backcast,
    FieldInputs,
    RotationTables,
    SoilIndicators,
    backcast,
    build_tables,
    enumerate_rotations,
    soil_indicators,
)
from travertine_engine.science.soil import OC_TO_OM, depth_weighted_mean, saxton_rawls_water_contents
from travertine_engine.science.water import surface_layer
from travertine_engine.text import crop_name

log = logging.getLogger(__name__)

TOP_N = 10
TABLE_CACHE_SIZE = 16
SCORE_CACHE_SIZE = 48

FAO56_PROVENANCE = Provenance(
    dataset="FAO Irrigation and Drainage Paper No. 56 — Crop evapotranspiration",
    provider="Food and Agriculture Organization of the United Nations",
    spatial_resolution="Not spatial (method and crop coefficients)",
    temporal_coverage="Published 1998",
    access_url="https://www.fao.org/4/x0490e/x0490e00.htm",
    note=(
        "Crop coefficients (Table 12, adjusted for local wind and humidity with eqs. 62 and 65), stage lengths "
        "(Table 11), rooting depth and depletion fraction (Table 22), daily root-zone water balance and water-stress "
        "coefficient Ks (chapter 8, eqs. 84–85) and bare-soil evaporation between crops (chapter 7, eqs. 73–74, "
        "Table 19). Runoff and capillary rise are not modelled."
    ),
)
A3517_PROVENANCE = Provenance(
    dataset="Using Legumes as a Nitrogen Source (UW-Extension A3517)",
    provider="Bundy, Kelling & Ward Good, University of Wisconsin-Extension, 1997",
    spatial_resolution="Not spatial (rotation-study averages, Midwest US)",
    temporal_coverage="Published 1997",
    access_url="https://ipcm.wisc.edu/wp-content/uploads/sites/54/2022/11/Usinglegumes.pdf",
    note=(
        "Legume nitrogen credits to the following crop (alfalfa fair stand 160 and 50 lb N/acre in the first and "
        "second year, soybean 40, pea and dry bean 20, applied to lentil and faba bean as the closest category). Used "
        "only as one of four relative soil-health indicators, not as a fertilizer recommendation for this field."
    ),
)


def scoring_provenance(n_windows: int, first: int, last: int, horizon: int) -> Provenance:
    return Provenance(
        dataset="Travertine rotation back-cast and scoring",
        provider="Travertine engine",
        spatial_resolution="Field point (inputs at the resolutions listed above)",
        temporal_coverage=f"{n_windows} overlapping {horizon}-year windows of agricultural years {first}–{last}",
        access_url="https://github.com/musbabaff/travertine/blob/main/docs/METHODOLOGY.md",
        note=(
            "Each rotation is simulated through every historical window with soil water carried between crops. "
            "Yearly figures are medians across windows. Scores are relative indices between 0 and 1 under the given "
            "priorities, not forecasts. water = median share of crop water demand met by rain and stored soil water; "
            "risk = 1 − (0.5 × 90th-percentile unmet share of a season + 0.5 × its 10th–90th percentile spread); "
            "soil = mean of legume nitrogen credit, family diversity, rooting-depth range and share of the year under "
            "a crop, each scaled to the candidates considered; income = mean water-limited relative "
            "evapotranspiration with every crop valued equally — no price or market data is used."
        ),
    )


@dataclass(frozen=True, slots=True)
class Scored:
    rotations: np.ndarray
    water: np.ndarray
    income: np.ndarray
    soil: np.ndarray
    risk: np.ndarray
    total: np.ndarray
    indicators: list[SoilIndicators]


class ExploreService:
    def __init__(self, fields: FieldService) -> None:
        self.fields = fields
        self._tables: OrderedDict[
            tuple[float, float, bool, tuple[str, ...]], tuple[RotationTables, FieldInputs]
        ] = OrderedDict()
        self._locks: dict[tuple[float, float, bool, tuple[str, ...]], asyncio.Lock] = {}
        self._scores: OrderedDict[tuple[object, ...], CandidateScores] = OrderedDict()
        self._score_locks: dict[tuple[object, ...], asyncio.Lock] = {}
        # One heavy computation at a time: on a 512 MB instance a background warm-up and a user request building
        # scores side by side can run out of memory.
        self._heavy = asyncio.Semaphore(1)

    async def inputs(self, lat: float, lon: float) -> tuple[FieldInputs, list[Provenance], str]:
        (daily, api_version), soil = await asyncio.gather(
            self.fields.daily_climate(lat, lon),
            resolve_soil(self.fields.upstream, self.fields.cache, lat, lon),
        )
        df = daily.frame
        top = [layer for layer in soil.layers if layer.bottom_cm <= 15]
        sand = depth_weighted_mean(top, "sand_pct", 15)
        silt = depth_weighted_mean(top, "silt_pct", 15)
        clay = depth_weighted_mean(top, "clay_pct", 15)
        soc = depth_weighted_mean(top, "soc_g_kg", 15)
        theta_wp, theta_fc = saxton_rawls_water_contents(sand, clay, soc / 10.0 * OC_TO_OM)
        first_day = df.index[0].date()
        inputs = FieldInputs(
            first_day=first_day,
            et0=df["ET0"].to_numpy(dtype=float),
            rain=np.nan_to_num(df["PRECTOTCORR"].to_numpy(dtype=float)),
            tmax=df["T2M_MAX"].to_numpy(dtype=float),
            tdew=df["T2MDEW"].to_numpy(dtype=float),
            u2=df["WS2M"].to_numpy(dtype=float),
            awc_mm_per_m=soil.soil.awc_mm,
            surface=surface_layer(theta_fc, theta_wp, sand, silt, clay),
            texture=soil.soil.texture,
        )
        years, dropped = annual_summary(daily)
        first = years[0].year if years else self.fields.settings.first_year
        last = years[-1].year if years else self.fields.settings.last_year
        provenance = [power_provenance(daily, first, last, api_version, dropped), soil.provenance]
        return inputs, provenance, soil.soil.texture

    async def tables(
        self, lat: float, lon: float, irrigated: bool, crops: tuple[CropParams, ...]
    ) -> tuple[RotationTables, FieldInputs, list[Provenance]]:
        key = (round(lat, 4), round(lon, 4), irrigated, tuple(c.id for c in crops))
        inputs, provenance, _ = await self.inputs(lat, lon)
        cached = self._tables.get(key)
        if cached is not None:
            self._tables.move_to_end(key)
            return cached[0], cached[1], provenance
        lock = self._locks.setdefault(key, asyncio.Lock())
        async with lock:
            cached = self._tables.get(key)
            if cached is None:
                started = time.perf_counter()
                async with self._heavy:
                    tables = await asyncio.to_thread(build_tables, inputs, crops, irrigated=irrigated)
                log.info(
                    "rotation tables built",
                    extra={"elapsed_ms": round((time.perf_counter() - started) * 1000)},
                )
                self._tables[key] = (tables, inputs)
                while len(self._tables) > TABLE_CACHE_SIZE:
                    self._tables.popitem(last=False)
                cached = self._tables[key]
        return cached[0], cached[1], provenance

    async def scores(
        self, lat: float, lon: float, irrigated: bool, crops: tuple[CropParams, ...], horizon: int
    ) -> tuple[RotationTables, FieldInputs, list[Provenance], CandidateScores]:
        """Candidate scores are independent of the priorities, so they are computed once per field, mode, crop set
        and horizon; a request then only weighs them and describes the top ten."""
        tables, inputs, provenance = await self.tables(lat, lon, irrigated, crops)
        key = (round(lat, 4), round(lon, 4), irrigated, tuple(c.id for c in crops), horizon)
        cached = self._scores.get(key)
        if cached is None:
            async with self._score_locks.setdefault(key, asyncio.Lock()):
                cached = self._scores.get(key)
                if cached is None:
                    started = time.perf_counter()
                    async with self._heavy:
                        cached = await asyncio.to_thread(score_candidates, tables, inputs.texture, horizon)
                    log.info(
                        "candidate scores built",
                        extra={
                            "horizon": horizon,
                            "elapsed_ms": round((time.perf_counter() - started) * 1000),
                        },
                    )
                    self._scores[key] = cached
                    while len(self._scores) > SCORE_CACHE_SIZE:
                        self._scores.popitem(last=False)
        self._scores.move_to_end(key)
        return tables, inputs, provenance, cached

    async def warm(self, lat: float, lon: float, horizons: tuple[int, ...] = (3, 4, 5)) -> None:
        """Fill the table and score caches for one field, rain-fed then irrigated, all crops."""
        crops = select_crops(None)
        for irrigated in (False, True):
            for horizon in horizons:
                await self.scores(lat, lon, irrigated, crops, horizon)

    async def explore(self, req: RotationExploreRequest) -> RotationExploreResponse:
        if req.field_id is not None:
            lat, lon = parse_field_id(req.field_id)
        elif req.lat is not None and req.lon is not None:
            lat, lon = req.lat, req.lon
        else:
            raise InvalidRequest("Provide field_id or both lat and lon.")
        crops = select_crops(req.crop_ids)
        tables, inputs, provenance, scores = await self.scores(
            lat, lon, req.irrigated, crops, req.horizon_years
        )
        result = await asyncio.to_thread(rank_scores, tables, scores, req.priorities)
        rotations = describe(tables, result, inputs.texture, req)
        n_windows = len(tables.years) - req.horizon_years + 1
        provenance = [
            *provenance,
            FAO56_PROVENANCE,
            A3517_PROVENANCE,
            scoring_provenance(n_windows, tables.years[0], tables.years[-1], req.horizon_years),
        ]
        return RotationExploreResponse(rotations=rotations, provenance=provenance)


def select_crops(crop_ids: list[str] | None) -> tuple[CropParams, ...]:
    all_crops = load_crops()
    if not crop_ids:
        return all_crops
    known = {c.id: c for c in all_crops}
    unknown = sorted(set(crop_ids) - known.keys())
    if unknown:
        raise InvalidRequest("Unknown crop_ids.", details={"unknown": unknown, "known": sorted(known)})
    chosen = tuple(c for c in all_crops if c.id in set(crop_ids))
    if not any(c.is_legume for c in chosen):
        raise InvalidRequest("crop_ids must include at least one legume; every rotation needs one per cycle.")
    return chosen


def row_percentile(values: np.ndarray, q: float) -> np.ndarray:
    """Per-row percentile ignoring NaN, with numpy's default linear interpolation, without a Python loop."""
    ordered = np.sort(values, axis=1)  # NaN sorts last
    n = np.sum(~np.isnan(values), axis=1)
    pos = (n - 1).clip(min=0) * (q / 100.0)
    lo = np.floor(pos).astype(np.int64)
    hi = np.minimum(lo + 1, (n - 1).clip(min=0))
    rows = np.arange(values.shape[0])
    a, b = ordered[rows, lo], ordered[rows, hi]
    out = a + (b - a) * (pos - lo)
    return np.where(n > 0, out, np.nan)


@lru_cache(maxsize=32)
def candidates(
    crops: tuple[CropParams, ...], horizon: int, texture: str
) -> tuple[np.ndarray, list[SoilIndicators]]:
    seqs = enumerate_rotations(crops, horizon)
    indicators = [soil_indicators([crops[i] for i in seq], texture) for seq in seqs]
    return np.array(seqs, dtype=np.int64).reshape(len(seqs), horizon), indicators


def _scale(values: np.ndarray) -> np.ndarray:
    top = float(values.max()) if values.size else 0.0
    return values / top if top > 0 else np.zeros_like(values)


@dataclass(frozen=True, slots=True)
class Ranked:
    order: np.ndarray
    scored: Scored
    top: np.ndarray  # rotation indices of the returned rotations, best first
    cast: Backcast  # back-cast of the `top` rotations only, in the same order
    window_years: tuple[int, ...]  # first year of every window that is valid for at least one candidate


CHUNK = 1024  # candidates back-cast at once; bounds memory to a few tens of MB whatever the horizon


def _chunk_scores(cast: Backcast) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    ok = cast.window_valid
    n = ok.shape[0]
    demand = cast.etc.sum(axis=2)
    deficit = cast.deficit.sum(axis=2)
    met = np.where(ok, 1.0 - deficit / np.maximum(demand, 1e-9), np.nan)
    water = np.clip(row_percentile(met, 50), 0.0, 1.0)

    unmet = cast.deficit / np.maximum(cast.etc, 1e-9)
    unmet = np.where(ok[:, :, None], unmet, np.nan).reshape(n, -1)
    p10 = row_percentile(unmet, 10)
    p90 = row_percentile(unmet, 90)
    risk = np.clip(1.0 - (0.5 * p90 + 0.5 * (p90 - p10)), 0.0, 1.0)

    rel_et = np.where(ok[:, :, None], cast.eta / np.maximum(cast.etc, 1e-9), np.nan).reshape(n, -1)
    with np.errstate(invalid="ignore"):
        income = np.clip(np.nanmean(rel_et, axis=1), 0.0, 1.0)
    return water, income, risk


@dataclass(frozen=True, slots=True)
class CandidateScores:
    """Everything about the candidates that does not depend on the user's priorities."""

    rotations: np.ndarray
    indicators: list[SoilIndicators]
    water: np.ndarray
    income: np.ndarray
    risk: np.ndarray
    soil: np.ndarray
    window_years: tuple[int, ...]  # first year of every window valid for at least one candidate


def score_candidates(tables: RotationTables, texture: str, horizon: int) -> CandidateScores:
    rot, indicators = candidates(tables.crops, horizon, texture)
    if rot.shape[0] == 0:
        raise InvalidRequest("No rotation satisfies the agronomic rules with these crops and horizon.")
    n = rot.shape[0]
    water, income, risk = np.zeros(n), np.zeros(n), np.zeros(n)
    any_valid = np.zeros(n, dtype=bool)
    windows_used: np.ndarray | None = None
    window_years: tuple[int, ...] = ()
    for lo in range(0, n, CHUNK):
        part = backcast(tables, rot[lo : lo + CHUNK])
        hi = lo + part.etc.shape[0]
        water[lo:hi], income[lo:hi], risk[lo:hi] = _chunk_scores(part)
        any_valid[lo:hi] = part.window_valid.any(axis=1)
        used = part.window_valid.any(axis=0)
        windows_used = used if windows_used is None else windows_used | used
        window_years = part.window_years
    if not any_valid.any() or windows_used is None:
        raise InvalidRequest("The climate record is too short for this horizon.")

    n_credit = _scale(np.array([i.n_credit_kg_ha for i in indicators]))
    families = _scale(np.array([float(i.families) for i in indicators]))
    roots = _scale(np.array([i.root_range_m for i in indicators]))
    cover = _scale(np.array([i.cover_fraction for i in indicators]))
    return CandidateScores(
        rotations=rot,
        indicators=indicators,
        water=water,
        income=income,
        risk=risk,
        soil=(n_credit + families + roots + cover) / 4.0,
        window_years=tuple(y for y, keep in zip(window_years, windows_used, strict=True) if keep),
    )


def rank_scores(tables: RotationTables, c: CandidateScores, priorities: Priorities) -> Ranked:
    weights = np.array([priorities.water, priorities.income, priorities.soil, priorities.risk])
    if weights.sum() == 0:
        weights = np.ones(4)
    stacked = np.vstack([c.water, c.income, c.soil, c.risk])
    total = (weights[:, None] * stacked).sum(axis=0) / weights.sum()
    order = np.lexsort((-c.water, -total))  # ties broken by water score
    top = order[:TOP_N]
    return Ranked(
        order=order,
        scored=Scored(
            rotations=c.rotations,
            water=c.water,
            income=c.income,
            soil=c.soil,
            risk=c.risk,
            total=total,
            indicators=c.indicators,
        ),
        top=top,
        cast=backcast(tables, c.rotations[top]),
        window_years=c.window_years,
    )


def rank(tables: RotationTables, texture: str, horizon: int, priorities: Priorities) -> Ranked:
    return rank_scores(tables, score_candidates(tables, texture, horizon), priorities)


def describe(
    tables: RotationTables, ranked: Ranked, texture: str, req: RotationExploreRequest
) -> list[Rotation]:
    s, cast = ranked.scored, ranked.cast
    out: list[Rotation] = []
    first_years = list(ranked.window_years)
    for k, r in enumerate(ranked.top):
        seq = [tables.crops[i] for i in s.rotations[r]]
        ok = cast.window_valid[k]
        etc = cast.etc[k][ok]
        eta = cast.eta[k][ok]
        deficit = cast.deficit[k][ok]
        stress = 1.0 - eta / np.maximum(etc, 1e-9)
        yearly = [
            RotationYear(
                year_index=k + 1,
                crop_id=seq[k].id,
                water_demand_mm=round(float(np.median(etc[:, k])), 1),
                water_deficit_mm=round(float(np.median(deficit[:, k])), 1),
                stress_index=round(float(np.clip(np.median(stress[:, k]), 0.0, 1.0)), 3),
            )
            for k in range(len(seq))
        ]
        total_demand = np.median(etc.sum(axis=1))
        total_deficit = np.median(deficit.sum(axis=1))
        windows = int(ok.sum())
        span = f"{first_years[0] - 1}/{first_years[0]}–{first_years[-1] + len(seq) - 2}/{first_years[-1] + len(seq) - 1}"
        lang = req.language
        unmet = (deficit / np.maximum(etc, 1e-9)).ravel()
        worst = int(np.argmax(unmet))
        w_window, w_year = divmod(worst, len(seq))
        worst_ag_year = [y for y, keep in zip(cast.window_years, ok, strict=True) if keep][w_window] + w_year
        ind = s.indicators[r]
        legumes = list(dict.fromkeys(crop_name(c.id, c.name, lang) for c in seq if c.is_legume))
        sentences = [
            text.water_summary(
                lang,
                windows=windows,
                years=len(seq),
                span=span,
                demand=float(total_demand),
                deficit=float(total_deficit),
                irrigated=req.irrigated,
            ),
            text.driest_seasons(
                lang,
                p90=float(np.percentile(unmet, 90)),
                crop=crop_name(seq[w_year].id, seq[w_year].name, lang),
                ag_year=worst_ag_year,
                worst=float(unmet[worst]),
                irrigated=req.irrigated,
            ),
            text.nitrogen_credit(lang, legumes=legumes, kg_ha=ind.n_credit_kg_ha)
            if ind.n_credit_kg_ha > 0
            else text.no_nitrogen_credit(
                lang, legumes=legumes, coarse_soil=texture in {"sand", "loamy sand"}
            ),
            text.diversity(
                lang, families=ind.families, root_range_m=ind.root_range_m, cover=ind.cover_fraction
            ),
            text.income_note(lang),
        ]
        out.append(
            Rotation(
                sequence=[c.id for c in seq],
                scores=RotationScores(
                    water=round(float(s.water[r]), 3),
                    income=round(float(s.income[r]), 3),
                    soil=round(float(s.soil[r]), 3),
                    risk=round(float(s.risk[r]), 3),
                    total=round(float(s.total[r]), 3),
                ),
                yearly=yearly,
                explanation=sentences,
            )
        )
    return out
