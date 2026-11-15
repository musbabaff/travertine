from __future__ import annotations

from dataclasses import replace
from pathlib import Path

import numpy as np
import pytest

from tests.conftest import FakeUpstream, make_client
from travertine_engine.config import Settings
from travertine_engine.science.ndvi import (
    paired_bootstrap,
    pearson,
    pooled_paired_bootstrap,
    season_mean,
    zscores,
)
from travertine_engine.sources.modis import Composite
from travertine_engine.text import verdict

LONG = {"first_year": 2001, "last_year": 2012, "rate_limit_per_minute": 1000}


def comps(values: list[tuple[float | None, int]]) -> list[Composite]:
    return [Composite(doy=97 + 16 * i, ndvi=v, reliability=r) for i, (v, r) in enumerate(values)]


def test_season_mean_screens_quality() -> None:
    good = comps([(0.3, 0)] * 5 + [(0.5, 1)] + [(0.9, 3)] * 4)
    assert season_mean(good) == pytest.approx((0.3 * 5 + 0.5) / 6)
    assert season_mean(comps([(0.3, 0)] * 5 + [(0.9, 3)] * 5)) is None
    assert season_mean(comps([(None, 0)] * 10)) is None


def test_zscores() -> None:
    z = zscores(np.array([1.0, 2.0, 3.0]))
    np.testing.assert_allclose(z, [-1.0, 0.0, 1.0])


def test_paired_bootstrap_intervals_bracket_the_estimate() -> None:
    rng = np.random.default_rng(3)
    target = rng.normal(size=30)
    strong = -target + 0.3 * rng.normal(size=30)
    weak = -target + 2.0 * rng.normal(size=30)
    s = paired_bootstrap(strong, weak, target, resamples=2000, seed=1)
    assert s.r_a == pytest.approx(pearson(strong, target))
    assert s.ci_a[0] <= s.r_a <= s.ci_a[1]
    assert s.ci_b[0] <= s.r_b <= s.ci_b[1]
    assert s.ci_diff[1] < 0  # the strong series is clearly more negative
    again = paired_bootstrap(strong, weak, target, resamples=2000, seed=1)
    assert again.ci_diff == s.ci_diff


def test_validation_endpoint(settings: Settings) -> None:
    cfg = Settings(cache_dir=settings.cache_dir, **LONG)
    with make_client(cfg, FakeUpstream(varying_rain=True, cloudy_year=2007)) as c:
        r = c.get("/v1/validation", params={"lat": 37.89, "lon": 28.98})
    assert r.status_code == 200, r.text
    body = r.json()
    years = [y["year"] for y in body["years"]]
    assert 2007 not in years
    assert years == sorted(years)
    assert years[0] == 2002
    assert body["n"] == len(years)
    assert all(0 <= y["modelled_stress"] <= 1 for y in body["years"])
    anomalies = np.array([y["observed_ndvi_anomaly"] for y in body["years"]])
    assert abs(anomalies.mean()) < 0.01
    assert body["correlation"] < 0  # wetter synthetic years are greener and less stressed
    assert body["caveats"][0].startswith("Model (winter-wheat water balance): r = ")
    assert any("2007" in c for c in body["caveats"])
    assert any("MOD13Q1" in p["dataset"] for p in body["provenance"])


def test_validation_needs_enough_years(settings: Settings) -> None:
    with make_client(settings, FakeUpstream(varying_rain=True)) as c:
        r = c.get("/v1/validation", params={"lat": 37.89, "lon": 28.98})
    assert r.status_code == 422
    assert r.json()["code"] == "out_of_coverage"


def test_validation_rejects_bad_coordinates(settings: Settings) -> None:
    with make_client(settings, FakeUpstream()) as c:
        assert c.get("/v1/validation", params={"lat": 95, "lon": 28.98}).status_code == 422
        assert c.get("/v1/validation", params={"lat": 37.89}).status_code == 422


def test_analyze_carries_ndvi_history_and_survives_modis_outage(settings: Settings) -> None:
    with make_client(settings, FakeUpstream(cloudy_year=2003)) as c:
        body = c.post("/v1/field/analyze", json={"lat": 37.89, "lon": 28.98, "irrigated": False}).json()
    assert [y["year"] for y in body["ndvi_history"]] == [2001, 2002, 2004]
    modis = [p for p in body["provenance"] if "MOD13Q1" in p["dataset"]]
    assert modis
    assert "2003" in modis[0]["note"]
    fresh = replace(settings, cache_dir=settings.cache_dir.parent / "no-modis")
    with make_client(fresh, FakeUpstream(modis_fails=True)) as c:
        r = c.post("/v1/field/analyze", json={"lat": 37.89, "lon": 28.98, "irrigated": False})
    assert r.status_code == 200
    assert "ndvi_history" not in r.json()


def test_pooled_bootstrap_averages_sites() -> None:
    rng = np.random.default_rng(7)
    sites = []
    for _ in range(4):
        target = rng.normal(size=20)
        sites.append((-target + 0.3 * rng.normal(size=20), -target + 2.0 * rng.normal(size=20), target))
    p = pooled_paired_bootstrap(sites, resamples=2000, seed=1)
    assert p.sites == 4
    assert p.mean_r_a == pytest.approx(np.mean([pearson(a, t) for a, _, t in sites]))
    assert p.ci_a[0] <= p.mean_r_a <= p.ci_a[1]
    assert p.ci_diff[1] < 0
    assert "established" in verdict(p.ci_diff)
    assert "not established" in verdict((-0.1, 0.1))


def test_modis_from_planetary_computer_matches_ornl(settings: Settings, tmp_path: Path) -> None:
    with make_client(settings, FakeUpstream(cloudy_year=2003)) as c:
        ornl = c.post("/v1/field/analyze", json={"lat": 37.89, "lon": 28.98, "irrigated": False}).json()
    other = replace(settings, cache_dir=tmp_path / "pc-cache")
    fake = FakeUpstream(cloudy_year=2003, modis_fails=True, pc_modis=True)
    with make_client(other, fake) as c:
        pc = c.post("/v1/field/analyze", json={"lat": 37.89, "lon": 28.98, "irrigated": False}).json()
    assert pc["ndvi_history"] == ornl["ndvi_history"]
    assert "MODIS (ORNL DAAC)" not in fake.calls


def test_validation_caveats_in_turkish_keep_every_number(settings: Settings) -> None:
    cfg = Settings(cache_dir=settings.cache_dir, **LONG)
    with make_client(cfg, FakeUpstream(varying_rain=True, cloudy_year=2007)) as c:
        en = c.get("/v1/validation", params={"lat": 37.89, "lon": 28.98}).json()
        tr = c.get("/v1/validation", params={"lat": 37.89, "lon": 28.98, "language": "tr"}).json()
        bad = c.get("/v1/validation", params={"lat": 37.89, "lon": 28.98, "language": "de"})
    assert bad.status_code == 422
    assert bad.json()["code"] == "invalid_request"
    assert {k: v for k, v in tr.items() if k != "caveats"} == {k: v for k, v in en.items() if k != "caveats"}
    assert len(tr["caveats"]) == len(en["caveats"])
    assert tr["caveats"][0].startswith("Model (kışlık buğday su dengesi): r = ")
    r = f"{en['correlation']:+.2f}".replace(".", ",")
    assert f"r = {r}" in tr["caveats"][0]
    assert tr["caveats"][-1].endswith("2007.")


def test_validation_carries_the_structured_baseline_comparison(settings: Settings) -> None:
    cfg = Settings(cache_dir=settings.cache_dir, **LONG)
    with make_client(cfg, FakeUpstream(varying_rain=True, cloudy_year=2007)) as c:
        body = c.get("/v1/validation", params={"lat": 37.89, "lon": 28.98}).json()
    lo, hi = body["difference_ci95"]
    expected = "model_better" if hi < 0 else "baseline_better" if lo > 0 else "no_detectable_difference"
    assert body["verdict"] == expected
    assert body["correlation_ci95"][0] <= body["correlation"] <= body["correlation_ci95"][1]
    baseline = body["baseline"]
    assert [v["year"] for v in baseline["values"]] == [y["year"] for y in body["years"]]
    assert baseline["correlation_ci95"][0] <= baseline["correlation"] <= baseline["correlation_ci95"][1]
    assert f"{baseline['correlation']:+.2f}" in body["caveats"][0]
