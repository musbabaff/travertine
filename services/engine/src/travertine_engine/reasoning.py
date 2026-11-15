"""Structured reasoning for one rotation strategy: why it was suggested, the evidence, possible benefits, information
gaps and what needs local review.

Every sentence is built from numbers of the strategy at hand. A part stays empty when there is nothing specific to
say; nothing generic is added to fill it. The tool supports the farmer's judgment and local expertise and does not
replace them.
"""

from __future__ import annotations

from dataclasses import dataclass

from travertine_engine import text
from travertine_engine.models import (
    EvidenceItem,
    InputSource,
    Priorities,
    RotationReasoning,
    RotationScores,
    RotationYear,
)
from travertine_engine.science.crops import CropParams
from travertine_engine.science.rotations import SoilIndicators
from travertine_engine.text import Language, crop_name

STRONG_SHARE = (
    0.75  # a score is named as a reason when it is higher than that of this share of the candidates
)
HIGH_STRESS = (
    0.5  # median share of a crop's demand left unmet above which the crop is flagged for local review
)
PULSES_WITH_BORROWED_CREDIT = ("lentil", "faba_bean")  # A3517 pea and dry bean value, see crops.yaml

DATASET_DEMAND = "NASA POWER daily meteorology (FAO-56 Penman-Monteith ET0) with FAO-56 crop coefficients"
DATASET_BALANCE = "NASA POWER daily precipitation and ET0, FAO-56 chapter 8 soil water balance"
DATASET_NITROGEN = "UW-Extension A3517 (Bundy, Kelling & Ward Good 1997), Midwest US rotation trials"
DATASET_SOIL = {
    "farmer": "Farmer's soil test",
    "dataset": "SoilGrids 2.0 (ISRIC), 250 m prediction",
    "default": "Engine default soil (generic loam, not measured)",
}
AWC_RECORD = "soil.available_water_mm_per_m"


@dataclass(frozen=True, slots=True)
class Facts:
    """The numbers of one strategy that its sentences are built from."""

    seq: list[CropParams]
    yearly: list[RotationYear]
    windows: int
    demand_mm: float  # median over windows of the rotation's total crop water demand
    deficit_mm: (
        float  # median over windows of the unmet demand (rain-fed) or irrigation requirement (irrigated)
    )
    worst_crop: CropParams
    worst_ag_year: int
    worst_unmet: float
    indicators: SoilIndicators


@dataclass(frozen=True, slots=True)
class Context:
    """What is the same for every strategy of one request."""

    lang: Language
    irrigated: bool
    priorities: Priorities
    awc: InputSource | None  # the available-water record of the response's inputs[]
    crop_values_given: bool
    n_ranked: int  # rotations in the ranking


def _names(crops: list[CropParams], lang: Language) -> list[str]:
    return list(dict.fromkeys(crop_name(c.id, c.name, lang) for c in crops))


def _evidence(ctx: Context, f: Facts) -> list[EvidenceItem]:
    lang = ctx.lang
    worst = crop_name(f.worst_crop.id, f.worst_crop.name, lang)
    season = f"{f.worst_ag_year - 1}/{f.worst_ag_year}"
    items = [
        EvidenceItem(
            statement=text.evidence_demand(lang, windows=f.windows),
            value=round(f.demand_mm, 1),
            unit="mm",
            dataset=DATASET_DEMAND,
        ),
        EvidenceItem(
            statement=text.evidence_deficit(lang, irrigated=ctx.irrigated),
            value=round(f.deficit_mm, 1),
            unit="mm",
            dataset=DATASET_BALANCE,
        ),
        EvidenceItem(
            statement=text.evidence_worst(lang, crop=worst, season=season, irrigated=ctx.irrigated),
            value=round(100.0 * f.worst_unmet, 1),
            unit="%",
            dataset=DATASET_BALANCE,
        ),
    ]
    if ctx.awc is not None and isinstance(ctx.awc.value, int | float):
        items.append(
            EvidenceItem(
                statement=text.evidence_awc(lang),
                value=float(ctx.awc.value),
                unit="mm/m",
                dataset=DATASET_SOIL[ctx.awc.source],
            )
        )
    if f.indicators.n_credit_kg_ha > 0:
        items.append(
            EvidenceItem(
                statement=text.evidence_nitrogen(lang),
                value=round(f.indicators.n_credit_kg_ha, 1),
                unit="kg N/ha",
                dataset=DATASET_NITROGEN,
            )
        )
    return items


def _why(
    ctx: Context,
    rank: int | None,
    scores: RotationScores,
    shares: dict[str, float] | None,
    baseline_scores: RotationScores | None,
) -> list[str]:
    if rank is None:  # the baseline: the engine did not suggest it
        return []
    out = [text.why_rank(ctx.lang, rank=rank, n=ctx.n_ranked, priorities=ctx.priorities)]
    if shares:
        name, share = max(shares.items(), key=lambda item: item[1])
        if share >= STRONG_SHARE:
            out.append(text.why_strongest(ctx.lang, score=name, value=getattr(scores, name), share=share))
    if baseline_scores is not None:
        out.append(text.why_vs_current(ctx.lang, total=scores.total, current=baseline_scores.total))
    return out


def _benefits(ctx: Context, f: Facts, baseline: Facts | None) -> list[str]:
    out = []
    if f.indicators.n_credit_kg_ha > 0:
        legumes = _names([c for c in f.seq if c.is_legume], ctx.lang)
        out.append(text.nitrogen_credit(ctx.lang, legumes=legumes, kg_ha=f.indicators.n_credit_kg_ha))
    if baseline is not None and baseline.deficit_mm - f.deficit_mm >= 1.0:
        out.append(
            text.benefit_less_deficit(
                ctx.lang, deficit=f.deficit_mm, current=baseline.deficit_mm, irrigated=ctx.irrigated
            )
        )
    return out


def _gaps(ctx: Context, f: Facts) -> list[str]:
    out = []
    if ctx.awc is not None and ctx.awc.source == "dataset" and isinstance(ctx.awc.value, int | float):
        out.append(text.gap_soil_dataset(ctx.lang, awc=float(ctx.awc.value)))
    elif ctx.awc is not None and ctx.awc.source == "default":
        out.append(text.gap_soil_default(ctx.lang))
    if not ctx.crop_values_given:
        out.append(text.gap_no_crop_values(ctx.lang))
    borrowed = [c for c in f.seq if c.id in PULSES_WITH_BORROWED_CREDIT]
    if borrowed and f.indicators.n_credit_kg_ha > 0:
        out.append(text.gap_borrowed_credit(ctx.lang, crops=_names(borrowed, ctx.lang)))
    if ctx.irrigated:
        out.append(text.gap_irrigation_supply(ctx.lang))
    return out


def _local_review(ctx: Context, f: Facts) -> list[str]:
    lang = ctx.lang
    out = []
    if not ctx.irrigated:
        for year in f.yearly:
            if year.stress_index >= HIGH_STRESS:
                crop = f.seq[year.year_index - 1]
                out.append(
                    text.review_stressed_crop(
                        lang,
                        crop=crop_name(crop.id, crop.name, lang),
                        year=year.year_index,
                        unmet=year.stress_index,
                    )
                )
    out.append(
        text.review_worst_season(
            lang,
            crop=crop_name(f.worst_crop.id, f.worst_crop.name, lang),
            season=f"{f.worst_ag_year - 1}/{f.worst_ag_year}",
            unmet=f.worst_unmet,
            irrigated=ctx.irrigated,
        )
    )
    sowing = {c.id: (crop_name(c.id, c.name, lang), c.sowing_day, c.sowing_month) for c in f.seq}
    out.append(text.review_sowing_dates(lang, sowing=list(sowing.values())))
    return out


def build(
    ctx: Context,
    f: Facts,
    scores: RotationScores,
    *,
    rank: int | None = None,
    shares: dict[str, float] | None = None,
    baseline: Facts | None = None,
    baseline_scores: RotationScores | None = None,
) -> RotationReasoning:
    """`rank` is None for the baseline itself. `shares` gives, per score, the share of ranked rotations that score
    lower than this one."""
    return RotationReasoning(
        why_suggested=_why(ctx, rank, scores, shares, baseline_scores),
        evidence=_evidence(ctx, f),
        benefits=_benefits(ctx, f, baseline),
        information_gaps=_gaps(ctx, f),
        local_review=_local_review(ctx, f),
    )
