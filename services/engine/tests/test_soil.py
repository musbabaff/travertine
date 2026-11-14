from __future__ import annotations

import pytest
from hypothesis import given
from hypothesis import strategies as st

from travertine_engine.science.soil import (
    SoilLayer,
    available_water_mm,
    depth_weighted_mean,
    saxton_rawls_water_contents,
    usda_texture_class,
)


@pytest.mark.parametrize(
    ("sand", "silt", "clay", "expected"),
    [
        (92, 4, 4, "sand"),
        (82, 12, 6, "loamy sand"),
        (65, 25, 10, "sandy loam"),
        (40, 40, 20, "loam"),
        (20, 65, 15, "silt loam"),
        (5, 88, 7, "silt"),
        (60, 13, 27, "sandy clay loam"),
        (32, 34, 34, "clay loam"),
        (10, 55, 35, "silty clay loam"),
        (52, 6, 42, "sandy clay"),
        (6, 46, 48, "silty clay"),
        (20, 20, 60, "clay"),
    ],
)
def test_usda_texture_triangle(sand: float, silt: float, clay: float, expected: str) -> None:
    assert usda_texture_class(sand, silt, clay) == expected


def test_saxton_rawls_orders_textures_sensibly() -> None:
    wp_sand, fc_sand = saxton_rawls_water_contents(90, 5, 1.0)
    wp_loam, fc_loam = saxton_rawls_water_contents(40, 20, 2.5)
    wp_clay, fc_clay = saxton_rawls_water_contents(20, 50, 2.5)
    assert fc_sand - wp_sand < fc_loam - wp_loam
    assert wp_sand < wp_loam < wp_clay
    assert fc_sand < fc_loam < fc_clay


@given(sand=st.floats(0, 100), clay=st.floats(0, 100), om=st.floats(0, 20))
def test_saxton_rawls_water_contents_are_physical(sand: float, clay: float, om: float) -> None:
    clay = min(clay, 100 - sand)
    wp, fc = saxton_rawls_water_contents(sand, clay, om)
    assert 0 <= wp < fc < 0.6


def test_available_water_respects_depth_limit() -> None:
    layers = [SoilLayer(0, 50, 40, 40, 20, 10, 7), SoilLayer(50, 200, 40, 40, 20, 10, 7)]
    full = available_water_mm(layers, 200)
    half = available_water_mm(layers, 100)
    assert half == pytest.approx(full / 2)


def test_depth_weighted_mean() -> None:
    layers = [SoilLayer(0, 10, 0, 0, 0, 20, 6), SoilLayer(10, 30, 0, 0, 0, 5, 8)]
    assert depth_weighted_mean(layers, "soc_g_kg", 30) == pytest.approx((20 * 10 + 5 * 20) / 30)
    assert depth_weighted_mean(layers, "ph", 10) == pytest.approx(6)
