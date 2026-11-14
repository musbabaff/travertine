"""Every response the engine serves validates against packages/contract/openapi.yaml."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
import yaml
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from tests.conftest import FakeUpstream, make_client
from travertine_engine.config import Settings

SPEC_PATH = Path(__file__).resolve().parents[3] / "packages" / "contract" / "openapi.yaml"
FIXTURES = SPEC_PATH.parent / "fixtures"

if not SPEC_PATH.exists():  # pragma: no cover - the engine image is built without the contract package
    pytest.skip("contract package not available", allow_module_level=True)

SPEC: dict[str, Any] = yaml.safe_load(SPEC_PATH.read_text(encoding="utf-8"))
REGISTRY: Registry[Any] = Registry().with_resource(
    "spec",
    Resource.from_contents(
        {"$schema": "https://json-schema.org/draft/2020-12/schema", "components": SPEC["components"]}
    ),
)


def errors(schema_name: str, data: Any) -> list[str]:
    validator = Draft202012Validator({"$ref": f"spec#/components/schemas/{schema_name}"}, registry=REGISTRY)
    return [f"{list(e.path)}: {e.message}" for e in validator.iter_errors(data)]


def test_health(client: TestClient) -> None:
    r = client.get("/v1/health")
    assert r.status_code == 200
    assert errors("Health", r.json()) == []


def test_crops(client: TestClient) -> None:
    r = client.get("/v1/crops")
    assert r.status_code == 200
    body = r.json()
    assert len(body) >= 10
    for crop in body:
        assert errors("Crop", crop) == []


def test_field_analyze_with_contract_request_fixture(client: TestClient) -> None:
    request = (FIXTURES / "field-analyze.request.json").read_text(encoding="utf-8")
    r = client.post("/v1/field/analyze", content=request, headers={"content-type": "application/json"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert errors("FieldAnalysis", body) == []
    assert [y["year"] for y in body["climate"]] == [2001, 2002, 2003, 2004]
    assert len(body["provenance"]) == 3  # POWER, SoilGrids, MODIS
    assert "model-based" in body["provenance"][0]["note"]


def test_error_bodies_follow_contract(client: TestClient) -> None:
    r = client.post("/v1/field/analyze", json={"lat": 120, "lon": 0, "irrigated": False})
    assert r.status_code == 422
    assert errors("Error", r.json()) == []
    assert r.json()["code"] == "invalid_request"


def test_rotations_explore(settings: Settings) -> None:
    long = Settings(cache_dir=settings.cache_dir, first_year=2001, last_year=2008, rate_limit_per_minute=1000)
    request = json.loads((FIXTURES / "rotations-explore.request.json").read_text(encoding="utf-8"))
    request.pop("field_id")
    request.update(lat=37.89, lon=28.98)
    assert errors("RotationExploreRequest", request) == []
    with make_client(long, FakeUpstream()) as c:
        r = c.post("/v1/rotations/explore", json=request)
    assert r.status_code == 200, r.text
    body = r.json()
    assert errors("RotationExploreResponse", body) == []
    totals = [rot["scores"]["total"] for rot in body["rotations"]]
    assert totals == sorted(totals, reverse=True)
    for rot in body["rotations"]:
        assert len(rot["sequence"]) == request["horizon_years"]
        assert [y["crop_id"] for y in rot["yearly"]] == rot["sequence"]
        assert rot["explanation"]
    assert any("no price" in p["note"] for p in body["provenance"])


def test_rotations_explore_errors(settings: Settings) -> None:
    with make_client(settings, FakeUpstream()) as c:
        base = {
            "horizon_years": 3,
            "priorities": {"water": 1, "income": 0, "soil": 0, "risk": 0},
            "irrigated": False,
        }
        missing = c.post("/v1/rotations/explore", json=base)
        unknown = c.post(
            "/v1/rotations/explore", json={**base, "lat": 37.89, "lon": 28.98, "crop_ids": ["rice"]}
        )
        no_legume = c.post(
            "/v1/rotations/explore",
            json={**base, "lat": 37.89, "lon": 28.98, "crop_ids": ["maize", "winter_wheat"]},
        )
        bad_id = c.post("/v1/rotations/explore", json={**base, "field_id": "fld_denizli_demo"})
    for r in (missing, unknown, no_legume, bad_id):
        assert r.status_code == 422, r.text
        assert errors("Error", r.json()) == []


def test_validation(settings: Settings) -> None:
    long = Settings(cache_dir=settings.cache_dir, first_year=2001, last_year=2012, rate_limit_per_minute=1000)
    with make_client(long, FakeUpstream(varying_rain=True)) as c:
        r = c.get("/v1/validation", params={"lat": 37.89, "lon": 28.98})
    assert r.status_code == 200, r.text
    assert errors("Validation", r.json()) == []


def test_field_analyze_with_ndvi(client: TestClient) -> None:
    body = client.post("/v1/field/analyze", json={"lat": 37.89, "lon": 28.98, "irrigated": False}).json()
    assert body["ndvi_history"]
    assert errors("FieldAnalysis", body) == []
