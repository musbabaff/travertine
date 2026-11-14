from __future__ import annotations

from travertine_engine.science.crops import load_crops


def test_crop_table_loads_and_is_complete() -> None:
    crops = load_crops()
    assert 10 <= len(crops) <= 14
    for c in crops:
        assert c.growing_days == c.stages.ini + c.stages.dev + c.stages.mid + c.stages.late
        for text in (c.sources.stages, c.sources.kc, c.sources.root_depth, c.sources.p, c.sources.ky):
            assert text.strip()
        assert "FAO-56" in c.sources.kc
        assert "Table 11" in c.sources.stages
        assert "Table 22" in c.sources.root_depth
        if c.ky is not None:
            assert "Table 24" in c.sources.ky


def test_crop_table_covers_rotation_needs() -> None:
    crops = load_crops()
    seasons = {c.season for c in crops}
    assert {"winter", "summer"} <= seasons
    assert any(c.is_legume and c.season == "winter" for c in crops)
    assert any(c.is_legume and c.season == "summer" for c in crops)
    assert all(c.is_legume == (c.family == "Fabaceae") for c in crops)


def test_values_match_fao56_tables_spot_check() -> None:
    by_id = {c.id: c for c in load_crops()}
    wheat = by_id["winter_wheat"]
    assert (wheat.kc.ini, wheat.kc.mid, wheat.kc.end) == (0.70, 1.15, 0.25)
    assert wheat.growing_days == 240
    maize = by_id["maize"]
    assert (maize.kc.ini, maize.kc.mid, maize.kc.end, maize.p, maize.ky) == (0.30, 1.20, 0.35, 0.55, 1.25)
    assert by_id["cotton"].p == 0.65
    assert "chickpea" not in by_id
