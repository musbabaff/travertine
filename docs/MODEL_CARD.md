# Model card — Travertine engine

## What it is

A deterministic, physically based calculator, not a trained machine-learning model. It applies published FAO-56
equations and cited crop parameters to historical NASA POWER weather and SoilGrids soil for one location, and replays
crop rotations over every past window in the record. Nothing is fitted to the location; no parameter was tuned to
improve agreement with observations. Details are in `docs/METHODOLOGY.md`.

## Intended use

- Comparing crop rotations for a field by how they would have fared, in water terms, over the last two decades of
  weather at that location.
- Showing a farmer or adviser which seasons were hardest and how much of the crops' water demand went unmet.
- Teaching and discussion. It is a decision-support aid for people who know the field.

The tool can score the rotation a farmer already grows next to the alternatives it proposes, including one that
breaks its own rotation rules, and reports the difference in every score. It supports the farmer's judgment and local
expertise; it does not replace them.

## Not intended for

- Yield, income or fertilizer recommendations for a specific field. Income uses an equal value per crop unless the user
  supplies one; legume nitrogen credits come from a US Midwest extension publication and are used only as a relative
  soil indicator.
- Forecasts. Every number is a back-cast over past weather; the engine does not project future climate.
- Irrigation scheduling. The daily balance uses a 0.5° grid-cell weather record, not on-farm measurements.

## Inputs

| Input | Source | Resolution |
|---|---|---|
| Daily weather 2001 – last full year | NASA POWER (MERRA-2, CERES SYN1deg) | 0.5° × 0.625°, 1° × 1° |
| Soil texture, organic carbon, pH | SoilGrids 2.0 | 250 m, modelled |
| Crop stages, Kc, rooting depth, p | FAO-56 Tables 11, 12, 22 | Generic, not local |
| Legume N credits | UW-Extension A3517 | US Midwest rotation studies |
| Vegetation greenness (validation only) | MODIS MOD13Q1 v061 NDVI | 250 m |
| Farmer soil test, crop values (optional) | The user, per request | The tested field |

When the farmer gives a soil test or crop values, they replace the dataset estimate or the equal-value default, and every explore response lists in `inputs[]` which values came from the farmer, a dataset or a default.

## Evaluation

The only evaluation so far is the demo-field back-test against MODIS NDVI anomalies, with a protocol fixed in
advance (`docs/VALIDATION.md`). Result for 2002–2025 (n = 24): model r = −0.66 (95 % interval −0.85 to −0.43, which
excludes zero); a plain dryness index 1 − P/ET0 gives r = −0.53 (−0.74 to −0.26). The interval of the difference
(−0.34 to +0.03) includes zero, so a difference between model and baseline is **not established** at n = 24. This checks a dryness signal at one 250 m pixel of
unknown land use; it does not validate deficits, yields or rankings.

Multi-site back-test with the same protocol, fixed before results (`docs/VALIDATION.md` sections 4–5): eight sites
were chosen, six could be computed (SoilGrids has no complete prediction at the other two). Pooled over the six, mean
model r = −0.60 (−0.70 to −0.50), mean baseline r = −0.49 (−0.61 to −0.37), difference −0.11 (−0.20 to −0.02): the
model's stronger association is established at the pooled level for these six sites. Site by site it is established
only at one site (Bărăgan, Romania); at Polatlı the baseline's correlation is the stronger one, without an
established difference.

## Known limitations

- Weather is a grid-cell average; local storms, frost pockets and slope effects are smoothed out.
- Runoff and capillary rise are ignored; heavy-rain years overstate infiltration.
- Stage lengths and sowing dates are generic FAO-56 rows, not local calendars.
- Soil values are SoilGrids predictions with wide intervals (reported in the provenance), or a labelled default loam
  when SoilGrids does not answer.
- Overlapping historical windows are not independent samples; percentiles across them overstate certainty.
- Salinity, pests, disease, nutrients other than legume nitrogen, and management are not modelled.

## Ethical and practical notes

Results are associations with past weather, not guarantees. Every response carries `provenance[]` and the caveats are
meant to be shown verbatim. NASA datasets are named factually; the project is not endorsed by NASA.
