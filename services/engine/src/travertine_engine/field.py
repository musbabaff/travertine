"""Field analysis: climate history from NASA POWER, soil from SoilGrids, greenness from MODIS."""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import asdict, dataclass, replace

from travertine_engine.cache import DiskCache, snapshot_reads
from travertine_engine.config import Settings
from travertine_engine.errors import InvalidRequest, UpstreamUnavailable
from travertine_engine.models import ClimateYear, FieldAnalysis, NdviYear, Provenance, Soil
from travertine_engine.science.climate import DailyClimate, annual_summary, compute_daily_et0
from travertine_engine.science.ndvi import MIN_COMPOSITES, season_mean
from travertine_engine.science.soil import (
    SoilLayer,
    available_water_mm,
    depth_weighted_mean,
    usda_texture_class,
)
from travertine_engine.sources.modis import SEASON_COMPOSITES, fetch_ndvi_seasons
from travertine_engine.sources.power import fetch_power_daily
from travertine_engine.sources.soilgrids import SoilGridsNoData, fetch_soilgrids
from travertine_engine.upstream import Upstream

log = logging.getLogger(__name__)

_FIELD_ID = re.compile(r"^fld_(-?\d{1,2}\.\d{4})_(-?\d{1,3}\.\d{4})$")


def make_field_id(lat: float, lon: float) -> str:
    """Field ids are stateless: they encode the coordinates, so any engine instance can resolve them."""
    return f"fld_{lat:.4f}_{lon:.4f}"


def parse_field_id(field_id: str) -> tuple[float, float]:
    match = _FIELD_ID.match(field_id)
    if not match:
        raise InvalidRequest("Unknown field_id format.", details={"field_id": field_id})
    lat, lon = float(match.group(1)), float(match.group(2))
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise InvalidRequest("field_id encodes coordinates out of range.", details={"field_id": field_id})
    return lat, lon


@dataclass(frozen=True, slots=True)
class SoilResult:
    soil: Soil
    layers: list[SoilLayer]
    provenance: Provenance
    is_default: bool


# Used only when SoilGrids cannot answer. A mid-texture loam (40 % sand, 40 % silt, 20 % clay lies inside the USDA
# loam class), 1 % organic carbon and neutral pH. These are placeholders, not measurements, and the provenance note
# says so.
DEFAULT_LAYERS = [
    SoilLayer(
        top_cm=top, bottom_cm=bottom, sand_pct=40.0, silt_pct=40.0, clay_pct=20.0, soc_g_kg=10.0, ph=7.0
    )
    for top, bottom in ((0, 5), (5, 15), (15, 30), (30, 60), (60, 100))
]


def power_provenance(
    daily: DailyClimate, first: int, last: int, api_version: str, dropped: list[int]
) -> Provenance:
    notes = [
        "Gridded, model-based reanalysis values for the grid cell containing the field, not field measurements: "
        "MERRA-2 meteorology (0.5° × 0.625°) and CERES SYN1deg solar radiation (1° × 1°).",
        "Parameters T2M, T2M_MAX, T2M_MIN, T2MDEW, WS2M, PS, ALLSKY_SFC_SW_DWN, PRECTOTCORR, GWETROOT.",
        "Daily reference evapotranspiration is FAO-56 Penman-Monteith (eq. 6) with actual vapour pressure from the "
        "dew point (eq. 14) and net radiation from eqs. 37–40 using the POWER grid-cell elevation "
        f"({daily.elevation_m:.0f} m); annual ET0 is the sum of daily values.",
        f"Hargreaves (eq. 52) was used on {daily.hargreaves_days} day(s) where Penman-Monteith inputs were missing.",
        "Root-zone wetness is the GWETROOT fraction of saturation from the MERRA-2 land model, not a measured soil "
        "moisture.",
    ]
    if dropped:
        notes.append(f"Years with incomplete daily records were left out: {', '.join(map(str, dropped))}.")
    if daily.source_note:
        notes.append(daily.source_note.strip())
    return Provenance(
        dataset=f"NASA POWER daily point data, Agroclimatology community (API {api_version})",
        provider="NASA Langley Research Center, POWER Project",
        spatial_resolution="0.5° × 0.625° (meteorology), 1° × 1° (solar radiation)",
        temporal_coverage=f"{first}–{last}, daily",
        access_url="https://power.larc.nasa.gov/docs/services/api/temporal/daily/",
        note=" ".join(notes),
    )


def summarise_soil(layers: list[SoilLayer]) -> Soil:
    return Soil(
        texture=usda_texture_class(
            depth_weighted_mean(layers, "sand_pct", 30),
            depth_weighted_mean(layers, "silt_pct", 30),
            depth_weighted_mean(layers, "clay_pct", 30),
        ),
        organic_carbon=round(depth_weighted_mean(layers, "soc_g_kg", 30), 1),
        ph=round(depth_weighted_mean(layers, "ph", 30), 1),
        awc_mm=float(round(available_water_mm(layers, 100))),
    )


SOIL_METHOD = (
    "Texture class (USDA), organic carbon and pH are depth-weighted means of 0–30 cm. Available water capacity is "
    "the 0–100 cm sum of field capacity (−33 kPa) minus wilting point (−1500 kPa) from the Saxton & Rawls (2006) "
    "pedotransfer functions (Soil Sci. Soc. Am. J. 70:1569–1578), with organic matter = 1.724 × organic carbon; "
    "gravel and salinity are not accounted for."
)


async def resolve_soil(upstream: Upstream, cache: DiskCache, lat: float, lon: float) -> SoilResult:
    try:
        with snapshot_reads() as reads:
            profile = await fetch_soilgrids(upstream, cache, lat, lon)
    except (UpstreamUnavailable, SoilGridsNoData) as exc:
        log.warning("soilgrids unavailable, using default soil", extra={"reason": str(exc)})
        reason = "has no prediction at this point" if isinstance(exc, SoilGridsNoData) else "did not respond"
        return SoilResult(
            soil=summarise_soil(DEFAULT_LAYERS),
            layers=DEFAULT_LAYERS,
            is_default=True,
            provenance=Provenance(
                dataset="DEFAULT SOIL — not measured (SoilGrids 2.0 unavailable)",
                provider="Travertine engine default",
                spatial_resolution="None (generic placeholder)",
                temporal_coverage="Not applicable",
                access_url="https://rest.isric.org/soilgrids/v2.0/docs",
                note=(
                    f"SoilGrids {reason}, so these soil values are a generic loam placeholder (40 % sand, 40 % silt, "
                    "20 % clay, 10 g/kg organic carbon, pH 7.0), NOT data for this field. Water-balance results that "
                    "depend on available water capacity are correspondingly uncertain. " + SOIL_METHOD
                ),
            ),
        )
    mean = profile.mean
    clay_lo = depth_weighted_mean(profile.q05, "clay_pct", 30)
    clay_hi = depth_weighted_mean(profile.q95, "clay_pct", 30)
    soc_lo = depth_weighted_mean(profile.q05, "soc_g_kg", 30)
    soc_hi = depth_weighted_mean(profile.q95, "soc_g_kg", 30)
    return SoilResult(
        soil=summarise_soil(mean),
        layers=mean,
        is_default=False,
        provenance=Provenance(
            dataset="SoilGrids 2.0 (clay, sand, silt, soc, phh2o; mean and 5th/95th percentiles)",
            provider="ISRIC — World Soil Information",
            spatial_resolution="250 m",
            temporal_coverage="Static; predictions from soil profiles collected over several decades",
            access_url="https://rest.isric.org/soilgrids/v2.0/docs",
            note=(
                SOIL_METHOD
                + f" SoilGrids 90 % prediction interval for 0–30 cm at this point: clay {clay_lo:.0f}–{clay_hi:.0f} %,"
                f" organic carbon {soc_lo:.1f}–{soc_hi:.1f} g/kg; values derived from the mean prediction carry that"
                " uncertainty." + reads.note("soilgrids")
            ),
        ),
    )


@dataclass(frozen=True, slots=True)
class NdviRecord:
    by_year: dict[int, float]
    skipped: list[int]
    provenance: Provenance


def modis_provenance(first: int, last: int, skipped: list[int], source_note: str = "") -> Provenance:
    note = (
        "Single 250 m pixel containing the field centre; it may include neighbouring fields, roads or buildings. "
        f"Growing-season value = mean NDVI of the {SEASON_COMPOSITES} composites starting day-of-year 97 to 241 "
        "(early April to late September) whose pixel reliability is 0 (good) or 1 (marginal); snow, cloud and fill "
        f"are dropped and a year needs at least {MIN_COMPOSITES} usable composites."
    )
    if skipped:
        note += f" Years without enough usable composites were left out: {', '.join(map(str, skipped))}."
    note += source_note
    return Provenance(
        dataset="MODIS/Terra Vegetation Indices 16-Day L3 Global 250 m (MOD13Q1 v061), NDVI and pixel reliability",
        provider="NASA LP DAAC (Didan 2021, doi:10.5067/MODIS/MOD13Q1.061), served by the ORNL DAAC MODIS web service",
        spatial_resolution="250 m",
        temporal_coverage=f"{first}–{last}, 16-day composites, April–September",
        access_url="https://modis.ornl.gov/data/modis_webservice.html",
        note=note,
    )


class FieldService:
    def __init__(self, settings: Settings, upstream: Upstream, cache: DiskCache) -> None:
        self.settings = settings
        self.upstream = upstream
        self.cache = cache

    async def daily_climate(self, lat: float, lon: float) -> tuple[DailyClimate, str]:
        with snapshot_reads() as reads:
            power = await fetch_power_daily(
                self.upstream, self.cache, lat, lon, self.settings.first_year, self.settings.last_year
            )
        return replace(compute_daily_et0(power), source_note=reads.note("power_daily")), power.api_version

    async def ndvi(self, lat: float, lon: float) -> NdviRecord:
        years = range(self.settings.first_year, self.settings.last_year + 1)
        with snapshot_reads() as reads:
            seasons = await fetch_ndvi_seasons(self.upstream, self.cache, lat, lon, years)
        by_year: dict[int, float] = {}
        skipped: list[int] = []
        for year in years:
            value = season_mean(seasons[year])
            if value is None:
                skipped.append(year)
            else:
                by_year[year] = value
        provenance = modis_provenance(years[0], years[-1], skipped, reads.note("modis_mod13q1"))
        return NdviRecord(by_year, skipped, provenance)

    async def _ndvi_or_none(self, lat: float, lon: float) -> NdviRecord | None:
        try:
            return await self.ndvi(lat, lon)
        except UpstreamUnavailable as exc:
            log.warning("modis unavailable, analysis returned without ndvi", extra={"reason": str(exc)})
            return None

    async def analyze(self, lat: float, lon: float) -> FieldAnalysis:
        (daily, api_version), soil, ndvi = await asyncio.gather(
            self.daily_climate(lat, lon),
            resolve_soil(self.upstream, self.cache, lat, lon),
            self._ndvi_or_none(lat, lon),
        )
        years, dropped = annual_summary(daily)
        first = years[0].year if years else self.settings.first_year
        last = years[-1].year if years else self.settings.last_year
        return FieldAnalysis(
            field_id=make_field_id(lat, lon),
            climate=[ClimateYear(**asdict(y)) for y in years],
            soil=soil.soil,
            ndvi_history=(
                [NdviYear(year=y, mean_ndvi=round(v, 3)) for y, v in sorted(ndvi.by_year.items())]
                if ndvi and ndvi.by_year
                else None
            ),
            provenance=[
                power_provenance(daily, first, last, api_version, dropped),
                soil.provenance,
                *([ndvi.provenance] if ndvi and ndvi.by_year else []),
            ],
        )
