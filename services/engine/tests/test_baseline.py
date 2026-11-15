"""The farmer's current rotation as the baseline of /v1/rotations/explore."""

from __future__ import annotations

from itertools import product
from typing import Any

import pytest

from tests.conftest import FakeUpstream, make_client
from tests.test_contract import errors
from travertine_engine.config import Settings
from travertine_engine.science.crops import crops_by_id, load_crops
from travertine_engine.science.rotations import compatible, rule_violations, valid_sequence

BODY: dict[str, Any] = {
    "lat": 37.89,
    "lon": 28.98,
    "horizon_years": 3,
    "priorities": {"water": 0.8, "income": 0.5, "soil": 0.6, "risk": 0.4},
    "irrigated": False,
}
SCORES = ("water", "income", "soil", "risk", "total")


@pytest.fixture
def long(settings: Settings) -> Settings:
    return Settings(cache_dir=settings.cache_dir, first_year=2001, last_year=2008, rate_limit_per_minute=1000)


def test_violations_are_empty_exactly_for_valid_sequences() -> None:
    crops = load_crops()
    for seq in product(crops, repeat=3):
        assert (not rule_violations(seq)) == valid_sequence(seq), [c.id for c in seq]


def test_only_the_family_rule_makes_a_pair_incompatible() -> None:
    """No two crops have overlapping seasons, so every sequence can be simulated one crop per agricultural year."""
    for prev, crop in product(load_crops(), repeat=2):
        if not compatible(prev, crop):
            assert prev.family == crop.family


def test_violations_name_rule_and_year() -> None:
    c = crops_by_id()
    found = rule_violations([c["winter_wheat"], c["barley"], c["alfalfa"], c["maize"]])
    assert [(v.rule, v.year_index) for v in found] == [
        ("same_family_in_consecutive_years", 2),
        ("perennial_single_year", 3),
    ]
    assert [v.rule for v in rule_violations([c["cotton"], c["maize"]])] == ["no_legume_in_cycle"]
    assert rule_violations([c["alfalfa"], c["alfalfa"], c["maize"]]) == []


def test_rule_breaking_rotation_is_scored_and_compared(long: Settings) -> None:
    with make_client(long, FakeUpstream()) as c:
        r = c.post("/v1/rotations/explore", json={**BODY, "current_rotation": ["winter_wheat"]})
        tr = c.post(
            "/v1/rotations/explore", json={**BODY, "current_rotation": ["winter_wheat"], "language": "tr"}
        )
    assert r.status_code == 200, r.text
    body = r.json()
    assert errors("RotationExploreResponse", body) == []
    assert errors("BaselineRotation", {**body["baseline"], "rule_violations": [{"rule": "other"}]}) != []
    base = body["baseline"]
    assert base["sequence"] == ["winter_wheat"] * 3
    assert [y["crop_id"] for y in base["yearly"]] == base["sequence"]
    assert [(v["rule"], v.get("year_index")) for v in base["rule_violations"]] == [
        ("same_family_in_consecutive_years", 2),
        ("same_family_in_consecutive_years", 3),
        ("no_legume_in_cycle", None),
    ]
    assert "repeated to fill 3 years" in base["explanation"][0]
    assert "vs_baseline" not in base
    assert len(body["rotations"]) >= 2  # with the baseline: at least three strategies
    for rot in body["rotations"]:
        for name in SCORES:
            assert rot["vs_baseline"][name] == pytest.approx(
                rot["scores"][name] - base["scores"][name], abs=1e-9
            )
    assert "baseline" in body["provenance"][-1]["note"]
    turkish = tr.json()["baseline"]
    assert turkish["scores"] == base["scores"]
    assert "Poaceae familyasından" in turkish["rule_violations"][0]["message"]


def test_valid_current_rotation_scores_like_the_same_candidate(long: Settings) -> None:
    """The baseline goes through its own segment table; it must land on the scores the candidate table gives."""
    with make_client(long, FakeUpstream()) as c:
        plain = c.post("/v1/rotations/explore", json=BODY).json()
        best = plain["rotations"][0]
        again = c.post("/v1/rotations/explore", json={**BODY, "current_rotation": best["sequence"]}).json()
    assert "baseline" not in plain
    assert all("vs_baseline" not in rot for rot in plain["rotations"])
    base = again["baseline"]
    assert base["rule_violations"] == []
    assert base["scores"] == best["scores"]
    assert base["yearly"] == best["yearly"]
    assert base["explanation"][1:] == best["explanation"]
    assert best["sequence"] not in [rot["sequence"] for rot in again["rotations"]]
    assert again["rotations"][0]["sequence"] == plain["rotations"][1]["sequence"]


def test_current_rotation_errors(long: Settings) -> None:
    with make_client(long, FakeUpstream()) as c:
        unknown = c.post("/v1/rotations/explore", json={**BODY, "current_rotation": ["rice"]})
        too_long = c.post("/v1/rotations/explore", json={**BODY, "current_rotation": ["maize"] * 4})
        empty = c.post("/v1/rotations/explore", json={**BODY, "current_rotation": []})
    for r in (unknown, too_long, empty):
        assert r.status_code == 422, r.text
    assert unknown.json()["details"]["unknown"] == ["rice"]


def test_baseline_uses_the_farmers_soil_test_and_crop_values(long: Settings) -> None:
    values = {c.id: 1.0 + i for i, c in enumerate(load_crops())}
    farmer = {"soil": {"sand_pct": 20, "clay_pct": 45}, "crop_values": values}
    body = {**BODY, "farmer_inputs": farmer}
    with make_client(long, FakeUpstream()) as c:
        plain = c.post("/v1/rotations/explore", json=body).json()
        best = plain["rotations"][0]
        again = c.post("/v1/rotations/explore", json={**body, "current_rotation": best["sequence"]}).json()
        unvalued = c.post(
            "/v1/rotations/explore",
            json={
                **BODY,
                "crop_ids": ["lentil", "barley"],
                "farmer_inputs": {"crop_values": {"lentil": 2, "barley": 1}},
                "current_rotation": ["cotton"],
            },
        )
    assert again["baseline"]["scores"] == best["scores"]
    assert again["baseline"]["yearly"] == best["yearly"]
    assert unvalued.status_code == 422
    assert unvalued.json()["details"]["missing"] == ["cotton"]
