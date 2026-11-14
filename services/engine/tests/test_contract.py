"""Every response the engine serves validates against packages/contract/openapi.yaml."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
import yaml
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

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
    assert len(body["provenance"]) == 2
    assert "model-based" in body["provenance"][0]["note"]


def test_error_bodies_follow_contract(client: TestClient) -> None:
    r = client.post("/v1/field/analyze", json={"lat": 120, "lon": 0, "irrigated": False})
    assert r.status_code == 422
    assert errors("Error", r.json()) == []
    assert r.json()["code"] == "invalid_request"
