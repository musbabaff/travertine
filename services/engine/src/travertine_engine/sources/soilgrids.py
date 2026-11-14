"""ISRIC SoilGrids 2.0 point query (https://rest.isric.org/soilgrids/v2.0/docs).

The service is free, rate-limited (ISRIC asks for at most 5 calls per minute) and often slow, so every successful
response is cached on disk.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from travertine_engine.cache import DiskCache, request_url
from travertine_engine.science.soil import SoilLayer
from travertine_engine.upstream import Upstream

SOILGRIDS_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
PROPERTIES = ("clay", "sand", "silt", "soc", "phh2o")
DEPTHS = ("0-5cm", "5-15cm", "15-30cm", "30-60cm", "60-100cm")
VALUES = ("mean", "Q0.05", "Q0.95")


@dataclass(frozen=True, slots=True)
class SoilGridsProfile:
    mean: list[SoilLayer]
    q05: list[SoilLayer]
    q95: list[SoilLayer]


class SoilGridsNoData(Exception):
    """SoilGrids has no prediction here (water, urban, rock or outside the mask)."""


async def fetch_soilgrids(upstream: Upstream, cache: DiskCache, lat: float, lon: float) -> SoilGridsProfile:
    params: list[tuple[str, str]] = [("lon", f"{lon:.4f}"), ("lat", f"{lat:.4f}")]
    params += [("property", p) for p in PROPERTIES]
    params += [("depth", d) for d in DEPTHS]
    params += [("value", v) for v in VALUES]
    # 250 m grid: three decimals (~110 m) keeps one cache entry per pixel or finer.
    key = cache.key("soilgrids", lat, lon, {"p": PROPERTIES, "d": DEPTHS, "v": VALUES}, places=3)
    raw = cache.get(key)
    if raw is None:
        raw = await upstream.get_json("ISRIC SoilGrids", SOILGRIDS_URL, params)
        cache.put(key, raw, url=request_url(SOILGRIDS_URL, params))
    return parse_soilgrids(raw)


def parse_soilgrids(raw: dict[str, Any]) -> SoilGridsProfile:
    values: dict[str, dict[str, dict[str, float]]] = {}
    tops: dict[str, tuple[float, float]] = {}
    for layer in raw["properties"]["layers"]:
        factor = float(layer["unit_measure"]["d_factor"])
        for depth in layer["depths"]:
            label = depth["label"]
            tops[label] = (float(depth["range"]["top_depth"]), float(depth["range"]["bottom_depth"]))
            for stat, v in depth["values"].items():
                if v is None:
                    raise SoilGridsNoData(f"{layer['name']} {label} {stat} is null")
                values.setdefault(stat, {}).setdefault(label, {})[layer["name"]] = float(v) / factor

    def layers(stat: str) -> list[SoilLayer]:
        out = []
        for label in DEPTHS:
            v = values[stat][label]
            out.append(
                SoilLayer(
                    top_cm=tops[label][0],
                    bottom_cm=tops[label][1],
                    sand_pct=v["sand"],
                    silt_pct=v["silt"],
                    clay_pct=v["clay"],
                    soc_g_kg=v["soc"],
                    ph=v["phh2o"],
                )
            )
        return out

    try:
        return SoilGridsProfile(mean=layers("mean"), q05=layers("Q0.05"), q95=layers("Q0.95"))
    except KeyError as exc:
        raise SoilGridsNoData(f"missing {exc}") from exc
