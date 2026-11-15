"""Structured reasoning per strategy: built from the strategy's own numbers, parts empty rather than generic."""

from __future__ import annotations

from typing import Any

import pytest

from tests.conftest import FakeUpstream, make_client
from tests.test_contract import errors
from travertine_engine.config import Settings

BODY: dict[str, Any] = {
    "lat": 37.89,
    "lon": 28.98,
    "horizon_years": 3,
    "priorities": {"water": 0.8, "income": 0.5, "soil": 0.6, "risk": 0.4},
    "irrigated": False,
}


@pytest.fixture
def long(settings: Settings) -> Settings:
    return Settings(cache_dir=settings.cache_dir, first_year=2001, last_year=2008, rate_limit_per_minute=1000)


def by_unit(reasoning: dict[str, Any]) -> dict[str, list[float]]:
    out: dict[str, list[float]] = {}
    for item in reasoning["evidence"]:
        out.setdefault(item["unit"], []).append(item["value"])
    return out


def test_reasoning_is_built_from_the_rotations_numbers(long: Settings) -> None:
    with make_client(long, FakeUpstream()) as c:
        body = c.post("/v1/rotations/explore", json=BODY).json()
    assert errors("RotationExploreResponse", body) == []
    awc = next(r for r in body["inputs"] if r["name"] == "soil.available_water_mm_per_m")
    for rank, rot in enumerate(body["rotations"], start=1):
        r = rot["reasoning"]
        assert errors("RotationReasoning", r) == []
        assert r["why_suggested"][0].startswith(f"Ranked {rank} of ")
        assert all("current rotation" not in s for s in r["why_suggested"] + r["benefits"])
        values = by_unit(r)
        assert values["mm"][0] == pytest.approx(sum(y["water_demand_mm"] for y in rot["yearly"]), abs=60)
        assert values["mm/m"] == [awc["value"]]
        assert all(item["dataset"] for item in r["evidence"])
        legume_credit = "kg N/ha" in values
        assert legume_credit == any("nitrogen credit" in s for s in r["benefits"])
        if not legume_credit:
            assert r["benefits"] == []  # nothing generic is written to fill the part
        assert any("SoilGrids prediction" in s for s in r["information_gaps"])
        assert any("No crop values" in s for s in r["information_gaps"])
        stressed = [y for y in rot["yearly"] if y["stress_index"] >= 0.5]
        flagged = [
            s for s in r["local_review"] if "check locally whether it is grown without irrigation" in s
        ]
        assert len(flagged) == len(stressed)
        assert "FAO-56 Table 11" in r["local_review"][-1]


def test_reasoning_follows_farmer_inputs_irrigation_and_baseline(long: Settings) -> None:
    values = {"lentil": 3.0, "barley": 1.0, "winter_wheat": 2.0}
    request = {
        **BODY,
        "irrigated": True,
        "crop_ids": list(values),
        "farmer_inputs": {"soil": {"available_water_mm_per_m": 150}, "crop_values": values},
        "current_rotation": ["winter_wheat"],
    }
    with make_client(long, FakeUpstream()) as c:
        en = c.post("/v1/rotations/explore", json=request).json()
        tr = c.post("/v1/rotations/explore", json={**request, "language": "tr"}).json()
    base = en["baseline"]
    assert base["reasoning"]["why_suggested"] == []  # the engine did not suggest the farmer's own rotation
    assert base["reasoning"]["benefits"] == []  # no legume, nothing to compare it with
    top = en["rotations"][0]["reasoning"]
    soil = next(item for item in top["evidence"] if item["unit"] == "mm/m")
    assert (soil["value"], soil["dataset"]) == (150.0, "Farmer's soil test")
    gaps = " ".join(top["information_gaps"])
    assert "SoilGrids" not in gaps
    assert "No crop values" not in gaps
    assert "water supply of this field" in gaps
    assert "current rotation's" in top["why_suggested"][-1]
    assert not any("grown without irrigation" in s for s in top["local_review"])
    turkish = tr["rotations"][0]["reasoning"]
    assert turkish["why_suggested"][0].startswith("Önceliklerinize göre")
    assert "Tablo 11" in turkish["local_review"][-1]
    assert [e["value"] for e in turkish["evidence"]] == [e["value"] for e in top["evidence"]]
