from __future__ import annotations

from dataclasses import replace
from typing import Any

import pytest

from tests.conftest import FakeUpstream, make_client
from travertine_engine.config import Settings
from travertine_engine.errors import InvalidRequest
from travertine_engine.farmer import choose_soil
from travertine_engine.field import DEFAULT_LAYERS, SoilResult, summarise_soil
from travertine_engine.models import FarmerSoil, Provenance

BODY: dict[str, Any] = {
    "lat": 37.89,
    "lon": 28.98,
    "horizon_years": 3,
    "irrigated": False,
    "priorities": {"water": 0.2, "income": 1.0, "soil": 0.2, "risk": 0.2},
    "crop_ids": ["winter_wheat", "barley", "lentil", "sunflower"],
}


def soil_result(*, default: bool = False) -> SoilResult:
    return SoilResult(
        soil=summarise_soil(DEFAULT_LAYERS),
        layers=DEFAULT_LAYERS,
        is_default=default,
        provenance=Provenance(
            dataset="x",
            provider="x",
            spatial_resolution="x",
            temporal_coverage="x",
            access_url="https://x",
            note="",
        ),
    )


def by_name(records: list[Any]) -> dict[str, Any]:
    return {r.name if hasattr(r, "name") else r["name"]: r for r in records}


def test_without_a_soil_test_every_value_is_the_dataset_one() -> None:
    result = soil_result()
    choice = choose_soil(result, None)
    assert choice.awc_mm_per_m == result.soil.awc_mm
    assert choice.texture == result.soil.texture
    assert {r.source for r in choice.records} == {"dataset"}
    assert all(r.replaces == "" for r in choice.records)


def test_soil_test_replaces_texture_and_recomputes_water() -> None:
    result = soil_result()
    choice = choose_soil(result, FarmerSoil(sand_pct=80, clay_pct=5, organic_carbon_pct=0.5))
    records = by_name(choice.records)
    assert choice.texture == "loamy sand"
    assert records["soil.texture_class"].source == "farmer"
    assert records["soil.texture_class"].replaces == f"SoilGrids 2.0, 0–30 cm: {result.soil.texture}"
    awc = records["soil.available_water_mm_per_m"]
    assert awc.source == "farmer"
    assert "recomputed from the soil test" in awc.replaces
    assert awc.value < result.soil.awc_mm  # a loamy sand holds less water than the default loam


def test_measured_available_water_wins() -> None:
    choice = choose_soil(soil_result(default=True), FarmerSoil(available_water_mm_per_m=95))
    records = by_name(choice.records)
    assert choice.awc_mm_per_m == 95
    assert records["soil.available_water_mm_per_m"].replaces.startswith("default soil, 0–100 cm")
    assert records["soil.sand_pct"].source == "default"


@pytest.mark.parametrize(
    "test",
    [FarmerSoil(sand_pct=40), FarmerSoil(clay_pct=40), FarmerSoil(sand_pct=70, clay_pct=40)],
)
def test_incomplete_or_impossible_texture_is_rejected(test: FarmerSoil) -> None:
    with pytest.raises(InvalidRequest):
        choose_soil(soil_result(), test)


def test_explore_reports_where_inputs_came_from(settings: Settings, fake: FakeUpstream) -> None:
    long = replace(settings, last_year=2008)
    values = {"winter_wheat": 300, "barley": 250, "lentil": 450, "sunflower": 600}
    with make_client(long, fake) as c:
        plain = c.post("/v1/rotations/explore", json=BODY)
        farmer = c.post(
            "/v1/rotations/explore",
            json={
                **BODY,
                "farmer_inputs": {
                    "soil": {"sand_pct": 75, "clay_pct": 8, "available_water_mm_per_m": 80},
                    "crop_values": values,
                },
            },
        )
        again = c.post("/v1/rotations/explore", json=BODY)
    assert plain.status_code == farmer.status_code == 200, farmer.text
    assert again.json() == plain.json()  # the farmer's request did not leak into the cached plain scores

    plain_inputs = by_name(plain.json()["inputs"])
    assert plain_inputs["allowed_crops"]["source"] == "farmer"
    assert plain_inputs["crop_values"]["source"] == "default"
    assert plain_inputs["soil.available_water_mm_per_m"]["source"] == "dataset"

    got = by_name(farmer.json()["inputs"])
    assert got["soil.available_water_mm_per_m"]["value"] == 80
    assert got["soil.available_water_mm_per_m"]["source"] == "farmer"
    assert got["soil.texture_class"]["value"] == "sandy loam"  # 75 % sand, 17 % silt, 8 % clay
    assert got["crop_value.sunflower"]["value"] == 600
    assert farmer.json()["rotations"] != plain.json()["rotations"]
    assert "value you gave" in farmer.json()["rotations"][0]["explanation"][-1]


def test_crop_values_must_cover_the_candidate_crops(settings: Settings, fake: FakeUpstream) -> None:
    long = replace(settings, last_year=2008)
    with make_client(long, fake) as c:
        r = c.post(
            "/v1/rotations/explore",
            json={**BODY, "farmer_inputs": {"crop_values": {"barley": 1, "maize": 2}}},
        )
        negative = c.post(
            "/v1/rotations/explore", json={**BODY, "farmer_inputs": {"crop_values": {"barley": -1}}}
        )
    assert r.status_code == 422
    assert r.json()["details"] == {"missing": ["lentil", "sunflower", "winter_wheat"], "unknown": ["maize"]}
    assert negative.status_code == 422
