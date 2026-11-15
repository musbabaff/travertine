"""The farmer's own numbers: a soil test that replaces the SoilGrids estimates, values per crop for the income score,
and the record of where every input of an explore request came from."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from travertine_engine.errors import InvalidRequest
from travertine_engine.field import SoilResult
from travertine_engine.models import FarmerSoil, InputSource
from travertine_engine.science.crops import CropParams
from travertine_engine.science.soil import (
    OC_TO_OM,
    depth_weighted_mean,
    saxton_rawls_water_contents,
    usda_texture_class,
)

SURFACE_DEPTH_CM = 15


@dataclass(frozen=True, slots=True)
class SoilChoice:
    sand: float
    silt: float
    clay: float
    om_pct: float
    texture: str
    awc_mm_per_m: float
    records: list[InputSource]

    @property
    def key(self) -> tuple[float, ...]:
        return (round(self.sand, 1), round(self.clay, 1), round(self.om_pct, 2), round(self.awc_mm_per_m, 1))


def _record(
    name: str, value: float | str, unit: str, farmer: bool, origin: str, estimate: str
) -> InputSource:
    if not farmer:
        return InputSource(name=name, value=value, unit=unit, source=origin, replaces="")
    return InputSource(name=name, value=value, unit=unit, source="farmer", replaces=estimate)


def choose_soil(result: SoilResult, test: FarmerSoil | None) -> SoilChoice:
    """Dataset soil, with every value from the farmer's soil test put in its place.

    Sand and clay come together (a texture class needs both). When the test changes texture or organic carbon but
    gives no available water, it is recomputed with Saxton & Rawls (2006) from the tested topsoil, as if that soil
    filled the whole metre."""
    test = test or FarmerSoil()
    if (test.sand_pct is None) != (test.clay_pct is None):
        raise InvalidRequest("Give sand_pct and clay_pct together; a texture class needs both.")
    if test.sand_pct is not None and test.clay_pct is not None and test.sand_pct + test.clay_pct > 100:
        raise InvalidRequest("sand_pct + clay_pct cannot exceed 100.")

    top = [layer for layer in result.layers if layer.bottom_cm <= SURFACE_DEPTH_CM]
    ds_sand = depth_weighted_mean(top, "sand_pct", SURFACE_DEPTH_CM)
    ds_clay = depth_weighted_mean(top, "clay_pct", SURFACE_DEPTH_CM)
    ds_silt = depth_weighted_mean(top, "silt_pct", SURFACE_DEPTH_CM)
    ds_oc = depth_weighted_mean(top, "soc_g_kg", SURFACE_DEPTH_CM) / 10.0
    origin = "default" if result.is_default else "dataset"
    label = "default soil" if result.is_default else "SoilGrids 2.0"

    tested_texture = test.sand_pct is not None and test.clay_pct is not None
    sand = test.sand_pct if test.sand_pct is not None else ds_sand
    clay = test.clay_pct if test.clay_pct is not None else ds_clay
    silt = 100.0 - sand - clay if tested_texture else ds_silt
    oc = test.organic_carbon_pct if test.organic_carbon_pct is not None else ds_oc
    texture = usda_texture_class(sand, silt, clay) if tested_texture else result.soil.texture

    awc = result.soil.awc_mm
    awc_farmer = test.available_water_mm_per_m is not None
    if awc_farmer:
        awc = float(test.available_water_mm_per_m)  # type: ignore[arg-type]
    elif tested_texture or test.organic_carbon_pct is not None:
        wp, fc = saxton_rawls_water_contents(sand, clay, oc * OC_TO_OM)
        awc = round(max(fc - wp, 0.0) * 1000.0)

    recomputed = not awc_farmer and awc != result.soil.awc_mm
    records = [
        _record(
            "soil.sand_pct", round(sand, 1), "%", tested_texture, origin, f"{label}, 0–15 cm: {ds_sand:.0f} %"
        ),
        _record(
            "soil.clay_pct", round(clay, 1), "%", tested_texture, origin, f"{label}, 0–15 cm: {ds_clay:.0f} %"
        ),
        _record(
            "soil.organic_carbon_pct",
            round(oc, 2),
            "%",
            test.organic_carbon_pct is not None,
            origin,
            f"{label}, 0–15 cm: {ds_oc:.2f} %",
        ),
        _record(
            "soil.texture_class",
            texture,
            "",
            tested_texture,
            origin,
            f"{label}, 0–30 cm: {result.soil.texture}",
        ),
        InputSource(
            name="soil.available_water_mm_per_m",
            value=awc,
            unit="mm/m",
            source="farmer" if awc_farmer or recomputed else origin,
            replaces=(
                f"{label}, 0–100 cm: {result.soil.awc_mm:.0f} mm/m"
                + ("" if awc_farmer else "; recomputed from the soil test with Saxton & Rawls (2006)")
                if awc_farmer or recomputed
                else ""
            ),
        ),
    ]
    return SoilChoice(sand, silt, clay, oc * OC_TO_OM, texture, awc, records)


def crop_weights(crops: tuple[CropParams, ...], values: dict[str, float] | None) -> np.ndarray | None:
    """Each crop's value divided by the largest one, in the order of `crops`; None when the farmer gave none."""
    if not values:
        return None
    known = {c.id for c in crops}
    unknown = sorted(set(values) - known)
    missing = sorted(known - set(values))
    if unknown or missing:
        raise InvalidRequest(
            "crop_values needs one value for every candidate crop and no others.",
            details={"missing": missing, "unknown": unknown},
        )
    top = max(values.values())
    if top <= 0:
        raise InvalidRequest("At least one crop value must be above 0.")
    return np.array([values[c.id] / top for c in crops])


def other_records(
    crops: tuple[CropParams, ...],
    crop_ids: list[str] | None,
    values: dict[str, float] | None,
    irrigated: bool,
) -> list[InputSource]:
    records = [
        InputSource(
            name="allowed_crops",
            value=", ".join(c.id for c in crops),
            unit="",
            source="farmer" if crop_ids else "default",
            replaces="all crops in the engine's table" if crop_ids else "",
        ),
        InputSource(
            name="irrigated",
            value="irrigated" if irrigated else "rain-fed",
            unit="",
            source="farmer",
            replaces="",
        ),
    ]
    if values:
        records += [
            InputSource(
                name=f"crop_value.{c.id}",
                value=values[c.id],
                unit="relative",
                source="farmer",
                replaces="equal value for every crop",
            )
            for c in crops
        ]
    else:
        records.append(
            InputSource(
                name="crop_values", value="equal for every crop", unit="", source="default", replaces=""
            )
        )
    return records
