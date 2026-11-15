from __future__ import annotations

import json

from tests.conftest import FakeUpstream, make_client
from travertine_engine.config import Settings
from travertine_engine.showcase import RESULTS, load_showcase

DEMO = {"lat": 37.89, "lon": 28.98}


def test_sections_match_the_full_analysis(settings: Settings, fake: FakeUpstream) -> None:
    with make_client(settings, fake) as c:
        full = c.post("/v1/field/analyze", json={**DEMO, "irrigated": False}).json()
        climate = c.get("/v1/field/climate", params=DEMO).json()
        soil = c.get("/v1/field/soil", params=DEMO).json()
        vegetation = c.get("/v1/field/vegetation", params=DEMO).json()
    assert climate["field_id"] == full["field_id"]
    assert climate["climate"] == full["climate"]
    assert soil["soil"] == full["soil"]
    assert vegetation["ndvi_history"] == full["ndvi_history"]
    assert [*climate["provenance"], *soil["provenance"], *vegetation["provenance"]] == full["provenance"]


def test_climate_starts_soil_and_vegetation_in_the_background(settings: Settings, fake: FakeUpstream) -> None:
    with make_client(settings, fake) as c:
        assert c.get("/v1/field/climate", params=DEMO).status_code == 200
        service = c.app.state.fields  # type: ignore[attr-defined]
        c.portal.call(_drain, service)  # type: ignore[union-attr]
        before = len(fake.calls)
        assert c.get("/v1/field/soil", params=DEMO).status_code == 200
        assert c.get("/v1/field/vegetation", params=DEMO).status_code == 200
    assert len(fake.calls) == before  # both were already in the cache


async def _drain(service: object) -> None:
    import asyncio  # noqa: PLC0415

    tasks = list(service._prefetching)  # type: ignore[attr-defined]
    await asyncio.gather(*tasks)


def test_vegetation_outage_is_a_typed_502(settings: Settings) -> None:
    with make_client(settings, FakeUpstream(modis_fails=True)) as c:
        r = c.get("/v1/field/vegetation", params=DEMO)
        climate = c.get("/v1/field/climate", params=DEMO)
    assert r.status_code == 502
    assert r.json()["code"] == "upstream_unavailable"
    assert climate.status_code == 200


def test_showcase_reports_the_committed_results(client: object) -> None:
    raw = json.loads(RESULTS.read_text(encoding="utf-8"))
    body = client.get("/v1/showcase").json()  # type: ignore[attr-defined]
    assert [f["id"] for f in body["fields"]] == [s["id"] for s in raw["sites"]]
    for field, site in zip(body["fields"], raw["sites"], strict=True):
        v = field["validation"]
        if site["status"] == "ok":
            assert v["correlation"] == site["model_r"]
            assert v["difference_ci95"] == site["difference_ci95"]
            lo, hi = site["difference_ci95"]
            assert v["verdict"] == (
                "model_better" if hi < 0 else "baseline_better" if lo > 0 else "no_detectable_difference"
            )
        else:
            assert v == {"status": "not_computed", "reason": site["message"]}
    assert body["pooled"]["mean_difference_ci95"] == raw["pooled"]["mean_difference_ci95"]
    assert load_showcase().computed_at == raw["computed_at"]
