from __future__ import annotations

from datetime import date

import pytest

from tests.conftest import FakeUpstream, make_client
from travertine_engine.config import Settings
from travertine_engine.field_ndvi import summarise
from travertine_engine.sources.hls import Observation


def test_fmask_clear_rule() -> None:
    def obs(fmask: int) -> Observation:
        return Observation(day=date(2023, 5, 1), sensor="S30", red=800, nir=3000, fmask=fmask)

    assert obs(0).clear
    assert obs(64).clear  # low aerosol
    assert obs(1).clear  # bit 0 (cirrus) is unused in HLS v2.0
    assert not obs(2).clear  # cloud
    assert not obs(4).clear  # adjacent to cloud or shadow
    assert not obs(32).clear  # water
    assert not obs(192).clear  # high aerosol
    assert obs(0).ndvi == pytest.approx((3000 - 800) / 3800)


def test_season_needs_enough_clear_observations() -> None:
    few = [Observation(day=date(2022, 6, d), sensor="L30", red=800, nir=3000, fmask=0) for d in (1, 9, 17)]
    _, seasons = summarise(few)
    assert seasons[0].mean_ndvi is None
    assert seasons[0].n_clear == 3


def test_field_ndvi_endpoint(settings: Settings) -> None:
    cfg = Settings(cache_dir=settings.cache_dir, first_year=2001, last_year=2021, rate_limit_per_minute=1000)
    fake = FakeUpstream()
    with make_client(cfg, fake) as c:
        r = c.get("/v1/field/ndvi", params={"lat": 37.89, "lon": 28.98})
        assert r.status_code == 200, r.text
        calls = len(fake.calls)
        assert c.get("/v1/field/ndvi", params={"lat": 37.89, "lon": 28.98}).status_code == 200
        assert len(fake.calls) == calls  # past years come from the cache
    body = r.json()
    assert [s["year"] for s in body["seasons"]] == [2020, 2021]
    season = body["seasons"][0]
    assert season["n_scenes"] == 66  # 2 sensors × 36 dates, minus 3 cloudy scenes each, tiles deduplicated
    assert season["mean_ndvi"] > 0.4
    dates = [o["date"] for o in body["observations"]]
    assert dates == sorted(dates)
    assert len(set(dates)) == len(dates)
    assert all(date.fromisoformat(d).toordinal() % 3 for d in dates)  # cloudy-pixel dates dropped
    assert "2020" in body["caveats"][0]
    assert body["provenance"][0]["spatial_resolution"] == "30 m"
    assert any("MOD13Q1" in p["dataset"] for p in body["provenance"])
    comparison = body["caveats"][-1]
    assert comparison.startswith("Compared with the MODIS 250 m season means")
    assert "(2020, 2021; n = 2)" in comparison


def test_field_ndvi_survives_a_modis_outage(settings: Settings) -> None:
    cfg = Settings(cache_dir=settings.cache_dir, first_year=2001, last_year=2021, rate_limit_per_minute=1000)
    with make_client(cfg, FakeUpstream(modis_fails=True)) as c:
        r = c.get("/v1/field/ndvi", params={"lat": 37.89, "lon": 28.98})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["caveats"][-1].startswith("The MODIS 250 m record could not be read")
    assert len(body["provenance"]) == 1
