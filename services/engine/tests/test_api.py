from __future__ import annotations

from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from tests.conftest import FakeUpstream, make_client
from travertine_engine.config import Settings
from travertine_engine.errors import InvalidRequest
from travertine_engine.field import make_field_id, parse_field_id
from travertine_engine.ratelimit import RateLimiter

DEMO = {"lat": 37.89, "lon": 28.98, "irrigated": False}


def test_second_call_is_served_from_cache(client: TestClient, fake: FakeUpstream) -> None:
    assert client.post("/v1/field/analyze", json=DEMO).status_code == 200
    calls = len(fake.calls)
    assert client.post("/v1/field/analyze", json=DEMO).status_code == 200
    assert len(fake.calls) == calls


def test_soil_failure_falls_back_to_labelled_default(settings: Settings) -> None:
    with make_client(settings, FakeUpstream(soil_fails=True)) as c:
        r = c.post("/v1/field/analyze", json=DEMO)
    assert r.status_code == 200
    soil_prov = r.json()["provenance"][1]
    assert soil_prov["dataset"].startswith("DEFAULT SOIL")
    assert "NOT data for this field" in soil_prov["note"]


def test_power_failure_is_a_typed_502(settings: Settings) -> None:
    with make_client(settings, FakeUpstream(power_fails=True)) as c:
        r = c.post("/v1/field/analyze", json=DEMO)
    assert r.status_code == 502
    assert r.json()["code"] == "upstream_unavailable"


def test_request_id_is_echoed(client: TestClient) -> None:
    r = client.get("/v1/health", headers={"X-Request-ID": "abc123"})
    assert r.headers["X-Request-ID"] == "abc123"
    assert len(client.get("/v1/health").headers["X-Request-ID"]) == 32


def test_rate_limit_returns_429(settings: Settings) -> None:
    tight = Settings(cache_dir=settings.cache_dir, first_year=2001, last_year=2001, rate_limit_per_minute=2)
    with make_client(tight, FakeUpstream()) as c:
        codes = [c.get("/v1/crops").status_code for _ in range(4)]
        assert c.get("/v1/health").status_code == 200
    assert codes[:2] == [200, 200]
    assert codes[2] == 429


def test_rate_limiter_refills() -> None:
    limiter = RateLimiter(60)
    for _ in range(60):
        assert limiter.allow("a", now=0.0)[0]
    assert not limiter.allow("a", now=0.0)[0]
    assert limiter.allow("a", now=1.01)[0]


def test_field_id_round_trip() -> None:
    fid = make_field_id(37.89, -28.98)
    assert parse_field_id(fid) == (37.89, -28.98)
    with pytest.raises(InvalidRequest):
        parse_field_id("fld_denizli_demo")


def test_cors_allows_configured_origin(settings: Settings) -> None:
    with make_client(settings, FakeUpstream()) as c:
        r = c.options(
            "/v1/crops",
            headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
        )
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_cors_allows_listed_and_preview_origins(settings: Settings, fake: FakeUpstream) -> None:
    regex = r"^https://travertine-[a-z0-9-]+-musbabaffs-projects\.vercel\.app$"
    cfg = replace(settings, cors_origins=["https://travertine-bice.vercel.app"], cors_origin_regex=regex)
    with make_client(cfg, fake) as c:

        def preflight(origin: str) -> str | None:
            r = c.options(
                "/v1/field/analyze",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "content-type",
                },
            )
            allowed = r.headers.get("access-control-allow-origin")
            return None if allowed is None else str(allowed)

        assert preflight("https://travertine-bice.vercel.app") == "https://travertine-bice.vercel.app"
        preview = "https://travertine-git-web-explore-musbabaffs-projects.vercel.app"
        assert preflight(preview) == preview
        assert preflight("https://travertine-evil.vercel.app") is None
        assert preflight("https://travertine-x-musbabaffs-projects.vercel.app.evil.com") is None
