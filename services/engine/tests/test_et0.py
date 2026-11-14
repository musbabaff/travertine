"""ET0 against the worked examples printed in FAO-56 (Allen et al., 1998)."""

from __future__ import annotations

import numpy as np
import pytest
from hypothesis import given
from hypothesis import strategies as st

from travertine_engine.science import et0 as fao


def test_example_2_pressure_and_psychrometric_constant() -> None:
    # Example 2: 1800 m → P = 81.8 kPa, γ = 0.054 kPa/°C
    p = float(fao.atmospheric_pressure(1800.0))
    assert p == pytest.approx(81.8, abs=0.05)
    assert float(fao.psychrometric_constant(p)) == pytest.approx(0.054, abs=0.0005)


def test_example_3_saturation_vapour_pressure() -> None:
    # Example 3: Tmax 24.5, Tmin 15 → e°(Tmax) 3.075, e°(Tmin) 1.705, es 2.390 kPa
    assert float(fao.saturation_vapour_pressure(24.5)) == pytest.approx(3.075, abs=0.001)
    assert float(fao.saturation_vapour_pressure(15.0)) == pytest.approx(1.705, abs=0.001)
    assert float(fao.mean_saturation_vapour_pressure(24.5, 15.0)) == pytest.approx(2.390, abs=0.001)


def test_example_8_extraterrestrial_radiation() -> None:
    # Example 8: 20°S on 3 September (J = 246) → Ra = 32.2 MJ m-2 day-1
    assert float(fao.extraterrestrial_radiation(-20.0, 246)) == pytest.approx(32.2, abs=0.05)


def test_example_9_daylight_hours() -> None:
    # Example 9: 20°S on 3 September → N = 11.7 h
    assert float(fao.daylight_hours(-20.0, 246)) == pytest.approx(11.7, abs=0.05)


def test_eq47_wind_conversion_as_in_example_18() -> None:
    # Example 18: 10 m height, 2.78 m/s → u2 = 0.748 × 2.78 = 2.078 m/s
    assert float(fao.wind_speed_at_2m(2.78, 10.0)) == pytest.approx(2.078, abs=0.002)


class TestExample18Uccle:
    """Example 18: Uccle (Brussels), 6 July, 50°48'N, 100 m. FAO-56 gives ETo = 3.9 mm/day."""

    lat = 50.80
    doy = 187
    elevation = 100.0
    rs = 22.07
    ea = float(fao.actual_vapour_pressure_from_rh(21.5, 12.3, 84, 63))

    def test_intermediate_values(self) -> None:
        assert self.ea == pytest.approx(1.409, abs=0.001)
        ra = float(fao.extraterrestrial_radiation(self.lat, self.doy))
        assert ra == pytest.approx(41.09, abs=0.02)
        rso = float(fao.clear_sky_radiation(ra, self.elevation))
        assert rso == pytest.approx(30.90, abs=0.02)
        rnl = float(fao.net_longwave_radiation(21.5, 12.3, self.ea, self.rs, rso))
        assert rnl == pytest.approx(3.71, abs=0.03)
        assert float(fao.svp_slope(16.9)) == pytest.approx(0.122, abs=0.0005)

    def test_et0(self) -> None:
        et0 = float(
            fao.penman_monteith_daily(
                tmax_c=21.5,
                tmin_c=12.3,
                ea_kpa=self.ea,
                rs=self.rs,
                u2=2.078,
                lat_deg=self.lat,
                doy=self.doy,
                elevation_m=self.elevation,
            )
        )
        assert et0 == pytest.approx(3.9, abs=0.05)


def test_hargreaves_is_in_range_of_penman_monteith_for_example_18() -> None:
    # FAO-56 prints no Hargreaves example; for the Example 18 day it must at least land near the PM value.
    hg = float(fao.hargreaves_daily(21.5, 12.3, 50.80, 187))
    assert 3.0 < hg < 5.5


@given(
    tmax=st.floats(5, 45),
    spread=st.floats(0, 20),
    rs_frac=st.floats(0.2, 1.0),
    u2=st.floats(0, 8),
    dew_gap=st.floats(0, 25),
    doy=st.integers(1, 365),
    lat=st.floats(-60, 60),
)
def test_penman_monteith_is_finite_and_non_negative(
    tmax: float, spread: float, rs_frac: float, u2: float, dew_gap: float, doy: int, lat: float
) -> None:
    tmin = tmax - spread
    ra = float(fao.extraterrestrial_radiation(lat, doy))
    rs = rs_frac * 0.75 * ra
    out = fao.penman_monteith_daily(
        tmax_c=tmax,
        tmin_c=tmin,
        ea_kpa=fao.saturation_vapour_pressure(tmin - dew_gap),
        rs=rs,
        u2=u2,
        lat_deg=lat,
        doy=doy,
        elevation_m=500.0,
    )
    assert np.isfinite(out)
    assert float(out) >= 0.0
