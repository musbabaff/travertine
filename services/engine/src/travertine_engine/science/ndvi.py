"""Growing-season NDVI summaries and the statistics used to compare them with modelled stress."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np

from travertine_engine.science.et0 import FloatArray
from travertine_engine.sources.modis import Composite

USABLE_RELIABILITY = (0, 1)  # MOD13Q1 pixel reliability: good, marginal
MIN_COMPOSITES = 6


def season_mean(composites: Sequence[Composite]) -> float | None:
    """Mean NDVI of the usable composites, or None when fewer than MIN_COMPOSITES pass the quality screen."""
    values = [c.ndvi for c in composites if c.reliability in USABLE_RELIABILITY and c.ndvi is not None]
    if len(values) < MIN_COMPOSITES:
        return None
    return float(np.mean(values))


def zscores(values: FloatArray) -> FloatArray:
    return np.asarray((values - values.mean()) / values.std(ddof=1), dtype=float)


def pearson(x: FloatArray, y: FloatArray) -> float:
    return float(np.corrcoef(x, y)[0, 1])


@dataclass(frozen=True, slots=True)
class PairedBootstrap:
    r_a: float
    r_b: float
    ci_a: tuple[float, float]
    ci_b: tuple[float, float]
    ci_diff: tuple[float, float]  # r_a − r_b
    resamples: int


def _rows_pearson(x: FloatArray, y: FloatArray) -> FloatArray:
    xc = x - x.mean(axis=1, keepdims=True)
    yc = y - y.mean(axis=1, keepdims=True)
    den = np.sqrt((xc * xc).sum(axis=1) * (yc * yc).sum(axis=1))
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.asarray((xc * yc).sum(axis=1) / den, dtype=float)


def paired_bootstrap(
    a: FloatArray, b: FloatArray, target: FloatArray, *, resamples: int = 10_000, seed: int = 2026
) -> PairedBootstrap:
    """Percentile intervals (95 %) for corr(a, target), corr(b, target) and their difference, resampling the same
    years for both so the difference keeps their pairing. Resamples where a series is constant are dropped."""
    n = target.shape[0]
    idx = np.random.default_rng(seed).integers(0, n, size=(resamples, n))
    ra = _rows_pearson(a[idx], target[idx])
    rb = _rows_pearson(b[idx], target[idx])
    ok = np.isfinite(ra) & np.isfinite(rb)
    ra, rb = ra[ok], rb[ok]

    def ci(v: FloatArray) -> tuple[float, float]:
        lo, hi = np.percentile(v, [2.5, 97.5])
        return float(lo), float(hi)

    return PairedBootstrap(
        r_a=pearson(a, target),
        r_b=pearson(b, target),
        ci_a=ci(ra),
        ci_b=ci(rb),
        ci_diff=ci(ra - rb),
        resamples=int(ok.sum()),
    )


@dataclass(frozen=True, slots=True)
class PooledBootstrap:
    mean_r_a: float
    mean_r_b: float
    mean_diff: float
    ci_a: tuple[float, float]
    ci_b: tuple[float, float]
    ci_diff: tuple[float, float]
    sites: int


def pooled_paired_bootstrap(
    sites: Sequence[tuple[FloatArray, FloatArray, FloatArray]], *, resamples: int = 10_000, seed: int = 2026
) -> PooledBootstrap:
    """Mean over sites of corr(a, target), corr(b, target) and their difference. Years are resampled within each
    site (stratified), with the same draw for a and b; resamples where any site's series is constant are dropped."""
    rng = np.random.default_rng(seed)
    ra_all = np.zeros(resamples)
    rb_all = np.zeros(resamples)
    ok = np.ones(resamples, dtype=bool)
    for a, b, target in sites:
        n = target.shape[0]
        idx = rng.integers(0, n, size=(resamples, n))
        ra = _rows_pearson(a[idx], target[idx])
        rb = _rows_pearson(b[idx], target[idx])
        ok &= np.isfinite(ra) & np.isfinite(rb)
        ra_all += np.nan_to_num(ra)
        rb_all += np.nan_to_num(rb)
    k = len(sites)
    ra_all, rb_all = ra_all[ok] / k, rb_all[ok] / k

    def ci(v: FloatArray) -> tuple[float, float]:
        lo, hi = np.percentile(v, [2.5, 97.5])
        return float(lo), float(hi)

    point_a = float(np.mean([pearson(a, t) for a, _, t in sites]))
    point_b = float(np.mean([pearson(b, t) for _, b, t in sites]))
    return PooledBootstrap(
        mean_r_a=point_a,
        mean_r_b=point_b,
        mean_diff=point_a - point_b,
        ci_a=ci(ra_all),
        ci_b=ci(rb_all),
        ci_diff=ci(ra_all - rb_all),
        sites=k,
    )
