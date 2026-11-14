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

Not yet computed.
