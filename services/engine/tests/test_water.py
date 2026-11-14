from __future__ import annotations

import numpy as np
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from travertine_engine.science.water import (
    Elements,
    SurfaceLayer,
    adjusted_p,
    bare_soil_depletion,
    evaporation_reduction,
    simulate,
    water_stress_coefficient,
)

SURFACE = SurfaceLayer(tew_mm=22.0, rew_mm=9.0)


def test_ks_follows_fao56_eq84() -> None:
    taw = np.array([100.0, 100.0, 100.0, 100.0])
    raw = np.array([50.0, 50.0, 50.0, 50.0])
    dr = np.array([20.0, 50.0, 75.0, 100.0])
    np.testing.assert_allclose(water_stress_coefficient(dr, taw, raw), [1.0, 1.0, 0.5, 0.0])


def test_ks_between_raw_and_taw() -> None:
    # eq. 84 by hand: TAW = 128 mm, RAW = 64 mm, Dr = 90 mm → Ks = (128 − 90)/(128 − 64) = 0.594
    ks = water_stress_coefficient(np.array([90.0]), np.array([128.0]), np.array([64.0]))
    assert float(ks[0]) == pytest.approx(0.59, abs=0.01)


def test_p_adjustment() -> None:
    np.testing.assert_allclose(adjusted_p(0.55, np.array([5.0, 10.0, 0.0])), [0.55, 0.35, 0.75])
    assert float(adjusted_p(0.65, np.array([0.0]))[0]) == pytest.approx(0.8)


def test_evaporation_reduction() -> None:
    np.testing.assert_allclose(
        evaporation_reduction(np.array([0.0, 9.0, 15.5, 22.0]), 22.0, 9.0), [1, 1, 0.5, 0]
    )


def _elements(n_days: int, sow: int, length: int, kc: float, f0: float, taw: float = 150.0) -> Elements:
    return Elements(
        start=np.array([0]),
        sow=np.array([sow]),
        length=np.array([length]),
        kc=np.full((1, length), kc),
        kc_row=np.array([0]),
        taw=np.array([taw]),
        p=np.array([0.5]),
        f0=np.array([f0]),
        de0=np.array([0.0]),
    )


@settings(max_examples=60, deadline=None)
@given(
    rain=st.lists(st.floats(0, 60), min_size=40, max_size=120),
    et0=st.floats(0.5, 9.0),
    kc=st.floats(0.2, 1.3),
    f0=st.floats(0, 1),
    sow=st.integers(0, 30),
    irrigated=st.booleans(),
)
def test_water_balance_conserves_mass(
    rain: list[float], et0: float, kc: float, f0: float, sow: int, irrigated: bool
) -> None:
    n = len(rain)
    sow = min(sow, n - 5)
    length = n - sow
    el = _elements(n, sow, length, kc, f0)
    out = simulate(el, np.full(n, et0), np.array(rain), SURFACE, irrigated=irrigated)
    inflow = out.rain_total + out.irrigation
    outflow = out.eta + out.bare_evaporation + out.drainage
    # ΔDr = water removed − water added
    np.testing.assert_allclose(out.dr_end - out.dr_start, outflow - inflow, atol=1e-6)
    assert np.all(out.dr_end >= -1e-9)
    assert np.all(out.dr_end <= el.taw + 1e-9)
    assert np.all(out.eta <= out.etc + 1e-9)


def test_irrigated_crop_is_never_stressed() -> None:
    n = 120
    out = simulate(_elements(n, 0, n, 1.1, 0.9), np.full(n, 6.0), np.zeros(n), SURFACE, irrigated=True)
    assert float(out.eta[0]) == pytest.approx(float(out.etc[0]), rel=1e-6)
    assert float(out.irrigation[0]) > 0


def test_rainfed_crop_on_dry_soil_is_stressed() -> None:
    n = 120
    out = simulate(_elements(n, 0, n, 1.1, 0.9), np.full(n, 6.0), np.zeros(n), SURFACE, irrigated=False)
    assert float(out.eta[0]) < 0.3 * float(out.etc[0])
    assert float(out.irrigation[0]) == 0.0


def test_bare_soil_dries_and_rewets() -> None:
    n = 60
    rain = np.zeros(n)
    rain[30] = 200.0
    f = bare_soil_depletion(np.full(n, 5.0), rain, 150.0, SURFACE)
    assert f[0] == 0.0
    assert 0 < f[29] <= SURFACE.tew_mm / 150.0 + 1e-9  # only the evaporation layer can dry
    assert f[31] == 0.0
