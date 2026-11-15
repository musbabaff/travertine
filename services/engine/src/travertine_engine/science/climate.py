"""Daily reference ET0 and annual climate summaries from NASA POWER daily data."""

from __future__ import annotations

import calendar
from dataclasses import dataclass

import numpy as np
import pandas as pd

from travertine_engine.science import et0 as fao
from travertine_engine.sources.power import PowerDaily

PM_INPUTS = ("T2M_MAX", "T2M_MIN", "T2MDEW", "WS2M", "ALLSKY_SFC_SW_DWN", "PS")


@dataclass(frozen=True, slots=True)
class DailyClimate:
    """POWER daily series with ET0 added. `et0_method` is 'pm' (Penman-Monteith) or 'hargreaves'."""

    frame: pd.DataFrame
    elevation_m: float
    hargreaves_days: int
    missing_days: int
    snapshot: tuple[str, str] | None = (
        None  # (fetch date, host) when the record came from the bundled snapshot
    )


def compute_daily_et0(power: PowerDaily) -> DailyClimate:
    df = power.frame.copy()
    index = pd.DatetimeIndex(df.index)
    doy = index.day_of_year.to_numpy(dtype=float)
    elevation = power.elevation_m if np.isfinite(power.elevation_m) else 0.0

    pm = fao.penman_monteith_daily(
        tmax_c=df["T2M_MAX"].to_numpy(),
        tmin_c=df["T2M_MIN"].to_numpy(),
        ea_kpa=fao.actual_vapour_pressure_from_dewpoint(df["T2MDEW"].to_numpy()),
        rs=df["ALLSKY_SFC_SW_DWN"].to_numpy(),
        u2=df["WS2M"].to_numpy(),
        lat_deg=power.lat,
        doy=doy,
        elevation_m=elevation,
        pressure_kpa=df["PS"].to_numpy(),
    )
    hg = fao.hargreaves_daily(df["T2M_MAX"].to_numpy(), df["T2M_MIN"].to_numpy(), power.lat, doy)

    pm_ok = df[list(PM_INPUTS)].notna().all(axis=1).to_numpy()
    hg_ok = df[["T2M_MAX", "T2M_MIN"]].notna().all(axis=1).to_numpy()
    df["ET0"] = np.where(pm_ok, pm, np.where(hg_ok, hg, np.nan))
    df["ET0_METHOD"] = np.where(pm_ok, "pm", np.where(hg_ok, "hargreaves", "missing"))
    return DailyClimate(
        frame=df,
        elevation_m=elevation,
        hargreaves_days=int((~pm_ok & hg_ok).sum()),
        missing_days=int((~hg_ok).sum()),
    )


@dataclass(frozen=True, slots=True)
class AnnualClimate:
    year: int
    precipitation_mm: float
    et0_mm: float
    mean_temp_c: float
    root_zone_wetness: float


def annual_summary(daily: DailyClimate) -> tuple[list[AnnualClimate], list[int]]:
    """Calendar-year totals and means. Years with any missing precipitation, ET0 or temperature are dropped and
    returned separately so the caller can report them."""
    df = daily.frame
    out: list[AnnualClimate] = []
    dropped: list[int] = []
    for key, g in df.groupby(pd.DatetimeIndex(df.index).year):
        year = int(str(key))
        days_in_year = 366 if calendar.isleap(year) else 365
        complete = (
            len(g) == days_in_year
            and g["PRECTOTCORR"].notna().all()
            and g["ET0"].notna().all()
            and g["T2M"].notna().all()
            and g["GWETROOT"].notna().all()
        )
        if not complete:
            dropped.append(year)
            continue
        out.append(
            AnnualClimate(
                year=year,
                precipitation_mm=round(float(g["PRECTOTCORR"].sum()), 1),
                et0_mm=round(float(g["ET0"].sum()), 1),
                mean_temp_c=round(float(g["T2M"].mean()), 2),
                root_zone_wetness=round(float(np.clip(g["GWETROOT"].mean(), 0.0, 1.0)), 2),
            )
        )
    return out, dropped
