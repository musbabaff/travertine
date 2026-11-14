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

## 5. Not yet implemented

Soil water balance and water-stress coefficient Ks (FAO-56 ch. 8), climate adjustment of Kc mid / end (FAO-56 eq. 62),
yield response (FAO-33 / FAO-66), trend tests (Mann-Kendall, Sen's slope), rotation enumeration and scoring, validation
against MODIS and HLS NDVI, and the GPM IMERG precipitation cross-check. Each will be documented here when it lands.

## References

- Allen, R. G., Pereira, L. S., Raes, D., Smith, M. (1998). *Crop evapotranspiration — Guidelines for computing crop
  water requirements.* FAO Irrigation and Drainage Paper 56. https://www.fao.org/4/x0490e/x0490e00.htm
- Doorenbos, J., Kassam, A. H. (1979). *Yield response to water.* FAO Irrigation and Drainage Paper 33.
- Saxton, K. E., Rawls, W. J. (2006). Soil water characteristic estimates by texture and organic matter for hydrologic
  solutions. *Soil Science Society of America Journal* 70, 1569–1578. https://doi.org/10.2136/sssaj2005.0117
- Poggio, L., de Sousa, L. M., Batjes, N. H., et al. (2021). SoilGrids 2.0: producing soil information for the globe
  with quantified spatial uncertainty. *SOIL* 7, 217–240. https://doi.org/10.5194/soil-7-217-2021
- Soil Science Division Staff (2017). *Soil Survey Manual.* USDA Handbook 18.
