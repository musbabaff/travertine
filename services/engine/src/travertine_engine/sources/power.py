"""NASA POWER daily point API (https://power.larc.nasa.gov/docs/services/api/temporal/daily/)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

from travertine_engine.cache import DiskCache
from travertine_engine.errors import OutOfCoverage, UpstreamUnavailable
from travertine_engine.upstream import Upstream

POWER_DAILY_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMETERS = (
    "T2M",
    "T2M_MAX",
    "T2M_MIN",
    "T2MDEW",
    "RH2M",
    "WS2M",
    "PS",
    "ALLSKY_SFC_SW_DWN",
    "PRECTOTCORR",
    "GWETROOT",
    "GWETTOP",
)
FILL_VALUE = -999.0


@dataclass(frozen=True, slots=True)
class PowerDaily:
    lat: float
    lon: float
    elevation_m: float
    frame: pd.DataFrame  # indexed by date, one column per parameter, NaN where POWER has no value
    api_version: str
    sources: list[str]


async def fetch_power_daily(
    upstream: Upstream, cache: DiskCache, lat: float, lon: float, first_year: int, last_year: int
) -> PowerDaily:
    params = {
        "parameters": ",".join(PARAMETERS),
        "community": "AG",
        "latitude": f"{lat:.4f}",
        "longitude": f"{lon:.4f}",
        "start": f"{first_year}0101",
        "end": f"{last_year}1231",
        "format": "JSON",
        "time-standard": "LST",
    }
    key = cache.key(
        "power_daily", lat, lon, {"p": params["parameters"], "y": [first_year, last_year]}, places=3
    )
    raw = cache.get(key)
    if raw is None:
        raw = await upstream.get_json("NASA POWER", POWER_DAILY_URL, params)
        _check(raw)
        cache.put(key, raw)
    return parse_power(raw, lat, lon)


def _check(raw: Any) -> None:
    if not isinstance(raw, dict) or "properties" not in raw:
        messages = raw.get("messages") if isinstance(raw, dict) else None
        raise UpstreamUnavailable(
            "NASA POWER returned an unexpected payload.", details={"messages": messages}
        )


def parse_power(raw: dict[str, Any], lat: float, lon: float) -> PowerDaily:
    parameter = raw["properties"]["parameter"]
    missing = [p for p in PARAMETERS if p not in parameter]
    if missing:
        raise UpstreamUnavailable("NASA POWER response is missing parameters.", details={"missing": missing})
    frame = pd.DataFrame({name: pd.Series(parameter[name], dtype="float64") for name in PARAMETERS})
    frame.index = pd.to_datetime(frame.index, format="%Y%m%d")
    frame = frame.sort_index().replace(FILL_VALUE, np.nan)
    if frame["T2M"].notna().sum() == 0:
        raise OutOfCoverage("NASA POWER has no data at this location.", details={"lat": lat, "lon": lon})
    coords = raw.get("geometry", {}).get("coordinates", [lon, lat, float("nan")])
    elevation = float(coords[2]) if len(coords) > 2 and coords[2] is not None else float("nan")
    header = raw.get("header", {})
    return PowerDaily(
        lat=lat,
        lon=lon,
        elevation_m=elevation,
        frame=frame,
        api_version=str(header.get("api", {}).get("version", "unknown")),
        sources=[str(s) for s in header.get("sources", [])],
    )
