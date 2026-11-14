"""Reference evapotranspiration after FAO-56 (Allen et al., 1998), chapters 3 and 4.

Equation numbers in the docstrings refer to FAO Irrigation and Drainage Paper 56. All functions accept scalars or
numpy arrays and return the same shape.
"""

from __future__ import annotations

from typing import cast

import numpy as np
import numpy.typing as npt

FloatArray = npt.NDArray[np.float64]
ArrayLike = float | FloatArray

SOLAR_CONSTANT = 0.0820  # MJ m-2 min-1
STEFAN_BOLTZMANN = 4.903e-9  # MJ K-4 m-2 day-1
ALBEDO = 0.23
LAMBDA = 2.45  # MJ kg-1, latent heat of vaporisation used throughout FAO-56
MJ_TO_MM = 1.0 / LAMBDA  # 0.408


def atmospheric_pressure(elevation_m: ArrayLike) -> ArrayLike:
    """Eq. 7, kPa."""
    return cast(ArrayLike, 101.3 * ((293.0 - 0.0065 * np.asarray(elevation_m)) / 293.0) ** 5.26)


def psychrometric_constant(pressure_kpa: ArrayLike) -> ArrayLike:
    """Eq. 8, kPa °C-1."""
    return cast(ArrayLike, 0.665e-3 * np.asarray(pressure_kpa))


def saturation_vapour_pressure(t_c: ArrayLike) -> ArrayLike:
    """Eq. 11, kPa."""
    t = np.asarray(t_c, dtype=float)
    return cast(ArrayLike, 0.6108 * np.exp(17.27 * t / (t + 237.3)))


def mean_saturation_vapour_pressure(tmax_c: ArrayLike, tmin_c: ArrayLike) -> ArrayLike:
    """Eq. 12, kPa."""
    return (saturation_vapour_pressure(tmax_c) + saturation_vapour_pressure(tmin_c)) / 2.0


def svp_slope(tmean_c: ArrayLike) -> ArrayLike:
    """Eq. 13, kPa °C-1."""
    t = np.asarray(tmean_c, dtype=float)
    return cast(ArrayLike, 4098.0 * saturation_vapour_pressure(t) / (t + 237.3) ** 2)


def actual_vapour_pressure_from_dewpoint(tdew_c: ArrayLike) -> ArrayLike:
    """Eq. 14, kPa."""
    return saturation_vapour_pressure(tdew_c)


def actual_vapour_pressure_from_rh(
    tmax_c: ArrayLike, tmin_c: ArrayLike, rh_max: ArrayLike, rh_min: ArrayLike
) -> ArrayLike:
    """Eq. 17, kPa (RH in percent)."""
    return cast(
        ArrayLike,
        (
            saturation_vapour_pressure(tmin_c) * np.asarray(rh_max) / 100.0
            + saturation_vapour_pressure(tmax_c) * np.asarray(rh_min) / 100.0
        )
        / 2.0,
    )


def extraterrestrial_radiation(lat_deg: float, doy: ArrayLike) -> ArrayLike:
    """Eqs. 21–25, MJ m-2 day-1. Valid for |lat| < 66.5° without polar-day handling beyond clipping."""
    phi = np.deg2rad(lat_deg)
    j = np.asarray(doy, dtype=float)
    dr = 1.0 + 0.033 * np.cos(2.0 * np.pi * j / 365.0)
    delta = 0.409 * np.sin(2.0 * np.pi * j / 365.0 - 1.39)
    ws = np.arccos(np.clip(-np.tan(phi) * np.tan(delta), -1.0, 1.0))
    return cast(
        ArrayLike,
        (
            (24.0 * 60.0 / np.pi)
            * SOLAR_CONSTANT
            * dr
            * (ws * np.sin(phi) * np.sin(delta) + np.cos(phi) * np.cos(delta) * np.sin(ws))
        ),
    )


def daylight_hours(lat_deg: float, doy: ArrayLike) -> ArrayLike:
    """Eq. 34, hours."""
    phi = np.deg2rad(lat_deg)
    delta = 0.409 * np.sin(2.0 * np.pi * np.asarray(doy, dtype=float) / 365.0 - 1.39)
    ws = np.arccos(np.clip(-np.tan(phi) * np.tan(delta), -1.0, 1.0))
    return cast(ArrayLike, 24.0 / np.pi * ws)


def clear_sky_radiation(ra: ArrayLike, elevation_m: float) -> ArrayLike:
    """Eq. 37, MJ m-2 day-1."""
    return cast(ArrayLike, (0.75 + 2e-5 * elevation_m) * np.asarray(ra))


def net_longwave_radiation(
    tmax_c: ArrayLike, tmin_c: ArrayLike, ea_kpa: ArrayLike, rs: ArrayLike, rso: ArrayLike
) -> ArrayLike:
    """Eq. 39, MJ m-2 day-1. Rs/Rso is limited to ≤ 1.0 as FAO-56 requires."""
    tmax_k4 = (np.asarray(tmax_c) + 273.16) ** 4
    tmin_k4 = (np.asarray(tmin_c) + 273.16) ** 4
    ratio = np.clip(np.asarray(rs) / np.asarray(rso), 0.0, 1.0)
    return cast(
        ArrayLike,
        (
            STEFAN_BOLTZMANN
            * (tmax_k4 + tmin_k4)
            / 2.0
            * (0.34 - 0.14 * np.sqrt(np.asarray(ea_kpa)))
            * (1.35 * ratio - 0.35)
        ),
    )


def wind_speed_at_2m(uz: ArrayLike, z_m: float) -> ArrayLike:
    """Eq. 47, m s-1."""
    return cast(ArrayLike, np.asarray(uz) * 4.87 / np.log(67.8 * z_m - 5.42))


def penman_monteith_daily(
    *,
    tmax_c: ArrayLike,
    tmin_c: ArrayLike,
    ea_kpa: ArrayLike,
    rs: ArrayLike,
    u2: ArrayLike,
    lat_deg: float,
    doy: ArrayLike,
    elevation_m: float,
    pressure_kpa: ArrayLike | None = None,
) -> ArrayLike:
    """FAO Penman-Monteith reference ET0, eq. 6, mm day-1. Soil heat flux G is 0 for daily steps (eq. 42)."""
    tmax = np.asarray(tmax_c, dtype=float)
    tmin = np.asarray(tmin_c, dtype=float)
    tmean = (tmax + tmin) / 2.0
    pressure = atmospheric_pressure(elevation_m) if pressure_kpa is None else np.asarray(pressure_kpa)
    gamma = psychrometric_constant(pressure)
    delta = svp_slope(tmean)
    es = mean_saturation_vapour_pressure(tmax, tmin)
    ra = extraterrestrial_radiation(lat_deg, doy)
    rso = clear_sky_radiation(ra, elevation_m)
    rns = (1.0 - ALBEDO) * np.asarray(rs)
    rnl = net_longwave_radiation(tmax, tmin, ea_kpa, rs, rso)
    rn = rns - rnl
    wind = np.asarray(u2, dtype=float)
    numerator = 0.408 * delta * rn + gamma * (900.0 / (tmean + 273.0)) * wind * (es - np.asarray(ea_kpa))
    denominator = delta + gamma * (1.0 + 0.34 * wind)
    return cast(ArrayLike, np.maximum(numerator / denominator, 0.0))


def hargreaves_daily(tmax_c: ArrayLike, tmin_c: ArrayLike, lat_deg: float, doy: ArrayLike) -> ArrayLike:
    """Hargreaves ET0, eq. 52, mm day-1. FAO-56 recommends it only when radiation, humidity or wind are missing."""
    tmax = np.asarray(tmax_c, dtype=float)
    tmin = np.asarray(tmin_c, dtype=float)
    tmean = (tmax + tmin) / 2.0
    ra = extraterrestrial_radiation(lat_deg, doy)
    return cast(
        ArrayLike,
        np.maximum(0.0023 * (tmean + 17.8) * np.sqrt(np.maximum(tmax - tmin, 0.0)) * MJ_TO_MM * ra, 0.0),
    )
