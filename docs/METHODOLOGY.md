# Methodology

How the Travertine engine turns open data into the numbers the app shows. Every equation names its source. This
document grows with the engine; sections marked *not yet implemented* describe planned work and produce no numbers
today.

## 1. Climate record

**Data.** NASA POWER daily point API, Agroclimatology community, for the grid cell containing the field, from
1 January 2001 to 31 December of the last full calendar year. Parameters: daily mean, maximum and minimum 2 m air
temperature (`T2M`, `T2M_MAX`, `T2M_MIN`), 2 m dew point (`T2MDEW`), 2 m wind speed (`WS2M`), surface pressure (`PS`),
all-sky surface shortwave irradiance (`ALLSKY_SFC_SW_DWN`), bias-corrected precipitation (`PRECTOTCORR`) and root-zone
and surface soil wetness (`GWETROOT`, `GWETTOP`).

**What these values are.** Gridded, model-based estimates: MERRA-2 reanalysis meteorology on a 0.5° × 0.625° grid and
CERES SYN1deg solar radiation on a 1° grid. A grid cell is roughly 55 km across at the demo latitude. They describe the
regional climate around a field, not the field itself, and they miss local effects such as valley inversions,
irrigation cooling and convective storms that hit one village and not the next.

**Annual summaries** (`climate[]` in `/v1/field/analyze`): calendar-year precipitation total, ET0 total, mean of
`T2M`, and mean of `GWETROOT`. A year with any missing day is dropped and named in the provenance note.

## 2. Reference evapotranspiration (ET0)

FAO-56 Penman-Monteith, daily step (Allen et al., 1998, eq. 6):

```
ET0 = [0.408 Δ (Rn − G) + γ (900 / (T + 273)) u2 (es − ea)] / [Δ + γ (1 + 0.34 u2)]
```

| Term | How it is obtained | FAO-56 |
|---|---|---|
| T | (Tmax + Tmin) / 2 | eq. 9 |
| Δ | slope of the saturation vapour pressure curve at T | eq. 13 |
| γ | 0.665 × 10⁻³ P, with P from POWER `PS` | eq. 8 |
| es | mean of e°(Tmax) and e°(Tmin) | eqs. 11–12 |
| ea | e°(Tdew) from POWER `T2MDEW` | eq. 14 |
| Ra | extraterrestrial radiation from latitude and day of year | eqs. 21–25 |
| Rso | (0.75 + 2 × 10⁻⁵ z) Ra, z = POWER grid-cell elevation | eq. 37 |
| Rn | (1 − 0.23) Rs − Rnl, Rs from `ALLSKY_SFC_SW_DWN`, Rs/Rso capped at 1 | eqs. 38–40 |
| G | 0 for daily steps | eq. 42 |
| u2 | POWER `WS2M` (already at 2 m) | — |

**Fallback.** When any Penman-Monteith input is missing for a day, Hargreaves (eq. 52) is used for that day only:
`ET0 = 0.0023 (T + 17.8) (Tmax − Tmin)^0.5 × 0.408 Ra`. The number of fallback days is reported in the provenance note.
For the demo field 2001–2025 it is zero.

**Verification.** Unit tests reproduce the FAO-56 worked examples: Example 2 (pressure, γ), Example 3 (es), Example 8
(Ra), Example 9 (daylight hours) and Example 18 (full daily ET0 for Uccle, 6 July: 3.9 mm/day, with intermediate Ra,
Rso, Rnl and Δ). A property test checks that ET0 is finite and non-negative across the input space.

**Difference from the Phase 0 fixtures.** The fixture script estimated annual ET0 with monthly Hargreaves from the
POWER *monthly* `T2M_MAX` and `T2M_MIN`. Those monthly fields are the extreme temperatures of the month, not means of
daily extremes, so the temperature range and ET0 were overstated (fixture: 1651–1837 mm/year; engine Penman-Monteith:
1145–1359 mm/year for 2001–2024 at the demo field). The engine values replace the fixture values.

## 3. Soil

**Data.** ISRIC SoilGrids 2.0 at 250 m: clay, sand, silt, organic carbon (`soc`) and pH in water (`phh2o`) for the
0–5, 5–15, 15–30, 30–60 and 60–100 cm layers, mean prediction plus the 5th and 95th percentiles.

**Derived values** (`soil` in `/v1/field/analyze`):

- Texture class: USDA texture triangle (Soil Survey Manual) applied to the 0–30 cm depth-weighted sand, silt and clay.
- Organic carbon and pH: 0–30 cm depth-weighted means.
- Available water capacity (AWC): for each layer down to 100 cm, field capacity θ₃₃ minus wilting point θ₁₅₀₀ from the
  Saxton & Rawls (2006) pedotransfer functions (eqs. 1 and 2), with organic matter = 1.724 × organic carbon, times the
  layer thickness; summed over the profile. Inputs are clipped to the fitting range of the regression (clay ≤ 60 %,
  organic matter ≤ 8 %) and the wilting point is floored at 0.

**Uncertainty.** SoilGrids prediction intervals are often wide; at the demo field the 0–30 cm clay interval spans
roughly 3–92 %. The 90 % intervals for clay and organic carbon are written into the provenance note of every response.
AWC is computed from the mean prediction only, so it inherits that uncertainty without quantifying it.

**When SoilGrids fails** (no prediction at the point, or the service does not answer after retries) the engine returns a
generic loam placeholder (40 % sand, 40 % silt, 20 % clay, 10 g/kg organic carbon, pH 7.0) and the provenance item is
titled `DEFAULT SOIL — not measured`. Its note states that the values are not data for the field.

## 4. Crop table

`services/engine/data/crops.yaml` holds 12 crops. Each value cites its source table:

- Kc ini / mid / end and crop height: FAO-56 Table 12 (sub-humid reference climate, RHmin ≈ 45 %, u2 ≈ 2 m/s).
- Stage lengths and planting month: one row of FAO-56 Table 11, preferring Mediterranean or arid-region rows.
- Maximum rooting depth and depletion fraction p: FAO-56 Table 22. Where a range is given, the midpoint is used and the
  range is kept in the file.
- Yield response factor Ky: FAO-56 Table 24, which reproduces FAO-33. Crops without a Ky in that table carry `null`.

Chickpea is left out because FAO-56 Table 11 gives no stage lengths for it. The corrections relative to the Phase 0
fixture are listed in the `contract` issue opened with the engine's first release.

## 5. Soil water balance (FAO-56 chapter 8)

A daily root-zone balance in depletion form (eq. 85), with runoff and capillary rise set to zero:

```
Dr,i = Dr,i−1 − P,i − I,i + ETc,adj,i + DP,i          0 ≤ Dr ≤ TAW
```

| Quantity | Definition | Source |
|---|---|---|
| TAW | AWC per metre (`awc_mm` of the 0–100 cm profile) × crop rooting depth Zr; layers below 100 cm are assumed to hold the same water per metre | FAO-56 eq. 82 |
| p | Table 22 value adjusted daily for the ETc rate, p = p_tab + 0.04 (5 − ETc), limited to 0.1–0.8 | Table 22 footnote |
| RAW | p × TAW | eq. 83 |
| Ks | 1 while Dr ≤ RAW, else (TAW − Dr) / ((1 − p) TAW) | eq. 84 |
| Kc | piecewise-linear curve from Table 12 values and Table 11 stage lengths; Kc mid and Kc end (when ≥ 0.45) adjusted for the season's mean wind and RHmin | eqs. 62, 63, 65, 66 |
| ETc,adj | Ks × Kc × ET0 | eq. 81 |
| DP | water above field capacity drains the same day | eq. 88 |

**Between crops** the field is bare. Evaporation follows the two-stage model of chapter 7 with Kcb = 0:
E = Kr × 1.20 × ET0 (eq. 72 with crop height 0), Kr = 1 until the evaporation layer has lost REW, then
(TEW − De)/(TEW − REW) (eq. 74). TEW = 1000 (θFC − 0.5 θWP) × 0.10 m (eq. 73) from the 0–15 cm Saxton & Rawls water
contents; REW is the midpoint of the FAO-56 Table 19 range for the soil texture (classes missing from Table 19 use the
closest listed class). Evaporation can only dry the evaporation layer, so deeper water is kept for the next crop.

**Irrigated mode.** On any crop day that starts with Dr > RAW, the root zone is refilled to field capacity early in the
day (the convention of FAO-56 Example 38). Ks therefore stays at 1 and the reported deficit is the irrigation
requirement.

**Verification.** A hypothesis property test runs random rain series, ET0, Kc, initial depletion, sowing offsets and
both modes, and checks that the change in stored water equals rain + irrigation − ET − evaporation − drainage to 10⁻⁶
mm, that 0 ≤ Dr ≤ TAW, and that actual ET never exceeds potential ET. Ks, Kr and the p adjustment are tested against
the equations directly.

## 6. Crop calendar

Agricultural year Y runs from 1 October of Y − 1 to 30 September of Y. Each crop is sown on the date derived from its
Table 11 row (see `crops.yaml`) and harvested `growing_days` later. One crop occupies each agricultural year; autumn
sowings belong to the year in which they are harvested.

## 7. Rotations

**Rules** applied when enumerating sequences of 3–5 crops:

1. No two consecutive crops from the same botanical family. A perennial stand continuing into its next year is the
   exception.
2. The next crop must be sown after the previous one is harvested (season compatibility).
3. At least one legume per rotation.
4. A perennial (alfalfa) stand lasts at least two consecutive years.

With all 12 crops this yields 545, 5,437 and 51,021 candidates for 3, 4 and 5 years.

**The farmer's current rotation (baseline).** A request may carry `current_rotation`, the crops the field grows now,
one per year. A sequence shorter than the horizon is repeated in order until it fills it (wheat, barley over four
years becomes wheat, barley, wheat, barley). It is then scored exactly like a candidate: the same daily water balance,
the same historical windows, the same percentiles, the same priorities, and soil indicators divided by the same
candidate maxima (limited to 1 if the sequence exceeds one of them). Rules 1, 3 and 4 are *not* applied to it: a
sequence that breaks them is still simulated, and the response lists each broken rule with the year it falls in
(`same_family_in_consecutive_years`, `no_legume_in_cycle`, `perennial_single_year`). Rule 2 cannot be broken with the
present crop table, because no crop is sown before any other crop's harvest date. Every alternative carries
`vs_baseline`, its score minus the baseline's for water, income, soil, risk and total; the baseline sequence itself is
left out of the alternatives, so a response holds the existing rotation plus the ranked alternatives (at least three
strategies whenever two or more valid alternatives exist). The differences are differences between relative indices on
past years, not predicted gains; whether a change suits the farm is the farmer's and local advisers' call.

**Back-cast.** Each candidate is run through every window of consecutive agricultural years in the record (20 windows
of 5 years for 2002–2025). The soil-water state at the start of a window comes from a continuous bare-soil balance
over the whole record, started at field capacity on 1 January 2001 (nine months of spin-up). From one crop to the next
the depletion fraction Dr/TAW is carried over, so a crop that leaves the soil dry hands that dryness on. To keep
exploration fast, every (previous crop, crop, year) segment is simulated once for 11 starting depletion fractions
(0, 0.1, …, 1) and rotations interpolate linearly between them.

**Scores** (each 0–1, higher is better; relative indices, not forecasts):

| Score | Definition |
|---|---|
| water | median over windows of the share of crop water demand (Σ ETc) met by rain and stored soil water: 1 − Σ deficit / Σ ETc, where the deficit is ETc − ETc,adj (rain-fed) or the irrigation requirement (irrigated) |
| risk | 1 − (0.5 × P90 + 0.5 × (P90 − P10)) of the unmet share of single seasons across all windows: high when even the driest seasons are mostly met and outcomes are consistent |
| soil | mean of four indicators, each divided by its maximum among the candidates: legume nitrogen credit to the following non-legume crops (UW-Extension A3517: alfalfa fair stand 160 lb N/acre in the first year and 50 in the second, soybean 40, pea and dry bean 20 — applied to lentil and faba bean as the closest category; reduced on sands and loamy sands as the source specifies), number of botanical families, range of rooting depths, and share of days under a crop |
| income | mean over all simulated seasons of ETc,adj / ETc with every crop valued equally. No price or market data is used, so this is a water-limited production index, not a profit estimate |
| total | priority-weighted mean of the four scores, weights as given by the user (equal weights if all are zero) |

The response returns the ten highest totals. Yearly figures are medians across windows. Explanations are generated from
the same numbers (window count and period, median demand and deficit, the 90th-percentile unmet share and the most
extreme season, the nitrogen credit, diversity and cover).

**Farmer inputs.** `farmer_inputs` on the explore request carries the farmer's own numbers, and the response's
`inputs[]` lists every input the scores rest on with its source (`farmer`, `dataset` or `default`) and, for farmer
values, the estimate it replaced. A topsoil test (`sand_pct` and `clay_pct` together, `organic_carbon_pct`)
replaces the SoilGrids 0–15 cm values used for the surface evaporation layer and the 0–30 cm texture class. A
measured `available_water_mm_per_m` replaces the SoilGrids 0–100 cm available water; without it, a changed texture
or organic carbon recomputes available water with Saxton & Rawls (2006) from the tested soil, as if that soil filled
the root zone. `crop_values` weights the income score: each crop year counts its share of water demand met times its
value divided by the largest value, so the index rises with the share of valuable crops that get their water. Only
ratios matter; no prices, costs or yields are assumed. The allowed crops are `crop_ids` and irrigation is
`irrigated`, both reported in `inputs[]`. Soil pH is not taken: no part of the model uses it.

**Language.** `language` (`en`, the default, or `tr`) on the explore request and on `/v1/validation` sets the language
of `explanation[]` and `caveats[]`. The numbers are computed once and only the sentence around them changes; Turkish
text uses a decimal comma, a space between thousands and a leading percent sign (`%4`). Ids, units, `method` and
`provenance[]` stay in English. All templates live in `src/travertine_engine/text.py`.

**Limitations.** Runoff is ignored, so heavy-rain years overstate infiltration; deep-percolation losses are counted as
lost to the crop. Stage lengths are generic Table 11 rows, not local observations. Overlapping windows are not
independent samples. POWER rain is a 0.5° grid-cell average, which smooths local storms. The income score is not
informative under irrigation, where every crop meets its demand. Fallow and cover-crop options are not yet in the crop
table.

### Structured reasoning per strategy

Every rotation, and the baseline, carries `reasoning` with five parts in the request language: why it was suggested
(rank among all rule-abiding candidates under the given priorities, the score in which it beats at least 75 % of them,
and its total against the current rotation), evidence (median water demand, unmet demand or irrigation requirement,
worst single season, available water capacity and legume nitrogen credit, each with its value, unit and dataset),
benefits (nitrogen credit, lower deficit than the current rotation), information gaps (soil from SoilGrids or a
default instead of a soil test, no crop values, borrowed pulse nitrogen credit, irrigation supply unknown) and points
for local review (crops with a median unmet share of at least 50 % under rain-fed management, the worst season, the
assumed FAO-56 sowing dates). Each sentence is built from that strategy's numbers; a part with nothing specific to
say is left empty rather than filled with generic text. The reasoning supports the farmer's and local experts'
judgment; it does not replace it.

## 7b. Climate hazards and the crop calendar

**Hazards** (`GET /v1/field/hazards`) are ETCCDI indices (Zhang et al. 2011, doi:10.1002/wcc.147) computed per
calendar year on the NASA POWER grid-cell daily series: frost days FD (Tmin < 0 °C), summer days SU (Tmax > 25 °C),
TXx, R10mm, R20mm, Rx1day and CDD (longest run of days with < 1 mm, within the year). Warm days are a simplified TX90p:
Tmax above the record's 90th percentile for that calendar month. Last spring frost is the last day before 1 August with
Tmin < 0 °C, first autumn frost the first from 1 August, frost-free days the days between them (northern hemisphere
only). Crop-specific heat-stress thresholds are not used because no verified published threshold is in the crop table.

**Calendar** (`POST /v1/field/calendar`): sowing and harvest from the crop table (FAO-56 Table 11), bare-field periods
between one harvest and the next sowing (the last crop wraps to the first, as the cycle repeats), and for every month a
crop is in the field: the median over years of the climatic deficit max(0, 1 − P/ETc) with ETc = table Kc × ET0 (no
soil water), and the share of the crop's days with frost or warm days. The most vulnerable month per hazard is the one
with the highest share. These are past frequencies, not forecasts.

## 7c. Scenario sensitivity test

`scenario` on `/v1/rotations/explore` multiplies every day's NASA POWER precipitation by `precipitation_factor`
(0.5–1.5) and adds `temperature_change_c` (−3 to +5 °C) to daily mean, maximum, minimum and dew-point temperature.
Shifting the dew point with the air keeps relative humidity roughly unchanged; wind, radiation and pressure stay as
recorded. FAO-56 Penman-Monteith ET0, the Kc climate adjustment and the soil water balance are then recomputed and the
rotations are scored as usual. The response is labelled as a sensitivity test on past years: it shows how those years
would have scored under the change and is not a projection of future climate. Example, demo field, lentil → barley
over 4 years: precipitation × 0.8 and +2 °C raise median demand from 1,060 to 1,128 mm and unmet demand from 45 to
116 mm; the water score falls from 0.956 to 0.899.

## 8. Vegetation record and validation

**NDVI history.** `/v1/field/analyze` returns `ndvi_history`: for each year, the mean MODIS/Terra MOD13Q1 v061 NDVI
of the 250 m pixel containing the field centre over the ten 16-day composites starting on day of year 97 to 241
(early April to late September). Composites with pixel reliability 2 (snow), 3 (cloud) or −1 (fill) are dropped, and
a year needs at least six usable composites; years that fail are listed in the provenance note. Data come from the
ORNL DAAC MODIS web service, one request per band per season. If the service is down, the analysis is returned
without `ndvi_history` rather than failing.

**Field-scale NDVI (`/v1/field/ndvi`).** Every clear Harmonized Landsat Sentinel-2 v2.0 observation of the 30 m
pixel at the field centre since 2020, with NDVI from the nadir BRDF-adjusted red and narrow-NIR bands (Landsat 8/9
B04/B05, Sentinel-2 B04/B8A; HLS user guide v2.0, Table 3). An observation is clear when Fmask bits 1–5 (cloud,
adjacent to cloud or shadow, cloud shadow, snow/ice, water) are 0 and the aerosol level is not high (Table 9; bit 0 is
unused in v2.0). Scenes with more than 80 % cloud over the tile are not read, and overlapping MGRS tiles are counted
once per date. Each year gets an April–September mean when at least five observations are clear. At the demo point
the 30 m season means (0.40–0.54, 2020–2025) are well above the 250 m MODIS values (0.27–0.30): the larger pixel
mixes the field with its surroundings.

**Back-test (`/v1/validation`).** The protocol is fixed in `docs/VALIDATION.md` before results were computed. In short:
modelled stress for year Y is 1 − ΣETa/ΣETc of rain-fed winter wheat from 1 April to harvest, from the section 5 water
balance started on 1 October of Y−1; the observed series is the z-score of the growing-season NDVI; the statistic is
Pearson r with a paired percentile bootstrap (10,000 resamples of years, seed 2026). The same statistic is computed for
a baseline dryness index, 1 − ΣP/ΣET0 over April–September, so the response shows whether the water balance adds
anything over climate alone. Both numbers, their intervals, the interval of their difference and a plain verdict are
the first caveat in the response; results are in `docs/VALIDATION.md`. The same protocol was applied, unchanged, to eight sites
in contrasting climates fixed in advance (`scripts/validate_sites.py`); six could be computed and all results are in
`docs/VALIDATION.md`. The MODIS season is read from Microsoft Planetary Computer, or from the ORNL DAAC service when
Planetary Computer does not answer; both serve the same granules.

**Limitations.** The land use of the pixel is unknown, so the model crop is an assumption. A 250 m pixel can mix
fields, roads and buildings. Irrigation is not represented in the back-test. Two dozen years give wide intervals.
The 30 m HLS record (six seasons) is too short for the back-test, which uses MODIS.

## 9. Not yet implemented

Yield response with Ky (FAO-33 / FAO-66), trend tests (Mann-Kendall, Sen's slope), P10/P50/P90 outcomes and the
Pareto set in the explore response, HLS before 2020, and the GPM IMERG precipitation
cross-check. Each will be documented here when it lands.

## References

- Allen, R. G., Pereira, L. S., Raes, D., Smith, M. (1998). *Crop evapotranspiration — Guidelines for computing crop
  water requirements.* FAO Irrigation and Drainage Paper 56. https://www.fao.org/4/x0490e/x0490e00.htm
- Doorenbos, J., Kassam, A. H. (1979). *Yield response to water.* FAO Irrigation and Drainage Paper 33.
- Saxton, K. E., Rawls, W. J. (2006). Soil water characteristic estimates by texture and organic matter for hydrologic
  solutions. *Soil Science Society of America Journal* 70, 1569–1578. https://doi.org/10.2136/sssaj2005.0117
- Poggio, L., de Sousa, L. M., Batjes, N. H., et al. (2021). SoilGrids 2.0: producing soil information for the globe
  with quantified spatial uncertainty. *SOIL* 7, 217–240. https://doi.org/10.5194/soil-7-217-2021
- Bundy, L. G., Kelling, K. A., Ward Good, L. (1997). *Using Legumes as a Nitrogen Source.* University of
  Wisconsin-Extension A3517.
- Didan, K. (2021). *MODIS/Terra Vegetation Indices 16-Day L3 Global 250m SIN Grid V061.* NASA EOSDIS Land Processes
  DAAC. https://doi.org/10.5067/MODIS/MOD13Q1.061
- ORNL DAAC (2018). *Terrestrial Ecology Subsetting & Visualization Services (TESViS) Global Subsets Tool* (Version
  1.1). ORNL Distributed Active Archive Center. https://doi.org/10.3334/ORNLDAAC/1379
- Ju, J., Zhou, Q., Freitag, B., et al. (2025). The Harmonized Landsat and Sentinel-2 version 2.0 surface reflectance
  dataset. *Remote Sensing of Environment* 324, 114723. https://doi.org/10.1016/j.rse.2025.114723
- Efron, B., Tibshirani, R. J. (1993). *An Introduction to the Bootstrap.* Chapman & Hall.
- Soil Science Division Staff (2017). *Soil Survey Manual.* USDA Handbook 18.
