"""Provenance and notes follow `language`, with the same numbers in both languages."""

from __future__ import annotations

import re
from dataclasses import replace
from typing import Any

import pytest

from tests.conftest import FakeUpstream, make_client
from tests.test_validation import LONG
from travertine_engine import prov_text
from travertine_engine.config import Settings

LOCALIZED = ("spatial_resolution", "temporal_coverage", "note")
DEMO = {"lat": 37.89, "lon": 28.98}
NUMBER = re.compile(r"[-+−]?\d+(?:[.,]\d+)?")


def numbers(text: str, lang: str) -> list[float]:
    """Every number in a sentence, read with the language's decimal comma and thousands space."""
    if lang == "tr":
        text = re.sub(r"(\d)[  ](\d{3})(?!\d)", r"", text)
    out = []
    for raw in NUMBER.findall(text):
        s = raw.replace("−", "-")
        s = s.replace(",", ".") if lang == "tr" else s.replace(",", "")
        out.append(float(s))
    return sorted(out)


def same_facts(en: list[dict[str, Any]], tr: list[dict[str, Any]]) -> None:
    assert len(en) == len(tr)
    for a, b in zip(en, tr, strict=True):
        assert a["access_url"] == b["access_url"]
        for field in LOCALIZED:
            assert numbers(a[field], "en") == numbers(b[field], "tr"), (
                a["dataset"],
                field,
                a[field],
                b[field],
            )
        if a["provider"].startswith("Travertine"):
            assert b["dataset"] != a["dataset"] or not a["dataset"].startswith("Travertine")
        else:
            assert a["dataset"] == b["dataset"]
            assert a["provider"] == b["provider"]


def english_left(items: list[dict[str, Any]]) -> list[str]:
    english = re.compile(
        r"\b(the|and|of|with|daily|not spatial|field point|published|static|predictions)\b", re.I
    )
    found = []
    for p in items:
        for field in LOCALIZED:
            text = p[field]
            for name in (
                "MERRA-2",
                "CERES SYN1deg",
                "Penman-Monteith",
                "Saxton & Rawls",
                "Soil Sci. Soc. Am. J.",
            ):
                text = text.replace(name, "")
            if english.search(text):
                found.append(f"{p['dataset']} / {field}: {p[field][:80]}")
    return found


@pytest.mark.parametrize(
    ("path", "params"),
    [
        ("/v1/field/climate", DEMO),
        ("/v1/field/soil", DEMO),
        ("/v1/field/vegetation", DEMO),
        ("/v1/field/hazards", DEMO),
    ],
)
def test_get_endpoints(settings: Settings, path: str, params: dict[str, float]) -> None:
    cfg = replace(settings, last_year=2008)
    with make_client(cfg, FakeUpstream(varying_rain=True)) as c:
        en = c.get(path, params=params).json()
        tr = c.get(path, params={**params, "language": "tr"}).json()
        assert c.get(path, params={**params, "language": "de"}).status_code == 422
    same_facts(en["provenance"], tr["provenance"])
    assert english_left(tr["provenance"]) == []
    if "caveats" in en:
        assert len(en["caveats"]) == len(tr["caveats"])


def test_validation(settings: Settings) -> None:
    cfg = Settings(cache_dir=settings.cache_dir, **LONG)
    with make_client(cfg, FakeUpstream(varying_rain=True, cloudy_year=2007)) as c:
        en = c.get("/v1/validation", params=DEMO).json()
        tr = c.get("/v1/validation", params={**DEMO, "language": "tr"}).json()
    same_facts(en["provenance"], tr["provenance"])
    assert english_left(tr["provenance"]) == []


def test_hazard_notes_are_translated(settings: Settings) -> None:
    with make_client(replace(settings, last_year=2008), FakeUpstream()) as c:
        tr = c.get("/v1/field/hazards", params={**DEMO, "language": "tr"}).json()
    assert tr["caveats"] == prov_text.hazard_caveats("tr", southern=False)


def test_explore_and_analyze(settings: Settings, fake: FakeUpstream) -> None:
    body = {
        **DEMO,
        "horizon_years": 3,
        "irrigated": False,
        "priorities": {"water": 1, "income": 0, "soil": 0, "risk": 0},
    }
    with make_client(replace(settings, last_year=2008), fake) as c:
        en = c.post("/v1/rotations/explore", json=body).json()
        tr = c.post("/v1/rotations/explore", json={**body, "language": "tr"}).json()
        a_en = c.post("/v1/field/analyze", json={**DEMO, "irrigated": False}).json()
        a_tr = c.post("/v1/field/analyze", json={**DEMO, "irrigated": False, "language": "tr"}).json()
    same_facts(en["provenance"], tr["provenance"])
    same_facts(a_en["provenance"], a_tr["provenance"])
    assert english_left(tr["provenance"]) == []
    scoring = next(p for p in tr["provenance"] if p["provider"] == "Travertine motoru")
    assert scoring["dataset"] == "Travertine nöbet geriye dönük testi ve puanlaması"
    assert scoring["spatial_resolution"].startswith("Tarla noktası")
    assert any(p["spatial_resolution"].startswith("Mekânsal değil") for p in tr["provenance"])
    assert any(p["temporal_coverage"].endswith("günlük") for p in tr["provenance"])


def test_turkish_numbers_use_a_decimal_comma() -> None:
    assert "0,5° × 0,625°" in prov_text.power_resolution("tr")
    note = prov_text.soilgrids_note("tr", clay=(21.0, 38.0), soc=(9.4, 17.25))
    assert "9,4–17,2" in note or "9,4–17,3" in note
    assert numbers(prov_text.soilgrids_note("en", clay=(21.0, 38.0), soc=(9.4, 17.25)), "en") == numbers(
        note, "tr"
    )
