from __future__ import annotations

from travertine_engine import text
from travertine_engine.science.crops import load_crops


def test_turkish_numbers_use_comma_space_and_leading_percent() -> None:
    assert text.num(1234.5, 1, "tr") == "1 234,5"
    assert text.num(1234.5, 1, "en") == "1234.5"
    assert text.num(-0.66, 2, "tr", sign=True) == "-0,66"
    assert text.num(0.03, 2, "tr", sign=True) == "+0,03"
    assert text.pct(0.04, "tr") == "%4"
    assert text.pct(0.04, "en") == "4 %"
    assert text.interval((-0.85, -0.43), "tr") == "-0,85 ile -0,43 arası"


def test_every_crop_has_a_turkish_name() -> None:
    assert {c.id for c in load_crops()} <= text.CROP_NAMES_TR.keys()


def test_verdict_wording_matches_the_interval() -> None:
    for lang in ("en", "tr"):
        assert text.verdict((-0.3, -0.1), lang) != text.verdict((-0.1, 0.1), lang)
    assert "not established" in text.verdict((-0.1, 0.1))
    assert "ortaya konmuş değil" in text.verdict((-0.1, 0.1), "tr")
