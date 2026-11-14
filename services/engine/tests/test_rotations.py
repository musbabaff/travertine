from __future__ import annotations

from datetime import date

import numpy as np
import pytest

from travertine_engine.explore import row_percentile
from travertine_engine.science.crops import crops_by_id, load_crops
from travertine_engine.science.rotations import (
    compatible,
    enumerate_rotations,
    soil_indicators,
    valid_sequence,
)
from travertine_engine.science.season import (
    climate_adjusted_kc,
    harvest_date,
    kc_curve,
    rh_min_percent,
    sowing_date,
)

C = crops_by_id()


def seq(*ids: str) -> list:  # type: ignore[type-arg]
    return [C[i] for i in ids]


def test_calendar() -> None:
    assert sowing_date(C["winter_wheat"], 2010) == date(2009, 11, 15)
    assert harvest_date(C["winter_wheat"], 2010) == date(2010, 7, 12)
    assert sowing_date(C["maize"], 2010) == date(2010, 4, 15)


def test_kc_curve_shape() -> None:
    wheat = C["winter_wheat"]
    curve = kc_curve(wheat, 1.15, 0.25)
    assert curve.shape[0] == wheat.growing_days
    assert curve[0] == pytest.approx(0.70)
    assert curve[wheat.stages.ini + wheat.stages.dev] == pytest.approx(1.15)
    assert curve[-1] == pytest.approx(0.25)


def test_climate_adjustment_eq62() -> None:
    # FAO-56 Box 14 (wheat, Kc mid 1.15, h = 1 m): Kc mid ranges from about 1.02 (humid, calm) to 1.25 (arid, windy)
    assert climate_adjusted_kc(1.15, 2.0, 45.0, 1.0) == pytest.approx(1.15)
    assert climate_adjusted_kc(1.15, 4.0, 20.0, 1.0) > 1.2
    assert climate_adjusted_kc(1.15, 1.0, 80.0, 1.0) < 1.05


def test_rh_min_eq63() -> None:
    assert float(rh_min_percent(np.array([10.0]), np.array([10.0]))[0]) == pytest.approx(100.0)
    assert float(rh_min_percent(np.array([5.0]), np.array([30.0]))[0]) == pytest.approx(20.6, abs=0.2)


def test_rules() -> None:
    assert not compatible(C["winter_wheat"], C["barley"])  # same family
    assert compatible(C["alfalfa"], C["alfalfa"])  # perennial stand continues
    assert not compatible(C["lentil"], C["soybean"])  # same family
    assert valid_sequence(seq("winter_wheat", "lentil", "maize"))
    assert not valid_sequence(seq("winter_wheat", "maize", "sunflower"))  # no legume
    assert not valid_sequence(seq("maize", "alfalfa", "winter_wheat"))  # one-year alfalfa stand
    assert valid_sequence(seq("maize", "alfalfa", "alfalfa"))


def test_enumeration_respects_rules() -> None:
    crops = load_crops()
    rotations = enumerate_rotations(crops, 4)
    assert rotations
    for r in rotations:
        s = [crops[i] for i in r]
        assert valid_sequence(s)
    assert len(set(rotations)) == len(rotations)


def test_soil_indicators_credit_and_sandy_rule() -> None:
    clay = soil_indicators(seq("maize", "alfalfa", "alfalfa", "winter_wheat", "sunflower"), "clay loam")
    assert clay.n_credit_kg_ha == pytest.approx(179.3 + 56.0)
    sandy = soil_indicators(seq("maize", "alfalfa", "alfalfa", "winter_wheat", "sunflower"), "loamy sand")
    assert sandy.n_credit_kg_ha == pytest.approx(179.3 - 56.0)
    no_follow = soil_indicators(seq("winter_wheat", "maize", "soybean"), "loam")
    assert no_follow.n_credit_kg_ha == 0
    assert no_follow.families == 2


def test_row_percentile_matches_numpy() -> None:
    rng = np.random.default_rng(1)
    a = rng.random((50, 37))
    a[rng.random((50, 37)) < 0.2] = np.nan
    for q in (10, 50, 90):
        np.testing.assert_allclose(row_percentile(a, q), np.nanpercentile(a, q, axis=1))
