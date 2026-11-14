"""Daily root-zone soil water balance after FAO-56 chapter 8 (single crop coefficient) with bare-soil evaporation
between crops after FAO-56 chapter 7.

The balance is written for many independent simulations at once (numpy arrays over "elements"), because rotation
scoring needs every crop pair, every historical year and every starting soil-water state.

Conventions (FAO-56 eq. 85, runoff and capillary rise set to zero):
    Dr_i = Dr_{i-1} - P_i - I_i + ET_i + DP_i
Dr is root-zone depletion below field capacity (mm), 0 ≤ Dr ≤ TAW. Water above field capacity drains (DP).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import numpy.typing as npt

from travertine_engine.science.soil import usda_texture_class

FloatArray = npt.NDArray[np.float64]
IntArray = npt.NDArray[np.int64]
BoolArray = npt.NDArray[np.bool_]

KC_MAX_BARE = 1.20  # FAO-56 eq. 72 with crop height 0
EVAPORATION_LAYER_M = 0.10  # FAO-56 Table 19 TEW basis (Ze = 0.10 m)

# FAO-56 Table 19, readily evaporable water (stage 1), midpoint of each range in mm. Texture classes missing from the
# table are mapped to the closest listed class: sandy clay loam → loam, clay loam → silty clay loam, sandy clay → clay.
REW_BY_TEXTURE = {
    "sand": 4.5,
    "loamy sand": 6.0,
    "sandy loam": 8.0,
    "loam": 9.0,
    "silt loam": 9.5,
    "silt": 9.5,
    "silty clay loam": 9.5,
    "silty clay": 10.0,
    "clay": 10.0,
    "sandy clay loam": 9.0,
    "clay loam": 9.5,
    "sandy clay": 10.0,
}


@dataclass(frozen=True, slots=True)
class SurfaceLayer:
    tew_mm: float
    rew_mm: float


def surface_layer(theta_fc: float, theta_wp: float, sand: float, silt: float, clay: float) -> SurfaceLayer:
    """TEW = 1000 (θFC − 0.5 θWP) Ze (FAO-56 eq. 73); REW from Table 19 by texture, limited to below TEW."""
    tew = 1000.0 * (theta_fc - 0.5 * theta_wp) * EVAPORATION_LAYER_M
    rew = REW_BY_TEXTURE[usda_texture_class(sand, silt, clay)]
    return SurfaceLayer(tew_mm=tew, rew_mm=min(rew, tew - 0.01))


def adjusted_p(p_table: FloatArray | float, etc_mm: FloatArray) -> FloatArray:
    """Depletion fraction adjusted for the daily ETc rate, FAO-56 Table 22 footnote: p = p_table + 0.04 (5 − ETc)."""
    return np.clip(np.asarray(p_table) + 0.04 * (5.0 - etc_mm), 0.1, 0.8)


def water_stress_coefficient(dr: FloatArray, taw: FloatArray, raw: FloatArray) -> FloatArray:
    """Ks, FAO-56 eq. 84: 1 while Dr ≤ RAW, then falling linearly to 0 at Dr = TAW."""
    ks = (taw - dr) / np.maximum(taw - raw, 1e-9)
    return np.where(dr <= raw, 1.0, np.clip(ks, 0.0, 1.0))


def evaporation_reduction(de: FloatArray, tew: float, rew: float) -> FloatArray:
    """Kr, FAO-56 eq. 74: 1 in stage 1 (De ≤ REW), then (TEW − De)/(TEW − REW)."""
    return np.where(de <= rew, 1.0, np.clip((tew - de) / (tew - rew), 0.0, 1.0))


@dataclass(frozen=True, slots=True)
class Elements:
    """One row per independent simulation.

    start: index into the daily series of the first simulated day.
    sow: days from `start` to sowing (bare soil before that).
    length: crop season length in days (simulation ends at harvest = start + sow + length).
    kc: Kc curves by day since sowing, shape (curves, max_length); `kc_row` picks one curve per element.
    taw, p: total available water (mm) and table depletion fraction of the crop.
    f0: initial depletion as a fraction of `taw`.
    de0: initial evaporation-layer depletion (mm).
    """

    start: IntArray
    sow: IntArray
    length: IntArray
    kc: FloatArray
    kc_row: IntArray
    taw: FloatArray
    p: FloatArray
    f0: FloatArray
    de0: FloatArray


@dataclass(frozen=True, slots=True)
class Outcome:
    etc: FloatArray  # Σ Kc·ET0 over the season (potential crop ET, mm)
    eta: FloatArray  # Σ Ks·Kc·ET0 over the season (mm)
    irrigation: FloatArray  # Σ irrigation over the season (mm), zero when rain-fed
    rain_season: FloatArray  # Σ precipitation over the season (mm)
    bare_evaporation: FloatArray  # Σ evaporation before sowing (mm)
    drainage: FloatArray  # Σ deep percolation over the whole simulation (mm)
    rain_total: FloatArray  # Σ precipitation over the whole simulation (mm)
    f_end: FloatArray  # depletion fraction at harvest
    dr_start: FloatArray
    dr_end: FloatArray
    de_end: FloatArray


def simulate(
    elements: Elements,
    et0: FloatArray,
    rain: FloatArray,
    surface: SurfaceLayer,
    *,
    irrigated: bool,
) -> Outcome:
    n = elements.start.shape[0]
    total_days = elements.sow + elements.length
    horizon = int(total_days.max()) if n else 0
    taw = elements.taw
    dr = np.clip(elements.f0, 0.0, 1.0) * taw
    dr_start = dr.copy()
    de = np.clip(elements.de0, 0.0, surface.tew_mm)
    zeros = np.zeros(n)
    etc_sum, eta_sum, irr_sum = zeros.copy(), zeros.copy(), zeros.copy()
    rain_season, bare_e, dp_sum, rain_sum = zeros.copy(), zeros.copy(), zeros.copy(), zeros.copy()
    rows = elements.kc_row
    kc_cols = elements.kc.shape[1]

    for t in range(horizon):
        active = t < total_days
        if not active.any():
            break
        idx = np.minimum(elements.start + t, et0.shape[0] - 1)
        e0 = et0[idx]
        p_day = np.where(active, rain[idx], 0.0)
        in_crop = active & (t >= elements.sow)
        bare = active & ~in_crop

        day_of_season = np.clip(t - elements.sow, 0, kc_cols - 1)
        kc = np.where(in_crop, elements.kc[rows, day_of_season], 0.0)
        etc = kc * e0
        raw = adjusted_p(elements.p, etc) * taw
        irrigation = zeros
        if irrigated:
            # Refill to field capacity early in the day once RAW is used up (FAO-56 Example 38 convention).
            irrigation = np.where(in_crop & (dr > raw), dr, 0.0)
            dr = dr - irrigation
        ks = water_stress_coefficient(dr, taw, raw)
        room = taw - np.maximum(dr - p_day, 0.0)  # water left in the root zone after today's rain
        eta = np.minimum(np.where(in_crop, ks * etc, 0.0), room)

        evap = np.where(
            bare, evaporation_reduction(de, surface.tew_mm, surface.rew_mm) * KC_MAX_BARE * e0, 0.0
        )
        layer = surface.tew_mm - np.maximum(de - p_day, 0.0)
        evap = np.minimum(evap, np.minimum(layer, room))

        dr_new = dr - p_day + eta + evap
        drainage = np.maximum(-dr_new, 0.0)
        dr_new = np.maximum(dr_new, 0.0)

        de = np.where(bare, np.clip(de - p_day + evap, 0.0, surface.tew_mm), np.minimum(de, dr_new))
        dr = np.where(active, dr_new, dr)

        etc_sum += etc
        eta_sum += eta
        irr_sum += irrigation
        rain_season += np.where(in_crop, p_day, 0.0)
        bare_e += evap
        dp_sum += drainage
        rain_sum += p_day

    return Outcome(
        etc=etc_sum,
        eta=eta_sum,
        irrigation=irr_sum,
        rain_season=rain_season,
        bare_evaporation=bare_e,
        drainage=dp_sum,
        rain_total=rain_sum,
        f_end=np.where(taw > 0, dr / np.maximum(taw, 1e-9), 0.0),
        dr_start=dr_start,
        dr_end=dr,
        de_end=de,
    )


def bare_soil_depletion(
    et0: FloatArray, rain: FloatArray, taw: float, surface: SurfaceLayer, dr0: float = 0.0
) -> FloatArray:
    """Continuous bare-soil balance over the whole record; returns the depletion fraction at the start of each day.
    Used to set the soil-water state at the start of a rotation."""
    dr, de = dr0, 0.0
    out = np.empty(et0.shape[0])
    for i in range(et0.shape[0]):
        out[i] = dr / taw
        kr = (
            1.0
            if de <= surface.rew_mm
            else max((surface.tew_mm - de) / (surface.tew_mm - surface.rew_mm), 0.0)
        )
        p = float(rain[i])
        room = min(surface.tew_mm - max(de - p, 0.0), taw - max(dr - p, 0.0))
        evap = min(kr * KC_MAX_BARE * float(et0[i]), max(room, 0.0))
        de = min(max(de - p + evap, 0.0), surface.tew_mm)
        dr = max(dr - p + evap, 0.0)
    return out
