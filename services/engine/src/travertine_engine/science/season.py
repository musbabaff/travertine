"""Crop calendar and crop coefficient curves (FAO-56 chapter 6)."""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np

from travertine_engine.science.crops import CropParams
from travertine_engine.science.et0 import FloatArray


def sowing_date(crop: CropParams, ag_year: int) -> date:
    """Agricultural year Y runs 1 October Y−1 to 30 September Y; autumn sowings fall in the first calendar year."""
    year = ag_year - 1 if crop.sowing_month >= 10 else ag_year
    return date(year, crop.sowing_month, crop.sowing_day)


def harvest_date(crop: CropParams, ag_year: int) -> date:
    """Last day of the season."""
    return sowing_date(crop, ag_year) + timedelta(days=crop.growing_days - 1)


def climate_adjusted_kc(kc_table: float, u2: float, rh_min: float, height_m: float) -> float:
    """FAO-56 eq. 62 (Kc mid) and eq. 65 (Kc end): adjustment for wind and minimum humidity away from the sub-humid
    reference (u2 = 2 m/s, RHmin = 45 %). Inputs are limited to the ranges FAO-56 gives (1–6 m/s, 20–80 %)."""
    u = min(max(u2, 1.0), 6.0)
    rh = min(max(rh_min, 20.0), 80.0)
    return float(kc_table + (0.04 * (u - 2.0) - 0.004 * (rh - 45.0)) * (height_m / 3.0) ** 0.3)


def rh_min_percent(tdew_c: FloatArray, tmax_c: FloatArray) -> FloatArray:
    """FAO-56 eq. 63: RHmin = 100 e°(Tdew) / e°(Tmax)."""

    def e0(t: FloatArray) -> FloatArray:
        return np.asarray(0.6108 * np.exp(17.27 * t / (t + 237.3)), dtype=float)

    return np.asarray(100.0 * e0(tdew_c) / e0(tmax_c), dtype=float)


def kc_curve(crop: CropParams, kc_mid: float, kc_end: float) -> FloatArray:
    """Daily Kc from sowing to harvest: flat initial stage, linear development, flat mid-season, linear late season
    (FAO-56 Fig. 25 and eq. 66)."""
    s = crop.stages
    ini = np.full(s.ini, crop.kc.ini)
    dev = crop.kc.ini + (kc_mid - crop.kc.ini) * (np.arange(1, s.dev + 1) / s.dev)
    mid = np.full(s.mid, kc_mid)
    late = kc_mid + (kc_end - kc_mid) * (np.arange(1, s.late + 1) / s.late) if s.late else np.empty(0)
    return np.concatenate([ini, dev, mid, late]).astype(float)


def adjusted_kc_values(
    crop: CropParams, mid_u2: float, mid_rhmin: float, late_u2: float, late_rhmin: float
) -> tuple[float, float]:
    kc_mid = climate_adjusted_kc(crop.kc.mid, mid_u2, mid_rhmin, crop.height_m)
    kc_end = crop.kc.end
    if crop.kc.end >= 0.45:  # FAO-56: eq. 65 applies only when Kc end ≥ 0.45
        kc_end = climate_adjusted_kc(crop.kc.end, late_u2, late_rhmin, crop.height_m)
    return kc_mid, kc_end
