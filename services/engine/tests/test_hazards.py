from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd

from tests.conftest import FakeUpstream, make_client
from tests.test_contract import errors
from travertine_engine.config import Settings
from travertine_engine.hazards import _longest_run, hazard_years


def test_indices_on_a_constructed_year() -> None:
    days = pd.date_range("2010-01-01", "2010-12-31", freq="D")
    tn = np.full(len(days), 5.0)
    tn[[10, 100, 300]] = -1.0  # frost on 11 Jan, 11 Apr, 28 Oct
    tx = np.full(len(days), 20.0)
    tx[180:190] = 30.0
    rr = np.zeros(len(days))
    rr[[50, 51]] = [12.0, 25.0]
    df = pd.DataFrame({"T2M_MIN": tn, "T2M_MAX": tx, "PRECTOTCORR": rr}, index=days)
    (row,) = hazard_years(df, [2010], northern=True)
    assert row.frost_days == 3
    assert row.last_spring_frost == "2010-04-11"
    assert row.first_autumn_frost == "2010-10-28"
    assert row.frost_free_days == (date(2010, 10, 28) - date(2010, 4, 11)).days - 1
    assert row.summer_days == 10
    assert row.txx_c == 30.0
    assert (row.r10mm_days, row.r20mm_days, row.rx1day_mm) == (2, 1, 25.0)
    assert row.cdd_days == len(days) - 52
    assert _longest_run(np.array([True, True, False, True])) == 2


def test_hazard_and_calendar_endpoints(settings: Settings) -> None:
    with make_client(settings, FakeUpstream()) as c:
        hz = c.get("/v1/field/hazards", params={"lat": 37.89, "lon": 28.98})
        cal = c.post(
            "/v1/field/calendar", json={"lat": 37.89, "lon": 28.98, "sequence": ["winter_wheat", "maize"]}
        )
        tr = c.post(
            "/v1/field/calendar",
            json={"lat": 37.89, "lon": 28.98, "sequence": ["winter_wheat", "maize"], "language": "tr"},
        )
        bad = c.post("/v1/field/calendar", json={"lat": 37.89, "lon": 28.98, "sequence": ["rice"]})
    assert hz.status_code == 200, hz.text
    assert errors("FieldHazards", hz.json()) == []
    assert cal.status_code == 200, cal.text
    body = cal.json()
    assert errors("FieldCalendar", body) == []
    assert [s["sowing"] for s in body["seasons"]] == ["11-15", "04-15"]
    # wheat harvested 12 July, maize sown 15 April of the next agricultural year; maize harvested 11 September,
    # wheat sown 15 November of the next cycle
    assert [(b["start"], b["end"]) for b in body["bare_periods"]] == [("07-13", "04-14"), ("09-12", "11-14")]
    assert {m["month"] for m in body["months"] if m["crop_id"] == "maize"} == {4, 5, 6, 7, 8, 9}
    assert tr.json()["months"] == body["months"]
    assert tr.json()["caveats"][0].startswith("Paylar")
    assert bad.status_code == 422
