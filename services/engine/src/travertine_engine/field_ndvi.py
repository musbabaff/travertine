"""/v1/field/ndvi: field-scale (30 m) NDVI history from HLS."""

from __future__ import annotations

import asyncio
from collections import defaultdict

from travertine_engine.field import FieldService, NdviRecord
from travertine_engine.models import FieldNdvi, NdviObservation, NdviSeason, Provenance
from travertine_engine.sources.hls import FIRST_YEAR, MAX_SCENE_CLOUD, Observation, fetch_hls

MIN_SEASON_OBS = 5
SEASON_MONTHS = range(4, 10)


def hls_provenance(first: int, last: int) -> Provenance:
    return Provenance(
        dataset="Harmonized Landsat Sentinel-2 (HLS) v2.0, L30 and S30 surface reflectance and Fmask",
        provider=(
            "NASA LP DAAC (Ju et al. 2025, doi:10.1016/j.rse.2025.114723), served by Microsoft Planetary Computer"
        ),
        spatial_resolution="30 m",
        temporal_coverage=f"{first}–{last}, every 2–3 days before clouds",
        access_url="https://planetarycomputer.microsoft.com/dataset/hls2-l30",
        note=(
            "The 30 m pixel containing the field centre. NDVI = (NIR − red)/(NIR + red) from nadir BRDF-adjusted "
            "reflectance: Landsat 8/9 bands B05 and B04, Sentinel-2 bands B8A and B04, bandpass-adjusted to Landsat "
            "by HLS. An observation is clear when Fmask bits 1–5 (cloud, adjacent to cloud or shadow, cloud shadow, "
            "snow/ice, water) are all 0 and the aerosol level is not high (HLS v2.0 user guide, Table 9). Scenes "
            f"with more than {MAX_SCENE_CLOUD:.0f} % cloud over the tile are not read; overlapping tiles are counted "
            f"once per date. Season = April–September, with a mean only when at least {MIN_SEASON_OBS} observations "
            "are clear."
        ),
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


def modis_comparison(seasons: list[NdviSeason], modis: NdviRecord | None) -> str:
    """How the 30 m season means differ from the 250 m MODIS ones in the years both have."""
    if modis is None:
        return "The MODIS 250 m record could not be read just now, so no comparison with it is given."
    pairs = [
        (s.year, s.mean_ndvi - modis.by_year[s.year])
        for s in seasons
        if s.mean_ndvi is not None and s.year in modis.by_year
    ]
    if not pairs:
        return "No year has a season mean in both this record and the MODIS 250 m record, so they are not compared."
    diffs = [d for _, d in pairs]
    mean = sum(diffs) / len(diffs)
    years = ", ".join(str(y) for y, _ in pairs)
    return (
        f"Compared with the MODIS 250 m season means of the same point in the same years ({years}; n = {len(pairs)}), "
        f"the 30 m means are {mean:+.3f} NDVI on average (per year {min(diffs):+.3f} to {max(diffs):+.3f}). The two "
        "differ in footprint (one 30 m pixel against a 250 m pixel that may mix fields), in sensors and in season "
        "definition (clear April–September observations here; 16-day composites from early April to late "
        "September for MODIS), so a difference is expected and neither is the reference."
    )


class FieldNdviService:
    def __init__(self, fields: FieldService) -> None:
        self.fields = fields

    async def history(self, lat: float, lon: float) -> FieldNdvi:
        last = self.fields.settings.last_year
        observations, modis = await asyncio.gather(
            fetch_hls(self.fields.upstream, self.fields.cache, lat, lon, last),
            self.fields.ndvi_or_none(lat, lon),
        )
        clear, seasons = summarise(observations)
        return FieldNdvi(
            observations=clear,
            seasons=seasons,
            caveats=[
                f"Field-scale record starts in {FIRST_YEAR}: the anonymous HLS v2.0 copy on Microsoft Planetary "
                "Computer begins then. The full archive (2013 onwards) needs a NASA Earthdata login.",
                "One 30 m pixel at the field centre; a field edge, track or tree inside that pixel changes the value.",
                "NDVI shows green cover, not yield or crop type; bare soil after harvest and weeds both affect it.",
                modis_comparison(seasons, modis),
            ],
            provenance=[hls_provenance(FIRST_YEAR, last), *([modis.provenance] if modis else [])],
        )
