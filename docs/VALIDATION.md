# Validation

This file fixes how Travertine's water-stress model is checked against satellite observations. The protocol
sections were written and committed before any result was computed; results are appended below them and are
reported as computed, whether or not they favour the model.

## 1. Question

Does the engine's daily FAO-56 water balance explain year-to-year changes in observed vegetation greenness at a
field better than a plain climatic dryness index does?

## 2. Protocol — demo field (fixed before results)

**Site.** The demo field, 37.89 N 28.98 E (near Sarayköy, Denizli, Türkiye).

**Years.** Every calendar year Y in the NASA POWER record for which both the model and the satellite record give a
value (2002 onwards, because the water balance needs a 270-day spin-up from 1 January 2001).

**Observed series.** MODIS/Terra MOD13Q1 v061 250 m 16-day NDVI at the single pixel containing the field centre,
from the ORNL DAAC MODIS web service. For each year, the ten composites whose start day of year is 97 to 241
(early April to late September). A composite is used only when its pixel reliability is 0 (good) or 1 (marginal);
snow (2), cloud (3) and fill (−1) are dropped. A year is used only when at least 6 of its 10 composites pass. The
yearly value is the mean NDVI of the passing composites. The observed anomaly is the z-score of that value against
the mean and sample standard deviation (ddof = 1) of all used years.

**Model.** Rain-fed winter wheat with the parameters in `services/engine/data/crops.yaml` (sown 15 November,
FAO-56 Tables 11, 12 and 22 values), run through the engine's FAO-56 chapter 8 root-zone water balance on daily
NASA POWER precipitation and FAO-56 Penman-Monteith ET0, with the field's SoilGrids available water capacity.
Each season starts on 1 October of year Y−1 from the bare-soil depletion of the continuous chapter 7 balance.
Modelled stress for year Y is 1 − ΣETa / ΣETc over 1 April Y to harvest (12 July), which is the part of the season
that overlaps the NDVI window. Winter wheat is chosen because it is the most widely grown rain-fed field crop in
Türkiye; the land use of the pixel is not known (see caveats).

**Baseline.** Climatic dryness index 1 − ΣP / ΣET0 over 1 April to 30 September of year Y, with the same daily
POWER precipitation and the same daily Penman-Monteith ET0. (The contract fixture used a cruder version of this
index — monthly ET0 distributed by a Hargreaves shape — and reported r = −0.48, n = 24 for 2001–2024. The baseline
here is recomputed with the engine's daily ET0 on the same years as the model, so both are compared on equal
terms.)

**Statistics.** Pearson r between each stress series and the observed anomaly, over the same years. The expected
sign is negative: more stress, less greenness. 95 % confidence intervals from a paired percentile bootstrap that
resamples years with replacement, 10,000 resamples, seed 2026. A difference between the model and the baseline
counts as established only if the 95 % interval of r_model − r_baseline lies entirely on one side of zero. If the
interval contains zero the result is reported as "difference not established". (Wording edited on 14 November 2026;
the rule itself is unchanged.)

**Showcase.** `/v1/showcase` serves the section 5 results per site and pooled, read from the committed results file (`scripts/validate_sites.py` writes it to `docs/validation/multisite.json` and `services/engine/data/multisite.json`); the engine does not recompute them.

**In the API.** `/v1/validation` returns these numbers as fields as well as in the first caveat: `correlation` and
`correlation_ci95` for the model, `baseline` (name, correlation, interval and the yearly index values),
`difference_ci95`, and `verdict`, which follows the rule above: `model_better` only if the interval of the
difference lies entirely below 0, `baseline_better` only if entirely above 0, otherwise `no_detectable_difference`
(worded "difference not established" in the caveat).

**Not done here.** No parameter is tuned to improve agreement. No years are dropped after seeing results.

## 3. Results — demo field

Computed on 14 November 2026 with the engine at the commit that added this section, NASA POWER API v2.10.3 and
MOD13Q1 v061. Reproduce with `GET /v1/validation?lat=37.89&lon=28.98`.

| Series | Pearson r with NDVI anomaly | 95 % bootstrap interval |
|---|---|---|
| Model: winter-wheat water balance, 1 − ETa/ETc, 1 April – harvest | −0.66 | −0.85 to −0.43 |
| Baseline: 1 − P/ET0, April – September | −0.53 | −0.74 to −0.26 |
| Difference, model − baseline | −0.14 | −0.34 to +0.03 |

n = 24 years (2002–2025). All 25 MODIS seasons 2001–2025 passed the quality screen; 2001 is outside the model record
because of the spin-up.

**Verdict under the pre-registered rule: difference not established.** The model's correlation is r = −0.66 and its
95 % interval excludes zero; so does the baseline's. The model's correlation is the stronger of the two in this
sample, but the interval of the difference includes zero, so at n = 24 the data cannot separate the water balance
from the plain dryness index at this pixel.

**Check against the fixture.** Recomputing the baseline over the fixture's years (2001–2024) with the engine's
daily ET0 gives r = −0.49 (n = 24), against −0.48 in the contract fixture, which used a cruder monthly ET0.

Per-year values (stress rounded to 3 decimals, anomaly to 2):

| Year | Model stress | Baseline index | NDVI anomaly (σ) |
|---|---|---|---|
| 2002 | 0.319 | 0.739 | −0.42 |
| 2003 | 0.223 | 0.806 | −0.18 |
| 2004 | 0.437 | 0.870 | −1.54 |
| 2005 | 0.349 | 0.814 | −1.38 |
| 2006 | 0.408 | 0.859 | 0.56 |
| 2007 | 0.541 | 0.934 | −1.69 |
| 2008 | 0.508 | 0.900 | −1.25 |
| 2009 | 0.328 | 0.842 | 0.44 |
| 2010 | 0.316 | 0.799 | 0.58 |
| 2011 | 0.172 | 0.796 | 2.31 |
| 2012 | 0.274 | 0.833 | −0.11 |
| 2013 | 0.351 | 0.870 | 0.05 |
| 2014 | 0.300 | 0.741 | −0.06 |
| 2015 | 0.158 | 0.747 | 2.11 |
| 2016 | 0.450 | 0.833 | −0.89 |
| 2017 | 0.351 | 0.844 | 0.38 |
| 2018 | 0.286 | 0.766 | 0.79 |
| 2019 | 0.442 | 0.850 | 0.39 |
| 2020 | 0.356 | 0.845 | −0.02 |
| 2021 | 0.535 | 0.946 | −1.00 |
| 2022 | 0.419 | 0.868 | 0.08 |
| 2023 | 0.000 | 0.636 | 0.75 |
| 2024 | 0.552 | 0.887 | −0.23 |
| 2025 | 0.385 | 0.784 | 0.31 |

**What this does and does not show.** The pixel's growing-season NDVI is low (0.23–0.35), consistent with sparse or
mixed cover rather than a dense crop, and its land use is not known. The result supports using the water balance as
a dryness signal at this site; it does not validate crop-specific deficits, yields or the rotation ranking.

## 4. Protocol — multi-site (fixed before results)

Written and committed on 14 November 2026, before any multi-site number was computed. One site with 24 years cannot
separate the model from the baseline; several sites in contrasting climates can narrow the interval.

**Sites.** Northern-hemisphere areas where rain-fed winter cereals are the main field crop, chosen to span humid to
semi-arid climates. The coordinates were chosen from general knowledge of these regions, not checked against a land
cover map, so a pixel may hold other land uses; every site is reported whatever its result.

| Id | Area | Lat | Lon | Climate (Köppen, approximate) |
|---|---|---|---|---|
| tr-saraykoy | Sarayköy, Denizli, Türkiye (demo field) | 37.89 | 28.98 | Csa, Mediterranean |
| tr-cihanbeyli | Cihanbeyli, Konya, Türkiye | 38.65 | 32.93 | BSk, cold semi-arid |
| tr-polatli | Polatlı, Ankara, Türkiye | 39.58 | 32.15 | BSk, cold semi-arid |
| ma-settat | Settat, Chaouia, Morocco | 33.00 | −7.62 | Csa/BSh, semi-arid Mediterranean |
| es-tierra-de-campos | Tierra de Campos, Valladolid, Spain | 41.95 | −4.95 | Csb/BSk, Mediterranean continental |
| ro-baragan | Bărăgan plain, Călărași, Romania | 44.35 | 27.20 | Dfa/Cfa, humid continental |
| us-kansas | Great Bend, Kansas, USA | 38.36 | −98.76 | Cfa/BSk, continental |
| fr-beauce | Beauce, Eure-et-Loir, France | 48.25 | 1.75 | Cfb, oceanic (little water stress expected) |

Southern-hemisphere wheat areas are left out because the crop table's calendar (sowing 15 November) is a
northern-hemisphere calendar.

**Per site.** Exactly the demo-field protocol of section 2: same years rule, NDVI screen, model (rain-fed winter
wheat, same parameters and sowing date everywhere, nothing adjusted per site), baseline, Pearson r, paired bootstrap
with 10,000 resamples and seed 2026. A site with fewer than 8 usable years is reported as "too few years" and left
out of the pooled statistic.

**Pooled comparison.** The mean over sites of r_model − r_baseline, with a 95 % interval from a stratified paired
bootstrap: in each of 10,000 resamples (seed 2026) years are drawn with replacement within every site, the same draw
is used for model and baseline, and the mean difference across sites is recomputed. The mean r of the model and of
the baseline get intervals the same way. The difference counts as established only if its pooled interval lies
entirely on one side of zero.

**Data access (added 14 November 2026, before any multi-site number existed).** The ORNL DAAC MODIS web service
answered 502/503 for hours, and the first two multi-site runs computed no site other than the demo field. The engine
now reads the same MOD13Q1 v061 granules from Microsoft Planetary Computer first and falls back to ORNL. For the demo
pixel, all 20 composites checked (2005 and 2023, days 97–241) gave identical NDVI and pixel reliability from both
services, so the observed series does not depend on the route. The demo-field result in section 3 was computed from
ORNL data and is unchanged.

**Fixed in advance.** No site is added, removed or moved after results are seen; no parameter is changed; sites
where the model or the baseline does poorly are reported like the others. The run is `scripts/validate_sites.py`,
which writes `docs/validation/multisite.json`.

## 5. Results — multi-site

Computed on 15 November 2026 by `scripts/validate_sites.py` (raw output: `docs/validation/multisite.json`), NASA
POWER daily data 2001–2025, SoilGrids 2.0, MOD13Q1 v061. 95 % intervals are paired percentile bootstraps
(10,000 resamples, seed 2026). "Difference" is r_model − r_baseline; negative means the model's correlation with
greenness is the stronger one.

| Site | n | Mean NDVI | Model r (95 %) | Baseline r (95 %) | Difference (95 %) | Difference established? |
|---|---|---|---|---|---|---|
| tr-saraykoy | 24 | 0.281 | −0.665 (−0.845 to −0.428) | −0.526 (−0.740 to −0.257) | −0.138 (−0.337 to +0.028) | no |
| tr-cihanbeyli | 24 | 0.215 | −0.856 (−0.948 to −0.638) | −0.656 (−0.856 to −0.331) | −0.201 (−0.467 to +0.001) | no |
| tr-polatli | 24 | 0.231 | −0.490 (−0.711 to −0.179) | −0.566 (−0.782 to −0.239) | +0.076 (−0.146 to +0.249) | no |
| ma-settat | — | — | not computed | not computed | — | — |
| es-tierra-de-campos | 24 | 0.378 | −0.691 (−0.837 to −0.514) | −0.653 (−0.881 to −0.429) | −0.037 (−0.208 to +0.172) | no |
| ro-baragan | 24 | 0.546 | −0.417 (−0.783 to −0.025) | −0.196 (−0.647 to +0.182) | −0.220 (−0.339 to −0.020) | yes, model stronger |
| us-kansas | — | — | not computed | not computed | — | — |
| fr-beauce | 23 | 0.542 | −0.493 (−0.706 to −0.239) | −0.344 (−0.617 to −0.027) | −0.148 (−0.503 to +0.147) | no |

**Sites not computed.** At ma-settat and us-kansas SoilGrids returns no complete prediction (the mean and the 5th and
95th percentiles that the engine requires). The engine would fall back to its placeholder loam, which is not the
protocol's model, so these two sites have no result. They were not moved or replaced. fr-beauce has 23 years: the
2025 MODIS season had too few cloud-free composites.

**Pooled over the six computed sites.**

| | Mean r | 95 % interval |
|---|---|---|
| Model | −0.602 | −0.700 to −0.498 |
| Baseline | −0.490 | −0.612 to −0.371 |
| Difference | −0.112 | −0.203 to −0.021 |

**Reading.** At every computed site the model's correlation with greenness is negative and its interval excludes
zero. The baseline's interval includes zero at ro-baragan. Site by site, a difference between model and baseline is
established only at ro-baragan; at tr-polatli the baseline's correlation is the stronger one, without an established
difference. Pooled over the six sites, the difference (−0.112, interval −0.203 to −0.021) lies below zero, so under
the pre-registered rule the model's stronger association is established at the pooled level — for these six sites,
with the model crop and calendar applied unchanged everywhere. With the two missing sites the pooled result could
differ; it has not been computed for eight.

**What this does and does not show.** Like the demo field, this checks a dryness signal against 250 m greenness at
pixels whose land use is not verified. It does not validate crop-specific deficits, yields or the rotation ranking.

## 6. Not yet done

- Field-scale (30 m) back-test: the anonymous HLS record starts in 2020, six seasons, too few for a correlation; the
  full HLS archive from 2013 needs a NASA Earthdata login.
