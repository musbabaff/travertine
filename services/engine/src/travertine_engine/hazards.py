"""Climate hazards (GET /v1/field/hazards) and the crop calendar of a sequence (POST /v1/field/calendar), both from
the NASA POWER daily record the rest of the engine uses.

Index definitions follow the ETCCDI climate change indices (Zhang, X. et al. 2011, Indices for monitoring changes in
extremes based on daily temperature and precipitation data, WIREs Climate Change 2:851–870,
doi:10.1002/wcc.147; definitions at https://etccdi.pacificclimate.org/list_27_indices.shtml). TX90p is simplified:
the threshold is the 90th percentile of daily maximum temperature per calendar month of this record, not per
calendar day of a 1961–1990 base period.
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd

from travertine_engine import prov_text, text
from travertine_engine.errors import InvalidRequest
from travertine_engine.field import FieldService, power_provenance
from travertine_engine.models import (
    BarePeriod,
    CalendarMonth,
    CalendarSeason,
    FieldCalendar,
    FieldCalendarRequest,
    FieldHazards,
    HazardYear,
    MostVulnerable,
    Provenance,
)
from travertine_engine.science.climate import annual_summary
from travertine_engine.science.crops import crops_by_id
from travertine_engine.science.season import harvest_date, kc_curve, sowing_date
from travertine_engine.text import Language

FROST_C = 0.0  # ETCCDI FD: TN < 0 °C
SUMMER_C = 25.0  # ETCCDI SU: TX > 25 °C
DRY_MM = 1.0  # ETCCDI CDD: RR < 1 mm
SPRING_END = (
    8,
    1,
)  # last spring frost before 1 August, first autumn frost from 1 August (northern hemisphere)


def etccdi_provenance(lang: Language = "en") -> Provenance:
    return Provenance(
        dataset="ETCCDI climate change indices (definitions)",
        provider="Expert Team on Climate Change Detection and Indices (WMO CCl / WCRP / JCOMM)",
        spatial_resolution=prov_text.not_spatial(lang, "index definitions", "endeks tanımları"),
        temporal_coverage=prov_text.etccdi_coverage(lang),
        access_url="https://etccdi.pacificclimate.org/list_27_indices.shtml",
        note=prov_text.etccdi_note(lang),
    )


ETCCDI_PROVENANCE = etccdi_provenance()


def _longest_run(mask: np.ndarray) -> int:
    best = run = 0
    for flag in mask:
        run = run + 1 if flag else 0
        best = max(best, run)
    return best


def _warm_threshold(df: pd.DataFrame) -> pd.Series:
    """Per-day threshold: the record's 90th percentile of TX for that day's calendar month."""
    index = pd.DatetimeIndex(df.index)
    p90 = df["T2M_MAX"].groupby(index.month).quantile(0.9)
    return pd.Series(index.month.map(p90.to_dict()).to_numpy(dtype=float), index=index)


def hazard_years(df: pd.DataFrame, years: list[int], northern: bool) -> list[HazardYear]:
    warm = _warm_threshold(df)
    out = []
    index = pd.DatetimeIndex(df.index)
    for y in years:
        g = df[index.year == y]
        tn, tx, rr = g["T2M_MIN"], g["T2M_MAX"], g["PRECTOTCORR"].fillna(0.0)
        frost = tn < FROST_C
        spring, autumn = None, None
        if northern:
            cut = pd.Timestamp(date(y, *SPRING_END))
            before = g.index[frost.to_numpy() & (g.index < cut)]
            after = g.index[frost.to_numpy() & (g.index >= cut)]
            spring = before[-1].date() if len(before) else None
            autumn = after[0].date() if len(after) else None
        out.append(
            HazardYear(
                year=y,
                frost_days=int(frost.sum()),
                last_spring_frost=spring.isoformat() if spring else None,
                first_autumn_frost=autumn.isoformat() if autumn else None,
                frost_free_days=(autumn - spring).days - 1 if spring and autumn else None,
                summer_days=int((tx > SUMMER_C).sum()),
                warm_days=int((tx > warm[g.index]).sum()),
                txx_c=round(float(tx.max()), 1),
                r10mm_days=int((rr >= 10.0).sum()),
                r20mm_days=int((rr >= 20.0).sum()),
                rx1day_mm=round(float(rr.max()), 1),
                cdd_days=_longest_run((rr < DRY_MM).to_numpy()),
            )
        )
    return out


def medians(rows: list[HazardYear]) -> dict[str, float]:
    out: dict[str, float] = {}
    for name in (
        "frost_days",
        "frost_free_days",
        "summer_days",
        "warm_days",
        "txx_c",
        "r10mm_days",
        "r20mm_days",
        "rx1day_mm",
        "cdd_days",
    ):
        values = [getattr(r, name) for r in rows if getattr(r, name) is not None]
        if values:
            out[name] = round(float(np.median(values)), 1)
    for name, key in (
        ("last_spring_frost", "last_spring_frost_doy"),
        ("first_autumn_frost", "first_autumn_frost_doy"),
    ):
        doys = [date.fromisoformat(getattr(r, name)).timetuple().tm_yday for r in rows if getattr(r, name)]
        if doys:
            out[key] = round(float(np.median(doys)), 1)
    return out


class HazardService:
    def __init__(self, fields: FieldService) -> None:
        self.fields = fields

    async def _record(
        self, lat: float, lon: float, lang: Language = "en"
    ) -> tuple[pd.DataFrame, list[int], list[Provenance]]:
        daily, api_version = await self.fields.daily_climate(lat, lon)
        years, dropped = annual_summary(daily)
        if not years:
            raise InvalidRequest("The climate record has no complete year at this point.")
        complete = [y.year for y in years]
        prov = power_provenance(daily, complete[0], complete[-1], api_version, dropped, lang)
        return daily.frame, complete, [prov]

    async def hazards(self, lat: float, lon: float, lang: Language = "en") -> FieldHazards:
        df, years, provenance = await self._record(lat, lon, lang)
        rows = hazard_years(df, years, northern=lat >= 0)
        return FieldHazards(
            years=rows,
            median=medians(rows),
            caveats=prov_text.hazard_caveats(lang, southern=lat < 0),
            provenance=[*provenance, etccdi_provenance(lang)],
        )

    async def calendar(self, req: FieldCalendarRequest) -> FieldCalendar:
        known = crops_by_id()
        unknown = sorted(set(req.sequence) - known.keys())
        if unknown:
            raise InvalidRequest(
                "Unknown crop ids in sequence.", details={"unknown": unknown, "known": sorted(known)}
            )
        seq = [known[c] for c in req.sequence]
        df, years, provenance = await self._record(req.lat, req.lon, req.language)
        warm = (df["T2M_MAX"] > _warm_threshold(df)).to_numpy()
        frost = (df["T2M_MIN"] < FROST_C).to_numpy()
        rain = df["PRECTOTCORR"].fillna(0.0).to_numpy()
        et0 = df["ET0"].to_numpy(dtype=float)
        first_day = df.index[0].date()
        n_days = len(df)
        ag_years = [*years, years[-1] + 1]  # seasons outside the record are skipped below

        seasons, months, worst = [], [], []
        for k, crop in enumerate(seq, start=1):
            sow, har = sowing_date(crop, 2010), harvest_date(crop, 2010)
            seasons.append(
                CalendarSeason(year_index=k, crop_id=crop.id, sowing=f"{sow:%m-%d}", harvest=f"{har:%m-%d}")
            )
            kc = kc_curve(crop, crop.kc.mid, crop.kc.end)
            per_month: dict[int, dict[str, list[float]]] = {}
            for y in ag_years:
                start = (sowing_date(crop, y) - first_day).days
                if start < 0 or start + crop.growing_days > n_days:
                    continue
                idx = np.arange(start, start + crop.growing_days)
                day_months = np.array([(first_day + timedelta(days=int(i))).month for i in idx])
                for m in dict.fromkeys(day_months.tolist()):
                    sel = idx[day_months == m]
                    etc = float((kc[sel - start] * et0[sel]).sum())
                    deficit = max(0.0, 1.0 - float(rain[sel].sum()) / etc) if etc > 0 else 0.0
                    slot = per_month.setdefault(m, {"deficit": [], "frost": [], "warm": []})
                    slot["deficit"].append(deficit)
                    slot["frost"].extend(frost[sel].tolist())
                    slot["warm"].extend(warm[sel].tolist())
            rows = [
                CalendarMonth(
                    year_index=k,
                    crop_id=crop.id,
                    month=m,
                    water_deficit_share=round(float(np.median(v["deficit"])), 3),
                    frost_day_share=round(float(np.mean(v["frost"])), 3),
                    warm_day_share=round(float(np.mean(v["warm"])), 3),
                )
                for m, v in per_month.items()
            ]
            months.extend(rows)
            for hazard, attr in (
                ("water_deficit", "water_deficit_share"),
                ("frost", "frost_day_share"),
                ("warm_days", "warm_day_share"),
            ):
                top = max(rows, key=lambda r: getattr(r, attr), default=None)
                if top is not None and getattr(top, attr) > 0:
                    worst.append(
                        MostVulnerable(
                            year_index=k,
                            crop_id=crop.id,
                            hazard=hazard,
                            month=top.month,
                            share=getattr(top, attr),
                        )
                    )

        bare = []
        for k, crop in enumerate(seq, start=1):
            nxt = seq[k % len(seq)]
            end_prev = harvest_date(crop, 2010)
            start_next = sowing_date(nxt, 2011)
            gap = (start_next - end_prev).days - 1
            if gap > 0:
                bare.append(
                    BarePeriod(
                        after_year_index=k,
                        start=f"{end_prev + timedelta(days=1):%m-%d}",
                        end=f"{start_next - timedelta(days=1):%m-%d}",
                        days=gap,
                    )
                )
        return FieldCalendar(
            seasons=seasons,
            bare_periods=bare,
            months=months,
            most_vulnerable=worst,
            caveats=text.calendar_caveats(req.language, first=years[0], last=years[-1]),
            provenance=[*provenance, etccdi_provenance(req.language)],
        )
