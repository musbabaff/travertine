from __future__ import annotations

from typing import Any

from tests.conftest import FakeUpstream, make_client
from tests.test_contract import errors
from travertine_engine.config import Settings

BODY: dict[str, Any] = {
    "lat": 37.89,
    "lon": 28.98,
    "horizon_years": 3,
    "priorities": {"water": 1, "income": 0, "soil": 0, "risk": 0},
    "irrigated": False,
}


def demand(body: dict[str, Any]) -> float:
    return sum(y["water_demand_mm"] for y in body["rotations"][0]["yearly"])


def test_scenario_recomputes_et0_and_the_water_balance(settings: Settings) -> None:
    long = Settings(cache_dir=settings.cache_dir, first_year=2001, last_year=2008, rate_limit_per_minute=1000)
    with make_client(long, FakeUpstream()) as c:
        plain = c.post("/v1/rotations/explore", json=BODY).json()
        same = c.post(
            "/v1/rotations/explore",
            json={**BODY, "scenario": {"precipitation_factor": 1.0, "temperature_change_c": 0.0}},
        ).json()
        hot_dry = c.post(
            "/v1/rotations/explore",
            json={**BODY, "scenario": {"precipitation_factor": 0.7, "temperature_change_c": 3.0}},
        ).json()
        tr = c.post(
            "/v1/rotations/explore",
            json={
                **BODY,
                "language": "tr",
                "scenario": {"precipitation_factor": 0.7, "temperature_change_c": 3.0},
            },
        ).json()
        bad = c.post(
            "/v1/rotations/explore",
            json={**BODY, "scenario": {"precipitation_factor": 3, "temperature_change_c": 0}},
        )
    assert errors("RotationExploreResponse", hot_dry) == []
    assert "scenario" not in plain
    assert same["rotations"] == plain["rotations"]
    assert "not a forecast" in hot_dry["scenario"]["label"]
    assert "tahmin değildir" in tr["scenario"]["label"]
    assert any(p["dataset"].startswith("Sensitivity test") for p in hot_dry["provenance"])
    seq = hot_dry["rotations"][0]["sequence"]
    plain_same = (
        next(r for r in plain["rotations"] if r["sequence"] == seq)
        if any(r["sequence"] == seq for r in plain["rotations"])
        else None
    )
    assert demand(hot_dry) > 0
    if plain_same is not None:
        assert sum(y["water_demand_mm"] for y in hot_dry["rotations"][0]["yearly"]) > sum(
            y["water_demand_mm"] for y in plain_same["yearly"]
        )
        assert hot_dry["rotations"][0]["scores"]["water"] < plain_same["scores"]["water"]
    assert bad.status_code == 422
