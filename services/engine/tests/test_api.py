from __future__ import annotations

import asyncio
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from tests.conftest import FakeUpstream, make_client
from travertine_engine import explore
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


def test_explore_ranking_does_not_depend_on_chunk_size(
    settings: Settings, fake: FakeUpstream, monkeypatch: pytest.MonkeyPatch
) -> None:
    long = replace(settings, last_year=2008)
    body = {
        "lat": 37.89,
        "lon": 28.98,
        "horizon_years": 3,
        "priorities": {"water": 0.8, "income": 0.4, "soil": 0.6, "risk": 0.5},
        "irrigated": False,
    }
    results = []
    for chunk in (10_000, 7):
        monkeypatch.setattr(explore, "CHUNK", chunk)
        with make_client(long, fake) as c:
            r = c.post("/v1/rotations/explore", json=body)
        assert r.status_code == 200, r.text
        results.append(r.json()["rotations"])
    assert results[0] == results[1]


def test_candidate_scores_are_reused_across_priorities(
    settings: Settings, fake: FakeUpstream, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = []
    original = explore.score_candidates

    def counting(*args: object) -> explore.CandidateScores:
        calls.append(args[2])
        return original(*args)  # type: ignore[arg-type]

    monkeypatch.setattr(explore, "score_candidates", counting)
    long = replace(settings, last_year=2008)
    base = {"lat": 37.89, "lon": 28.98, "horizon_years": 3, "irrigated": False}
    with make_client(long, fake) as c:
        a = c.post(
            "/v1/rotations/explore",
            json={**base, "priorities": {"water": 1, "income": 0, "soil": 0, "risk": 0}},
        )
        b = c.post(
            "/v1/rotations/explore",
            json={**base, "priorities": {"water": 0, "income": 0, "soil": 1, "risk": 0}},
        )
    assert a.status_code == b.status_code == 200
    assert calls == [3]
    assert a.json()["rotations"] != b.json()["rotations"]


def test_warm_fields_setting_parses_points(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENGINE_WARM_FIELDS", "37.89,28.98; 40.1,-88.2")
    assert Settings.from_env().warm_fields == [(37.89, 28.98), (40.1, -88.2)]


def test_daily_climate_is_computed_once_per_location(settings: Settings, fake: FakeUpstream) -> None:
    with make_client(settings, fake) as c:
        service = c.app.state.fields  # type: ignore[attr-defined]
        first = c.portal.call(service.daily_climate, 37.89, 28.98)  # type: ignore[union-attr]
        again = c.portal.call(service.daily_climate, 37.8901, 28.9799)  # type: ignore[union-attr]
    assert again[0] is first[0]


def test_explore_explanations_follow_language(settings: Settings, fake: FakeUpstream) -> None:
    long = replace(settings, last_year=2008)
    body = {
        **DEMO,
        "horizon_years": 3,
        "priorities": {"water": 0.4, "income": 0.2, "soil": 0.2, "risk": 0.2},
    }
    with make_client(long, fake) as c:
        en = c.post("/v1/rotations/explore", json=body).json()
        tr = c.post("/v1/rotations/explore", json={**body, "language": "tr"}).json()
        bad = c.post("/v1/rotations/explore", json={**body, "language": "de"})
    assert bad.status_code == 422
    for a, b in zip(en["rotations"], tr["rotations"], strict=True):
        worded = ("explanation", "reasoning")
        assert {k: v for k, v in a.items() if k not in worded} == {
            k: v for k, v in b.items() if k not in worded
        }
        numbers_en = [(e["value"], e["unit"], e["dataset"]) for e in a["reasoning"]["evidence"]]
        numbers_tr = [(e["value"], e["unit"], e["dataset"]) for e in b["reasoning"]["evidence"]]
        assert numbers_en == numbers_tr
        assert {k: len(v) for k, v in a["reasoning"].items()} == {
            k: len(v) for k, v in b["reasoning"].items()
        }
        assert len(a["explanation"]) == len(b["explanation"])
        assert b["explanation"][0].startswith("Kayıttaki ")
    assert en["provenance"] == tr["provenance"]


def test_health_version_carries_the_deployed_commit(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("ENGINE_COMMIT", raising=False)
    monkeypatch.delenv("RENDER_GIT_COMMIT", raising=False)
    assert client.get("/v1/health").json()["version"] == "0.1.0"
    monkeypatch.setenv("RENDER_GIT_COMMIT", "69B6D7B0c1af4f6b325a97f9d6a5c1af4f6b325a")
    assert client.get("/v1/health").json()["version"] == "0.1.0+69b6d7b"
    monkeypatch.setenv("ENGINE_COMMIT", "not a commit")
    assert client.get("/v1/health").json()["version"] == "0.1.0+69b6d7b"


def test_warm_showcase_setting(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENGINE_WARM_SHOWCASE", "1")
    assert Settings.from_env().warm_showcase
    monkeypatch.setenv("ENGINE_WARM_SHOWCASE", "")
    assert not Settings.from_env().warm_showcase


def test_showcase_fields_are_warmed_at_three_years_only(monkeypatch: pytest.MonkeyPatch) -> None:
    from travertine_engine.main import warm_fields  # noqa: PLC0415

    calls: list[tuple[float, float, tuple[int, ...]]] = []

    class Recorder:
        async def warm(self, lat: float, lon: float, horizons: tuple[int, ...]) -> None:
            calls.append((lat, lon, horizons))

    asyncio.run(warm_fields(Recorder(), [(37.89, 28.98)], [(37.89, 28.98), (38.65, 32.93)]))  # type: ignore[arg-type]
    assert calls == [(37.89, 28.98, (3, 4, 5)), (38.65, 32.93, (3,))]
