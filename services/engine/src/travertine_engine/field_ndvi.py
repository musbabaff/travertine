"""/v1/field/ndvi: field-scale (30 m) NDVI history from HLS."""

from __future__ import annotations

import asyncio
from collections import defaultdict

from travertine_engine import prov_text
from travertine_engine.field import FieldService, NdviRecord
from travertine_engine.models import FieldNdvi, NdviObservation, NdviSeason, Provenance
from travertine_engine.sources.hls import FIRST_YEAR, MAX_SCENE_CLOUD, Observation, fetch_hls
from travertine_engine.text import Language

MIN_SEASON_OBS = 5
SEASON_MONTHS = range(4, 10)


def hls_provenance(first: int, last: int, lang: Language = "en") -> Provenance:
    return Provenance(
        dataset="Harmonized Landsat Sentinel-2 (HLS) v2.0, L30 and S30 surface reflectance and Fmask",
        provider=(
            "NASA LP DAAC (Ju et al. 2025, doi:10.1016/j.rse.2025.114723), served by Microsoft Planetary Computer"
        ),
        spatial_resolution="30 m",
        temporal_coverage=prov_text.hls_coverage(lang, first, last),
        access_url="https://planetarycomputer.microsoft.com/dataset/hls2-l30",
        note=prov_text.hls_note(lang, max_cloud=MAX_SCENE_CLOUD, min_obs=MIN_SEASON_OBS),
    )


def summarise(observations: list[Observation]) -> tuple[list[NdviObservation], list[NdviSeason]]:
    clear: list[NdviObservation] = []
    per_year: dict[int, list[float]] = defaultdict(list)
    scenes: dict[int, int] = defaultdict(int)
    for o in observations:
        scenes[o.day.year] += 1
        value = o.ndvi
        if not o.clear or value is None:
            continue
        clear.append(NdviObservation(date=o.day.isoformat(), ndvi=round(value, 3), sensor=o.sensor))
        if o.day.month in SEASON_MONTHS:
            per_year[o.day.year].append(value)
    seasons = [
        NdviSeason(
            year=y,
            mean_ndvi=round(sum(per_year[y]) / len(per_year[y]), 3)
            if len(per_year[y]) >= MIN_SEASON_OBS
            else None,
            n_clear=len(per_year[y]),
            n_scenes=scenes[y],
        )
        for y in sorted(scenes)
    ]
    return clear, seasons


def modis_comparison(seasons: list[NdviSeason], modis: NdviRecord | None, lang: Language = "en") -> str:
    """How the 30 m season means differ from the 250 m MODIS ones in the years both have."""
    if modis is None:
        return prov_text.modis_unavailable(lang)
    pairs = [
        (s.year, s.mean_ndvi - modis.by_year[s.year])
        for s in seasons
        if s.mean_ndvi is not None and s.year in modis.by_year
    ]
    if not pairs:
        return prov_text.modis_no_overlap(lang)
    diffs = [d for _, d in pairs]
    return prov_text.modis_comparison(
        lang, years=[y for y, _ in pairs], mean=sum(diffs) / len(diffs), lo=min(diffs), hi=max(diffs)
    )


class FieldNdviService:
    def __init__(self, fields: FieldService) -> None:
        self.fields = fields

    async def history(self, lat: float, lon: float, lang: Language = "en") -> FieldNdvi:
        last = self.fields.settings.last_year
        observations, modis = await asyncio.gather(
            fetch_hls(self.fields.upstream, self.fields.cache, lat, lon, last),
            self.fields.ndvi_or_none(lat, lon, lang),
        )
        clear, seasons = summarise(observations)
        return FieldNdvi(
            observations=clear,
            seasons=seasons,
            caveats=[*prov_text.hls_caveats(lang, FIRST_YEAR), modis_comparison(seasons, modis, lang)],
            provenance=[hls_provenance(FIRST_YEAR, last, lang), *([modis.provenance] if modis else [])],
        )
