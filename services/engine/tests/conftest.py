from __future__ import annotations

import math
from collections.abc import Iterator
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from travertine_engine.config import Settings
from travertine_engine.errors import UpstreamUnavailable
from travertine_engine.main import create_app
from travertine_engine.sources.power import PARAMETERS
from travertine_engine.upstream import Upstream


def synthetic_power(
    first_year: int, last_year: int, lat: float = 37.89, lon: float = 28.98, varying_rain: bool = False
) -> dict[str, Any]:
    """A POWER-shaped payload with a smooth seasonal cycle. Test input only, never shown to users.
    `varying_rain` scales each year's rain differently so year-to-year statistics are defined."""
    params: dict[str, dict[str, float]] = {p: {} for p in PARAMETERS}
    day = date(first_year, 1, 1)
    while day.year <= last_year:
        k = day.strftime("%Y%m%d")
        s = math.sin(2 * math.pi * (day.timetuple().tm_yday - 105) / 365.0)
        tmean = 15 + 10 * s
        params["T2M"][k] = tmean
        params["T2M_MAX"][k] = tmean + 7
        params["T2M_MIN"][k] = tmean - 7
        params["T2MDEW"][k] = tmean - 8
        params["RH2M"][k] = 55.0
        params["WS2M"][k] = 2.0
        params["PS"][k] = 93.9
        params["ALLSKY_SFC_SW_DWN"][k] = 17 + 9 * s
        wet = 1.0 + 0.8 * math.sin(1.7 * day.year) if varying_rain else 1.0
        params["PRECTOTCORR"][k] = 3.0 * wet if day.day % 5 == 0 and s < 0.3 else 0.0
        params["GWETROOT"][k] = 0.5 - 0.1 * s
        params["GWETTOP"][k] = 0.5 - 0.2 * s
        day += timedelta(days=1)
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lon, lat, 675.9]},
        "properties": {"parameter": params},
        "header": {
            "api": {"version": "v2.test", "name": "POWER Daily API"},
            "sources": ["MERRA2", "SYN1DEG"],
        },
    }


def synthetic_soilgrids() -> dict[str, Any]:
    depths = [
        ("0-5cm", 0, 5),
        ("5-15cm", 5, 15),
        ("15-30cm", 15, 30),
        ("30-60cm", 30, 60),
        ("60-100cm", 60, 100),
    ]
    spec = {  # name: (d_factor, mean, q05, q95) in mapped units
        "clay": (10, 320, 50, 800),
        "sand": (10, 300, 50, 600),
        "silt": (10, 380, 50, 800),
        "soc": (10, 150, 20, 400),
        "phh2o": (10, 68, 50, 84),
    }
    layers = [
        {
            "name": name,
            "unit_measure": {"d_factor": f},
            "depths": [
                {
                    "range": {"top_depth": t, "bottom_depth": b, "unit_depth": "cm"},
                    "label": label,
                    "values": {"mean": m, "Q0.05": lo, "Q0.95": hi},
                }
                for label, t, b in depths
            ],
        }
        for name, (f, m, lo, hi) in spec.items()
    ]
    return {"type": "Feature", "properties": {"layers": layers}}


def synthetic_modis(params: dict[str, Any], cloudy_year: int | None = None) -> dict[str, Any]:
    """ORNL MODIS subset payload for one band and one season; greener in wetter synthetic years."""
    year = int(str(params["startDate"])[1:5])
    first, last = int(str(params["startDate"])[5:]), int(str(params["endDate"])[5:])
    ndvi = 0.30 + 0.05 * math.sin(1.7 * year)
    subset = []
    for doy in range(first, last + 1, 16):
        cloud_flag = 3 if year == cloudy_year else 0
        value = round(ndvi * 10000) if params["band"].endswith("NDVI") else cloud_flag
        subset.append({"modis_date": f"A{year}{doy:03d}", "data": [value]})
    return {"band": params["band"], "subset": subset}


class FakeUpstream(Upstream):
    def __init__(
        self,
        *,
        soil_fails: bool = False,
        power_fails: bool = False,
        modis_fails: bool = False,
        varying_rain: bool = False,
        cloudy_year: int | None = None,
    ) -> None:
        super().__init__(timeout_s=1, retries=0)
        self.soil_fails = soil_fails
        self.power_fails = power_fails
        self.modis_fails = modis_fails
        self.varying_rain = varying_rain
        self.cloudy_year = cloudy_year
        self.calls: list[str] = []

    async def get_json(self, source: str, url: str, params: Any = None) -> Any:
        self.calls.append(source)
        if source == "NASA POWER":
            if self.power_fails:
                raise UpstreamUnavailable("NASA POWER did not return data.", details={"source": source})
            p = dict(params)
            return synthetic_power(int(p["start"][:4]), int(p["end"][:4]), varying_rain=self.varying_rain)
        if source == "ISRIC SoilGrids":
            if self.soil_fails:
                raise UpstreamUnavailable("ISRIC SoilGrids did not return data.", details={"source": source})
            return synthetic_soilgrids()
        if source == "MODIS (ORNL DAAC)":
            if self.modis_fails:
                raise UpstreamUnavailable("MODIS did not return data.", details={"source": source})
            return synthetic_modis(dict(params), self.cloudy_year)
        raise AssertionError(f"unexpected upstream {source}")


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(cache_dir=tmp_path / "cache", first_year=2001, last_year=2004, rate_limit_per_minute=1000)


def make_client(settings: Settings, upstream: FakeUpstream) -> TestClient:
    return TestClient(create_app(settings, upstream))


@pytest.fixture
def fake() -> FakeUpstream:
    return FakeUpstream()


@pytest.fixture
def client(settings: Settings, fake: FakeUpstream) -> Iterator[TestClient]:
    with make_client(settings, fake) as c:
        yield c
