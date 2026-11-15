"""/v1/rotations/explore: rank rotations for a field under the user's priorities."""

from __future__ import annotations

import asyncio
import logging
import time
from collections import OrderedDict
from dataclasses import dataclass
from functools import lru_cache

import numpy as np

from travertine_engine import reasoning, text
from travertine_engine.errors import InvalidRequest
from travertine_engine.farmer import SoilChoice, choose_soil, crop_weights, other_records
from travertine_engine.field import FieldService, parse_field_id, power_provenance, resolve_soil
from travertine_engine.models import (
    BaselineRotation,
    FarmerInputs,
    FarmerSoil,
    Priorities,
    Provenance,
    Rotation,
    RotationExploreRequest,
    RotationExploreResponse,
    RotationScores,
    RotationYear,
    RuleViolation,
    ScoreDifference,
)
from travertine_engine.reasoning import Facts
from travertine_engine.science.climate import annual_summary
from travertine_engine.science.crops import CropParams, crops_by_id, load_crops
from travertine_engine.science.rotations import (
    Backcast,
    FieldInputs,
    RotationTables,
    SoilIndicators,
    agricultural_years,
    backcast,
    build_tables,
    enumerate_rotations,
    rule_violations,
    soil_indicators,
)
from travertine_engine.science.soil import saxton_rawls_water_contents
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


BASELINE_NOTE = (
    " The baseline is the rotation the user entered as their current one, repeated to fill the horizon if shorter. "
    "It is simulated through the same windows with the same water balance; its soil indicators are divided by the "
    "same candidate maxima (limited to 1) and its total uses the same priorities. It is scored even when it breaks "
    "the rotation rules the candidates obey, and `rule_violations` lists every rule it breaks. `vs_baseline` is an "
    "alternative's score minus the baseline's."
)


def scoring_provenance(
    n_windows: int, first: int, last: int, horizon: int, *, baseline: bool = False
) -> Provenance:
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
            + (BASELINE_NOTE if baseline else "")
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
        self._tables: OrderedDict[tuple[object, ...], tuple[RotationTables, FieldInputs]] = OrderedDict()
        self._locks: dict[tuple[object, ...], asyncio.Lock] = {}
        self._scores: OrderedDict[tuple[object, ...], CandidateScores] = OrderedDict()
        self._score_locks: dict[tuple[object, ...], asyncio.Lock] = {}
        # One heavy computation at a time: on a 512 MB instance a background warm-up and a user request building
        # scores side by side can run out of memory.
        self._heavy = asyncio.Semaphore(1)

    async def inputs(self, lat: float, lon: float) -> tuple[FieldInputs, list[Provenance], str]:
        inputs, provenance, choice = await self.field_inputs(lat, lon, None)
        return inputs, provenance, choice.texture

    async def field_inputs(
        self, lat: float, lon: float, test: FarmerSoil | None
    ) -> tuple[FieldInputs, list[Provenance], SoilChoice]:
        (daily, api_version), soil = await asyncio.gather(
            self.fields.daily_climate(lat, lon),
            resolve_soil(self.fields.upstream, self.fields.cache, lat, lon),
        )
        df = daily.frame
        choice = choose_soil(soil, test)
        theta_wp, theta_fc = saxton_rawls_water_contents(choice.sand, choice.clay, choice.om_pct)
        first_day = df.index[0].date()
        inputs = FieldInputs(
            first_day=first_day,
            et0=df["ET0"].to_numpy(dtype=float),
            rain=np.nan_to_num(df["PRECTOTCORR"].to_numpy(dtype=float)),
            tmax=df["T2M_MAX"].to_numpy(dtype=float),
            tdew=df["T2MDEW"].to_numpy(dtype=float),
            u2=df["WS2M"].to_numpy(dtype=float),
            awc_mm_per_m=choice.awc_mm_per_m,
            surface=surface_layer(theta_fc, theta_wp, choice.sand, choice.silt, choice.clay),
            texture=choice.texture,
        )
        years, dropped = annual_summary(daily)
        first = years[0].year if years else self.fields.settings.first_year
        last = years[-1].year if years else self.fields.settings.last_year
        provenance = [power_provenance(daily, first, last, api_version, dropped), soil.provenance]
        return inputs, provenance, choice

    async def tables(
        self,
        lat: float,
        lon: float,
        irrigated: bool,
        crops: tuple[CropParams, ...],
        test: FarmerSoil | None = None,
        *,
        enforce_rules: bool = True,
        years: tuple[int, ...] | None = None,
    ) -> tuple[RotationTables, FieldInputs, list[Provenance], SoilChoice]:
        inputs, provenance, choice = await self.field_inputs(lat, lon, test)
        key = (
            round(lat, 4),
            round(lon, 4),
            irrigated,
            tuple(c.id for c in crops),
            choice.key,
            enforce_rules,
            years,
        )
        cached = self._tables.get(key)
        if cached is not None:
            self._tables.move_to_end(key)
            return cached[0], cached[1], provenance, choice
        lock = self._locks.setdefault(key, asyncio.Lock())
        async with lock:
            cached = self._tables.get(key)
            if cached is None:
                started = time.perf_counter()
                async with self._heavy:
                    tables = await asyncio.to_thread(
                        build_tables,
                        inputs,
                        crops,
                        irrigated=irrigated,
                        enforce_rules=enforce_rules,
                        years=years,
                    )
                log.info(
                    "rotation tables built",
                    extra={"elapsed_ms": round((time.perf_counter() - started) * 1000)},
                )
                self._tables[key] = (tables, inputs)
                while len(self._tables) > TABLE_CACHE_SIZE:
                    self._tables.popitem(last=False)
                cached = self._tables[key]
        return cached[0], cached[1], provenance, choice

    async def scores(
        self,
        lat: float,
        lon: float,
        irrigated: bool,
        crops: tuple[CropParams, ...],
        horizon: int,
        test: FarmerSoil | None = None,
        weights: np.ndarray | None = None,
    ) -> tuple[RotationTables, FieldInputs, list[Provenance], CandidateScores, SoilChoice]:
        """Candidate scores are independent of the priorities, so they are computed once per field, mode, crop set
        and horizon; a request then only weighs them and describes the top ten."""
        tables, inputs, provenance, choice = await self.tables(lat, lon, irrigated, crops, test)
        values = None if weights is None else tuple(round(float(w), 6) for w in weights)
        key = (
            round(lat, 4),
            round(lon, 4),
            irrigated,
            tuple(c.id for c in crops),
            horizon,
            choice.key,
            values,
        )
        cached = self._scores.get(key)
        if cached is None:
            async with self._score_locks.setdefault(key, asyncio.Lock()):
                cached = self._scores.get(key)
                if cached is None:
                    started = time.perf_counter()
                    async with self._heavy:
                        cached = await asyncio.to_thread(
                            score_candidates, tables, inputs.texture, horizon, weights
                        )
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
        return tables, inputs, provenance, cached, choice

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
        farmer = req.farmer_inputs or FarmerInputs()
        weights = crop_weights(crops, farmer.crop_values)
        tables, inputs, provenance, scores, choice = await self.scores(
            lat, lon, req.irrigated, crops, req.horizon_years, farmer.soil, weights
        )
        current = expand_current(req.current_rotation, req.horizon_years)
        result = await asyncio.to_thread(
            rank_scores, tables, scores, req.priorities, tuple(c.id for c in current) if current else None
        )
        rotations, facts, shares = describe(tables, result, inputs.texture, req)
        baseline, baseline_facts = None, None
        if current:
            baseline, baseline_facts = await self.baseline(lat, lon, req, current, tables, inputs, scores)
            for rotation in rotations:
                rotation.vs_baseline = difference(rotation.scores, baseline.scores)
        ctx = reasoning.Context(
            lang=req.language,
            irrigated=req.irrigated,
            priorities=req.priorities,
            awc=next((r for r in choice.records if r.name == reasoning.AWC_RECORD), None),
            crop_values_given=bool(farmer.crop_values),
            n_ranked=int(result.order.shape[0]),
        )
        for rank, (rotation, f, share) in enumerate(zip(rotations, facts, shares, strict=True), start=1):
            rotation.reasoning = reasoning.build(
                ctx,
                f,
                rotation.scores,
                rank=rank,
                shares=share,
                baseline=baseline_facts,
                baseline_scores=baseline.scores if baseline else None,
            )
        if baseline is not None and baseline_facts is not None:
            baseline.reasoning = reasoning.build(ctx, baseline_facts, baseline.scores)
        n_windows = len(tables.years) - req.horizon_years + 1
        provenance = [
            *provenance,
            FAO56_PROVENANCE,
            A3517_PROVENANCE,
            scoring_provenance(
                n_windows, tables.years[0], tables.years[-1], req.horizon_years, baseline=baseline is not None
            ),
        ]
        records = [*choice.records, *other_records(crops, req.crop_ids, farmer.crop_values, req.irrigated)]
        return RotationExploreResponse(
            rotations=rotations, baseline=baseline, inputs=records, provenance=provenance
        )

    async def baseline(
        self,
        lat: float,
        lon: float,
        req: RotationExploreRequest,
        current: list[CropParams],
        tables: RotationTables,
        inputs: FieldInputs,
        scores: CandidateScores,
    ) -> tuple[BaselineRotation, Facts]:
        """The farmer's current rotation, scored like a candidate over the candidates' agricultural years, with the
        same soil (the farmer's soil test if given) and the same crop values. Its segment table holds only its own
        crops and is built without the rotation rules."""
        farmer = req.farmer_inputs or FarmerInputs()
        weights = None
        if farmer.crop_values:
            unvalued = sorted({c.id for c in current} - set(farmer.crop_values))
            if unvalued:
                raise InvalidRequest(
                    "crop_values has no value for a crop in current_rotation; add the crop to crop_ids and give it "
                    "a value.",
                    details={"missing": unvalued},
                )
            top = max(farmer.crop_values.values())
            weights = np.array([[farmer.crop_values[c.id] / top for c in current]])
        used = {c.id for c in current}
        own = tuple(c for c in load_crops() if c.id in used)
        possible = set(agricultural_years(inputs, own))
        years = tuple(y for y in tables.years if y in possible)
        own_tables, _, _, _ = await self.tables(
            lat, lon, req.irrigated, own, farmer.soil, enforce_rules=False, years=years
        )
        return await asyncio.to_thread(
            describe_baseline,
            own_tables,
            current,
            inputs.texture,
            scores,
            req,
            len(req.current_rotation or []),
            weights,
        )


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


def expand_current(current: list[str] | None, horizon: int) -> list[CropParams]:
    """The farmer's sequence as crops, repeated in order until it fills the horizon. Any crop in the table may
    appear, whatever `crop_ids` says: it is what the field grows today."""
    if not current:
        return []
    known = crops_by_id()
    unknown = sorted(set(current) - known.keys())
    if unknown:
        raise InvalidRequest(
            "Unknown crop ids in current_rotation.", details={"unknown": unknown, "known": sorted(known)}
        )
    if len(current) > horizon:
        raise InvalidRequest(
            "current_rotation is longer than horizon_years.",
            details={"current_rotation_years": len(current), "horizon_years": horizon},
        )
    return [known[current[k % len(current)]] for k in range(horizon)]


def difference(alternative: RotationScores, baseline: RotationScores) -> ScoreDifference:
    """Alternative minus baseline, from the rounded scores both carry so the figures add up for a reader."""
    return ScoreDifference(
        water=round(alternative.water - baseline.water, 3),
        income=round(alternative.income - baseline.income, 3),
        soil=round(alternative.soil - baseline.soil, 3),
        risk=round(alternative.risk - baseline.risk, 3),
        total=round(alternative.total - baseline.total, 3),
    )


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


def _chunk_scores(
    cast: Backcast, weights: np.ndarray | None = None
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """`weights` (rotations × years) scale each crop year's share of demand met by the farmer's value for that crop,
    relative to the most valuable one; without them every crop counts the same."""
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

    rel_et = cast.eta / np.maximum(cast.etc, 1e-9)
    if weights is not None:
        rel_et = rel_et * weights[:, None, :]
    rel_et = np.where(ok[:, :, None], rel_et, np.nan).reshape(n, -1)
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
    # Maxima among the candidates of nitrogen credit, families, rooting-depth range and cover: the soil divisors.
    soil_scale: tuple[float, float, float, float] = (0.0, 0.0, 0.0, 0.0)


def score_candidates(
    tables: RotationTables, texture: str, horizon: int, crop_weights: np.ndarray | None = None
) -> CandidateScores:
    rot, indicators = candidates(tables.crops, horizon, texture)
    if rot.shape[0] == 0:
        raise InvalidRequest("No rotation satisfies the agronomic rules with these crops and horizon.")
    n = rot.shape[0]
    water, income, risk = np.zeros(n), np.zeros(n), np.zeros(n)
    any_valid = np.zeros(n, dtype=bool)
    windows_used: np.ndarray | None = None
    window_years: tuple[int, ...] = ()
    for lo in range(0, n, CHUNK):
        chunk = rot[lo : lo + CHUNK]
        part = backcast(tables, chunk)
        hi = lo + part.etc.shape[0]
        weights = None if crop_weights is None else crop_weights[chunk]
        water[lo:hi], income[lo:hi], risk[lo:hi] = _chunk_scores(part, weights)
        any_valid[lo:hi] = part.window_valid.any(axis=1)
        used = part.window_valid.any(axis=0)
        windows_used = used if windows_used is None else windows_used | used
        window_years = part.window_years
    if not any_valid.any() or windows_used is None:
        raise InvalidRequest("The climate record is too short for this horizon.")

    values = np.array([_indicator_values(i) for i in indicators])
    n_credit, families, roots, cover = (_scale(values[:, k]) for k in range(4))
    tops = values.max(axis=0)
    return CandidateScores(
        rotations=rot,
        indicators=indicators,
        water=water,
        income=income,
        risk=risk,
        soil=(n_credit + families + roots + cover) / 4.0,
        window_years=tuple(y for y, keep in zip(window_years, windows_used, strict=True) if keep),
        soil_scale=(float(tops[0]), float(tops[1]), float(tops[2]), float(tops[3])),
    )


def _indicator_values(ind: SoilIndicators) -> tuple[float, float, float, float]:
    return ind.n_credit_kg_ha, float(ind.families), ind.root_range_m, ind.cover_fraction


def _weights(priorities: Priorities) -> np.ndarray:
    weights = np.array([priorities.water, priorities.income, priorities.soil, priorities.risk])
    return weights if weights.sum() > 0 else np.ones(4)


def rank_scores(
    tables: RotationTables,
    c: CandidateScores,
    priorities: Priorities,
    exclude: tuple[str, ...] | None = None,
) -> Ranked:
    """`exclude` is a crop-id sequence (the farmer's current rotation) left out of the ranking, so the returned
    rotations are alternatives to it."""
    weights = _weights(priorities)
    stacked = np.vstack([c.water, c.income, c.soil, c.risk])
    total = (weights[:, None] * stacked).sum(axis=0) / weights.sum()
    order = np.lexsort((-c.water, -total))  # ties broken by water score
    if exclude is not None and len(exclude) == c.rotations.shape[1]:
        index = {crop.id: i for i, crop in enumerate(tables.crops)}
        if all(crop_id in index for crop_id in exclude):
            same = (c.rotations == np.array([index[crop_id] for crop_id in exclude])).all(axis=1)
            order = order[~same[order]]
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


def _rounded(water: float, income: float, soil: float, risk: float, total: float) -> RotationScores:
    return RotationScores(
        water=round(water, 3),
        income=round(income, 3),
        soil=round(soil, 3),
        risk=round(risk, 3),
        total=round(total, 3),
    )


def describe_one(
    seq: list[CropParams],
    cast: Backcast,
    k: int,
    first_years: list[int],
    ind: SoilIndicators,
    texture: str,
    req: RotationExploreRequest,
) -> tuple[list[RotationYear], list[str], Facts]:
    """Yearly medians, explanation sentences and the facts behind them for rotation `k` of a back-cast."""
    ok = cast.window_valid[k]
    etc = cast.etc[k][ok]
    eta = cast.eta[k][ok]
    deficit = cast.deficit[k][ok]
    stress = 1.0 - eta / np.maximum(etc, 1e-9)
    yearly = [
        RotationYear(
            year_index=j + 1,
            crop_id=seq[j].id,
            water_demand_mm=round(float(np.median(etc[:, j])), 1),
            water_deficit_mm=round(float(np.median(deficit[:, j])), 1),
            stress_index=round(float(np.clip(np.median(stress[:, j]), 0.0, 1.0)), 3),
        )
        for j in range(len(seq))
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
    ]
    if ind.n_credit_kg_ha > 0:
        sentences.append(text.nitrogen_credit(lang, legumes=legumes, kg_ha=ind.n_credit_kg_ha))
    elif legumes:  # a sequence without any legume says so in its rule violations instead
        sentences.append(
            text.no_nitrogen_credit(lang, legumes=legumes, coarse_soil=texture in {"sand", "loamy sand"})
        )
    sentences.append(
        text.diversity(lang, families=ind.families, root_range_m=ind.root_range_m, cover=ind.cover_fraction)
    )
    sentences.append(
        text.income_note(lang, weighted=bool(req.farmer_inputs and req.farmer_inputs.crop_values))
    )
    facts = Facts(
        seq=seq,
        yearly=yearly,
        windows=windows,
        demand_mm=float(total_demand),
        deficit_mm=float(total_deficit),
        worst_crop=seq[w_year],
        worst_ag_year=worst_ag_year,
        worst_unmet=float(unmet[worst]),
        indicators=ind,
    )
    return yearly, sentences, facts


def describe(
    tables: RotationTables, ranked: Ranked, texture: str, req: RotationExploreRequest
) -> tuple[list[Rotation], list[Facts], list[dict[str, float]]]:
    """The returned rotations, the facts behind each, and per score the share of ranked rotations scoring lower."""
    s = ranked.scored
    out: list[Rotation] = []
    facts: list[Facts] = []
    shares: list[dict[str, float]] = []
    first_years = list(ranked.window_years)
    ranked_rows = ranked.order
    for k, r in enumerate(ranked.top):
        seq = [tables.crops[i] for i in s.rotations[r]]
        yearly, sentences, f = describe_one(seq, ranked.cast, k, first_years, s.indicators[r], texture, req)
        facts.append(f)
        shares.append(
            {
                name: float(np.mean(values[ranked_rows] < values[r]))
                for name, values in (
                    ("water", s.water),
                    ("income", s.income),
                    ("soil", s.soil),
                    ("risk", s.risk),
                )
            }
        )
        out.append(
            Rotation(
                sequence=[c.id for c in seq],
                scores=_rounded(
                    float(s.water[r]),
                    float(s.income[r]),
                    float(s.soil[r]),
                    float(s.risk[r]),
                    float(s.total[r]),
                ),
                yearly=yearly,
                explanation=sentences,
            )
        )
    return out, facts, shares


def violation_messages(seq: list[CropParams], lang: text.Language) -> list[RuleViolation]:
    out: list[RuleViolation] = []
    for v in rule_violations(seq):
        if v.rule == "same_family_in_consecutive_years" and v.crop and v.previous and v.year_index:
            message = text.same_family(
                lang,
                year=v.year_index,
                crop=crop_name(v.crop.id, v.crop.name, lang),
                previous=crop_name(v.previous.id, v.previous.name, lang),
                family=v.crop.family,
            )
        elif v.rule == "perennial_single_year" and v.crop and v.year_index:
            message = text.perennial_single_year(
                lang, year=v.year_index, crop=crop_name(v.crop.id, v.crop.name, lang)
            )
        else:
            message = text.no_legume(lang)
        out.append(
            RuleViolation.model_validate({"rule": v.rule, "year_index": v.year_index, "message": message})
        )
    return out


def describe_baseline(
    tables: RotationTables,
    seq: list[CropParams],
    texture: str,
    candidate_scores: CandidateScores,
    req: RotationExploreRequest,
    entered_years: int,
    weights: np.ndarray | None = None,
) -> tuple[BaselineRotation, Facts]:
    index = {c.id: i for i, c in enumerate(tables.crops)}
    cast = backcast(tables, np.array([[index[c.id] for c in seq]], dtype=np.int64))
    if not cast.window_valid.any():
        raise InvalidRequest("The climate record is too short to score current_rotation over this horizon.")
    water, income, risk = (float(v[0]) for v in _chunk_scores(cast, weights))
    ind = soil_indicators(seq, texture)
    parts = [
        min(value / top, 1.0) if top > 0 else 0.0
        for value, top in zip(_indicator_values(ind), candidate_scores.soil_scale, strict=True)
    ]
    soil = sum(parts) / 4.0
    weights = _weights(req.priorities)
    total = float((weights * np.array([water, income, soil, risk])).sum() / weights.sum())
    first_years = [y for y, keep in zip(cast.window_years, cast.window_valid[0], strict=True) if keep]
    yearly, sentences, facts = describe_one(seq, cast, 0, first_years, ind, texture, req)
    rotation = BaselineRotation(
        sequence=[c.id for c in seq],
        scores=_rounded(water, income, soil, risk, total),
        yearly=yearly,
        explanation=[text.baseline_intro(req.language, entered=entered_years, years=len(seq)), *sentences],
        rule_violations=violation_messages(seq, req.language),
    )
    return rotation, facts
