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
resamples years with replacement, 10,000 resamples, seed 2026. The model "beats" the baseline only if its r is
more negative and the 95 % interval of the difference r_model − r_baseline lies entirely below zero. If the
interval contains zero the result is reported as "no detectable difference".

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

**Verdict under the pre-registered rule: no detectable difference.** Both series correlate with greenness in the
expected direction and neither interval includes zero. The model's correlation is stronger in this sample, but the
interval of the difference includes zero, so the data do not show that the water balance beats the plain dryness
index at this pixel.

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

## 4. Not yet done

- Field-scale (30 m) back-test: the anonymous HLS record starts in 2020, six seasons, too few for a correlation; the
  full HLS archive from 2013 needs a NASA Earthdata login.
- Several sites in contrasting climates; they will be listed in a new protocol section before any is computed.
