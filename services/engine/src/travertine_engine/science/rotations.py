"""Rotation enumeration, historical back-casting and scoring.

Each candidate rotation is run through every historical window of consecutive agricultural years in the record. The
soil-water state is carried from one crop to the next, so a crop that leaves the profile dry hands that dryness to its
successor. To keep this fast, every (previous crop, crop, year) segment is simulated once for a grid of starting
depletion fractions and rotations interpolate along that grid.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from itertools import pairwise

import numpy as np
import numpy.typing as npt

from travertine_engine.science.crops import CropParams
from travertine_engine.science.season import (
    adjusted_kc_values,
    harvest_date,
    kc_curve,
    rh_min_percent,
    sowing_date,
)
from travertine_engine.science.water import (
    Elements,
    FloatArray,
    IntArray,
    SurfaceLayer,
    bare_soil_depletion,
    simulate,
)

BoolArray = npt.NDArray[np.bool_]
DEPLETION_GRID = np.linspace(0.0, 1.0, 11)
SPIN_UP_DAYS = 270  # bare-soil balance starts at field capacity on the first day of the record
REFERENCE_ROOT_DEPTH_M = 1.0
COARSE_TEXTURES = {"sand", "loamy sand"}


@dataclass(frozen=True, slots=True)
class FieldInputs:
    first_day: date
    et0: FloatArray
    rain: FloatArray
    tmax: FloatArray
    tdew: FloatArray
    u2: FloatArray
    awc_mm_per_m: float
    surface: SurfaceLayer
    texture: str

    @property
    def n_days(self) -> int:
        return int(self.et0.shape[0])

    def index(self, d: date) -> int:
        return (d - self.first_day).days


@dataclass(frozen=True, slots=True)
class SegmentTable:
    """Outcomes indexed [crop, year] (start) or [prev, crop, year, grid] (pair)."""

    etc: FloatArray
    eta: FloatArray
    irrigation: FloatArray
    f_end: FloatArray
    valid: BoolArray


@dataclass(frozen=True, slots=True)
class RotationTables:
    crops: tuple[CropParams, ...]
    years: tuple[int, ...]  # agricultural years, labelled by the calendar year in which they end
    irrigated: bool
    start: SegmentTable
    pair: SegmentTable


def compatible(prev: CropParams, crop: CropParams) -> bool:
    """Agronomic rules for consecutive years: no two crops of the same botanical family back to back (a perennial
    stand continuing is the exception), and the next crop is sown after the previous one is harvested."""
    if prev.id == crop.id and crop.season == "perennial":
        return True
    if prev.family == crop.family:
        return False
    return sowing_date(crop, 2010) > harvest_date(prev, 2009)


def valid_sequence(seq: Sequence[CropParams]) -> bool:
    if not any(c.is_legume for c in seq):
        return False
    if any(not compatible(a, b) for a, b in pairwise(seq)):
        return False
    # A perennial stand is established for at least two consecutive years.
    run = 0
    for i, c in enumerate(seq):
        run = (
            run + 1
            if i and c.season == "perennial" and seq[i - 1].id == c.id
            else (1 if c.season == "perennial" else 0)
        )
        next_same = i + 1 < len(seq) and seq[i + 1].id == c.id
        if c.season == "perennial" and run == 1 and not next_same:
            return False
    return True


def enumerate_rotations(crops: Sequence[CropParams], horizon: int) -> list[tuple[int, ...]]:
    """All crop-index sequences of length `horizon` satisfying the rules (one crop per agricultural year, at least
    one legume per cycle)."""
    allowed = {(i, j) for i, a in enumerate(crops) for j, b in enumerate(crops) if compatible(a, b)}
    out: list[tuple[int, ...]] = []
    partial: list[tuple[int, ...]] = [(i,) for i in range(len(crops))]
    for _ in range(horizon - 1):
        partial = [(*p, j) for p in partial for j in range(len(crops)) if (p[-1], j) in allowed]
    for seq in partial:
        if valid_sequence([crops[i] for i in seq]):
            out.append(seq)
    return out


def _stage_means(inputs: FieldInputs, start: int, length: int) -> tuple[float, float]:
    lo, hi = max(start, 0), min(start + length, inputs.n_days)
    if hi <= lo:
        return 2.0, 45.0  # FAO-56 reference conditions: leaves Kc unadjusted
    u2 = float(np.nanmean(inputs.u2[lo:hi]))
    rh = float(np.nanmean(rh_min_percent(inputs.tdew[lo:hi], inputs.tmax[lo:hi])))
    return u2, rh


def build_kc_table(inputs: FieldInputs, crops: Sequence[CropParams], years: Sequence[int]) -> FloatArray:
    max_len = max(c.growing_days for c in crops)
    table = np.zeros((len(crops), len(years), max_len))
    for ci, crop in enumerate(crops):
        s = crop.stages
        for yi, year in enumerate(years):
            sow = inputs.index(sowing_date(crop, year))
            mid = _stage_means(inputs, sow + s.ini + s.dev, s.mid)
            late = _stage_means(inputs, sow + s.ini + s.dev + s.mid, s.late)
            kc_mid, kc_end = adjusted_kc_values(crop, mid[0], mid[1], late[0], late[1])
            curve = kc_curve(crop, kc_mid, kc_end)
            table[ci, yi, : curve.shape[0]] = curve
    return table


def agricultural_years(inputs: FieldInputs, crops: Sequence[CropParams]) -> list[int]:
    """Years Y whose 1 October Y−1 start lies after the spin-up period and whose crops can all be harvested inside
    the record."""
    first = inputs.first_day + timedelta(days=SPIN_UP_DAYS)
    last_day = inputs.first_day + timedelta(days=inputs.n_days - 1)
    years = []
    for y in range(first.year, last_day.year + 2):
        if date(y - 1, 10, 1) < first:
            continue
        if any(harvest_date(c, y) > last_day for c in crops):
            continue
        years.append(y)
    return years


def build_tables(inputs: FieldInputs, crops: Sequence[CropParams], *, irrigated: bool) -> RotationTables:
    crops = tuple(crops)
    years = agricultural_years(inputs, crops)
    nc, ny, ng = len(crops), len(years), DEPLETION_GRID.shape[0]
    kc_table = build_kc_table(inputs, crops, years).reshape(nc * ny, -1)
    taw = np.array([inputs.awc_mm_per_m * c.root_depth_m for c in crops])
    p_tab = np.array([c.p for c in crops])

    bare = bare_soil_depletion(
        inputs.et0, inputs.rain, inputs.awc_mm_per_m * REFERENCE_ROOT_DEPTH_M, inputs.surface
    )

    # Start segments: 1 October of the first rotation year to the first harvest.
    s_start, s_sow, s_len, s_row, s_crop, s_f0 = [], [], [], [], [], []
    for ci, crop in enumerate(crops):
        for yi, year in enumerate(years):
            start = inputs.index(date(year - 1, 10, 1))
            sow = inputs.index(sowing_date(crop, year))
            s_start.append(start)
            s_sow.append(max(sow - start, 0))
            s_len.append(crop.growing_days)
            s_row.append(ci * ny + yi)
            s_crop.append(ci)
            s_f0.append(bare[start])
    start_out = _run(inputs, kc_table, s_start, s_sow, s_len, s_row, s_crop, s_f0, taw, p_tab, irrigated)
    start_table = SegmentTable(
        etc=start_out[0].reshape(nc, ny),
        eta=start_out[1].reshape(nc, ny),
        irrigation=start_out[2].reshape(nc, ny),
        f_end=start_out[3].reshape(nc, ny),
        valid=np.ones((nc, ny), dtype=bool),
    )

    # Pair segments: day after the previous harvest to this crop's harvest, for every starting depletion on the grid.
    p_start, p_sow, p_len, p_row, p_crop, p_f0 = [], [], [], [], [], []
    valid = np.zeros((nc, nc, ny, ng), dtype=bool)
    keys: list[tuple[int, int, int]] = []
    for pi, prev in enumerate(crops):
        for ci, crop in enumerate(crops):
            if not compatible(prev, crop):
                continue
            for yi, year in enumerate(years):
                start = inputs.index(harvest_date(prev, year - 1)) + 1
                sow = inputs.index(sowing_date(crop, year))
                if start < 0 or sow < start:
                    continue
                keys.append((pi, ci, yi))
                for f0 in DEPLETION_GRID:
                    p_start.append(start)
                    p_sow.append(sow - start)
                    p_len.append(crop.growing_days)
                    p_row.append(ci * ny + yi)
                    p_crop.append(ci)
                    p_f0.append(float(f0))
    pair_shape = (nc, nc, ny, ng)
    etc = np.zeros(pair_shape)
    eta = np.zeros(pair_shape)
    irr = np.zeros(pair_shape)
    f_end = np.zeros(pair_shape)
    if keys:
        out = _run(inputs, kc_table, p_start, p_sow, p_len, p_row, p_crop, p_f0, taw, p_tab, irrigated)
        k = np.array(keys)
        for arr, src in ((etc, out[0]), (eta, out[1]), (irr, out[2]), (f_end, out[3])):
            arr[k[:, 0], k[:, 1], k[:, 2], :] = src.reshape(len(keys), ng)
        valid[k[:, 0], k[:, 1], k[:, 2], :] = True
    return RotationTables(
        crops=crops,
        years=tuple(years),
        irrigated=irrigated,
        start=start_table,
        pair=SegmentTable(etc=etc, eta=eta, irrigation=irr, f_end=f_end, valid=valid),
    )


def _run(
    inputs: FieldInputs,
    kc_table: FloatArray,
    start: list[int],
    sow: list[int],
    length: list[int],
    row: list[int],
    crop: list[int],
    f0: list[float],
    taw: FloatArray,
    p_tab: FloatArray,
    irrigated: bool,
) -> tuple[FloatArray, FloatArray, FloatArray, FloatArray]:
    crop_idx = np.array(crop)
    rows = np.array(row)
    f0_arr = np.array(f0)
    elements = Elements(
        start=np.array(start, dtype=np.int64),
        sow=np.array(sow, dtype=np.int64),
        length=np.array(length, dtype=np.int64),
        kc=kc_table,
        kc_row=rows,
        taw=taw[crop_idx],
        p=p_tab[crop_idx],
        f0=f0_arr,
        de0=np.full(rows.shape[0], inputs.surface.tew_mm),
    )
    out = simulate(elements, inputs.et0, inputs.rain, inputs.surface, irrigated=irrigated)
    return out.etc, out.eta, out.irrigation, out.f_end


@dataclass(frozen=True, slots=True)
class Backcast:
    """Per rotation (R), window (W) and rotation year (H)."""

    etc: FloatArray
    eta: FloatArray
    irrigation: FloatArray
    window_valid: BoolArray
    window_years: tuple[int, ...]  # first agricultural year of each window
    irrigated: bool = False

    @property
    def deficit(self) -> FloatArray:
        return self.irrigation if self.irrigated else np.maximum(self.etc - self.eta, 0.0)


def _interp(table: FloatArray, idx: tuple[IntArray, IntArray, IntArray], f: FloatArray) -> FloatArray:
    pos = np.clip(f, 0.0, 1.0) * (DEPLETION_GRID.shape[0] - 1)
    lo = np.minimum(np.floor(pos).astype(np.int64), DEPLETION_GRID.shape[0] - 2)
    w = pos - lo
    a = table[idx[0], idx[1], idx[2], lo]
    b = table[idx[0], idx[1], idx[2], lo + 1]
    return np.asarray(a * (1.0 - w) + b * w, dtype=float)


def backcast(tables: RotationTables, rotations: IntArray) -> Backcast:
    r, h = rotations.shape
    ny = len(tables.years)
    w = ny - h + 1
    if w <= 0:
        raise ValueError("record too short for this horizon")
    y0 = np.arange(w)
    shape = (r, w, h)
    etc, eta, irr = np.zeros(shape), np.zeros(shape), np.zeros(shape)
    ok = np.ones((r, w), dtype=bool)

    c0 = rotations[:, 0][:, None]
    etc[:, :, 0] = tables.start.etc[c0, y0[None, :]]
    eta[:, :, 0] = tables.start.eta[c0, y0[None, :]]
    irr[:, :, 0] = tables.start.irrigation[c0, y0[None, :]]
    f = tables.start.f_end[c0, y0[None, :]]
    for k in range(1, h):
        pc = np.broadcast_to(rotations[:, k - 1][:, None], (r, w))
        cc = np.broadcast_to(rotations[:, k][:, None], (r, w))
        yy = np.broadcast_to((y0 + k)[None, :], (r, w))
        idx = (pc, cc, yy)
        ok &= tables.pair.valid[pc, cc, yy, 0]
        etc[:, :, k] = _interp(tables.pair.etc, idx, f)
        eta[:, :, k] = _interp(tables.pair.eta, idx, f)
        irr[:, :, k] = _interp(tables.pair.irrigation, idx, f)
        f = _interp(tables.pair.f_end, idx, f)
    return Backcast(
        etc=etc,
        eta=eta,
        irrigation=irr,
        window_valid=ok,
        window_years=tuple(tables.years[i] for i in y0),
        irrigated=tables.irrigated,
    )


@dataclass(frozen=True, slots=True)
class SoilIndicators:
    n_credit_kg_ha: float
    families: int
    root_range_m: float
    cover_fraction: float


def soil_indicators(seq: Sequence[CropParams], texture: str) -> SoilIndicators:
    coarse = texture in COARSE_TEXTURES
    credit = 0.0
    for k in range(1, len(seq)):
        crop = seq[k]
        if crop.is_legume:
            continue
        prev = seq[k - 1]
        if prev.n_credit is not None:
            first = prev.n_credit.first_year_kg_ha
            if coarse:  # A3517: alfalfa credit reduced by 50 lb N/acre, no soybean or pulse credit on sands
                first = max(first - 56.0, 0.0) if prev.season == "perennial" else 0.0
            credit += first
        if k >= 2:
            older = seq[k - 2]
            second = older.n_credit.second_year_kg_ha if older.n_credit is not None else 0.0
            if second and not coarse and prev.id != older.id:
                credit += second
    depths = [c.root_depth_m for c in seq]
    cover_days = sum(c.growing_days for c in seq)
    return SoilIndicators(
        n_credit_kg_ha=credit,
        families=len({c.family for c in seq}),
        root_range_m=max(depths) - min(depths),
        cover_fraction=min(cover_days / (365.25 * len(seq)), 1.0),
    )
