"""Soil texture class and plant-available water from particle-size fractions and organic matter."""

from __future__ import annotations

from dataclasses import dataclass

# Van Bemmelen factor used by Saxton & Rawls (2006) to convert organic carbon to organic matter.
OC_TO_OM = 1.724


@dataclass(frozen=True, slots=True)
class SoilLayer:
    top_cm: float
    bottom_cm: float
    sand_pct: float
    silt_pct: float
    clay_pct: float
    soc_g_kg: float
    ph: float

    @property
    def thickness_cm(self) -> float:
        return self.bottom_cm - self.top_cm


def usda_texture_class(sand: float, silt: float, clay: float) -> str:
    """USDA soil texture triangle (Soil Survey Manual, USDA Handbook 18) as boundary inequalities."""
    if silt + 1.5 * clay < 15:
        return "sand"
    if silt + 2 * clay < 30:
        return "loamy sand"
    if (7 <= clay < 20 and sand > 52) or (clay < 7 and silt < 50):
        return "sandy loam"
    if 7 <= clay < 27 and 28 <= silt < 50 and sand <= 52:
        return "loam"
    if (silt >= 50 and 12 <= clay < 27) or (50 <= silt < 80 and clay < 12):
        return "silt loam"
    if silt >= 80 and clay < 12:
        return "silt"
    if 20 <= clay < 35 and silt < 28 and sand > 45:
        return "sandy clay loam"
    if 27 <= clay < 40 and 20 < sand <= 45:
        return "clay loam"
    if 27 <= clay < 40 and sand <= 20:
        return "silty clay loam"
    if clay >= 35 and sand > 45:
        return "sandy clay"
    if clay >= 40 and silt >= 40:
        return "silty clay"
    return "clay"


def saxton_rawls_water_contents(sand_pct: float, clay_pct: float, om_pct: float) -> tuple[float, float]:
    """Volumetric water content at −1500 kPa and −33 kPa (m3 m-3), Saxton & Rawls (2006) eqs. 1 and 2.

    Saxton, K. E., Rawls, W. J. (2006). Soil water characteristic estimates by texture and organic matter for
    hydrologic solutions. Soil Science Society of America Journal 70, 1569–1578. doi:10.2136/sssaj2005.0117
    The regression was fitted for OM ≤ 8 % and clay ≤ 60 %; inputs are clipped to that range. For coarse sand with
    no organic matter the fitted wilting point dips just below zero, so it is floored at 0.
    """
    s = min(max(sand_pct, 0.0), 100.0) / 100.0
    c = min(max(clay_pct, 0.0), 60.0) / 100.0
    om = min(max(om_pct, 0.0), 8.0)
    t1500 = -0.024 * s + 0.487 * c + 0.006 * om + 0.005 * s * om - 0.013 * c * om + 0.068 * s * c + 0.031
    theta_wp = t1500 + (0.14 * t1500 - 0.02)
    t33 = -0.251 * s + 0.195 * c + 0.011 * om + 0.006 * s * om - 0.027 * c * om + 0.452 * s * c + 0.299
    theta_fc = t33 + (1.283 * t33 * t33 - 0.374 * t33 - 0.015)
    return max(theta_wp, 0.0), theta_fc


def available_water_mm(layers: list[SoilLayer], max_depth_cm: float = 100.0) -> float:
    """Plant-available water (field capacity minus wilting point) summed over the profile to `max_depth_cm`."""
    total = 0.0
    for layer in layers:
        top = layer.top_cm
        bottom = min(layer.bottom_cm, max_depth_cm)
        if bottom <= top:
            continue
        theta_wp, theta_fc = saxton_rawls_water_contents(
            layer.sand_pct, layer.clay_pct, layer.soc_g_kg / 10.0 * OC_TO_OM
        )
        total += max(theta_fc - theta_wp, 0.0) * (bottom - top) * 10.0
    return total


def depth_weighted_mean(layers: list[SoilLayer], attr: str, max_depth_cm: float) -> float:
    total = 0.0
    weight = 0.0
    for layer in layers:
        bottom = min(layer.bottom_cm, max_depth_cm)
        if bottom <= layer.top_cm:
            continue
        thickness = bottom - layer.top_cm
        total += float(getattr(layer, attr)) * thickness
        weight += thickness
    if weight == 0:
        raise ValueError(f"no soil layers above {max_depth_cm} cm")
    return total / weight
