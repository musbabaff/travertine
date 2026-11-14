---
name: data-viz
description: Chart rules for Travertine — labelled axes with units, colour-blind-safe palette, direct labels, uncertainty display, accessible summaries. Use for any chart, score bar, sparkline, timeline or map legend in apps/web.
---

# Data visualisation

## 1. Library and implementation

- Charts are built with **visx** (`@visx/*`) on SVG so every mark is styleable with design tokens. Do not mix in a
  second charting library.
- All chart components live in `apps/web/src/components/charts/` and take typed data straight from the generated API
  types. No chart accepts a hand-written array of numbers.
- Charts are responsive (`ParentSize`) and readable at 390 px: fewer ticks, labels move above marks, never overlap.

## 2. Palette (colour-blind safe)

Derived from Okabe–Ito and darkened to reach ≥ 3:1 against canvas (#F5F1E8). Use the same colour for the same concept
everywhere in the product.

| Concept | Token | Hex | Contrast |
|---|---|---|---|
| Water | `--viz-water` | `#0072B2` | 4.60 |
| Income | `--viz-income` | `#B87800` | 3.25 |
| Soil health | `--viz-soil` | `#007A5A` | 4.74 |
| Risk | `--viz-risk` | `#C1480A` | 4.44 |
| Modelled (series A) | `--viz-model` | `#1F666B` (teal-700) | 5.87 |
| Observed (series B) | `--viz-observed` | `#061832` (ink) | 15.73 |
| Neutral / baseline | `--viz-neutral` | `#8C7F68` | 3.48 |
| Gridlines | `--viz-grid` | `#E2DACB` | decorative |

- Water demand vs deficit: demand is a `--viz-water` outlined bar, deficit is a solid `--viz-risk` bar.
- Never use red/green as the only distinction. Series also differ by shape (line vs bar, solid vs dashed, filled vs
  hollow markers).
- Sequential scales (e.g. stress index on the map or timeline) use a single-hue ramp from teal-100 to teal-700; diverging
  scales (anomalies) use `--viz-risk` ↔ neutral ↔ `--viz-water` with the midpoint at zero.
- Run `node .claude/skills/data-viz/check-palette.mjs` (or the inline contrast test in `apps/web`) after changing any
  colour.

## 3. Axes, units, labels

- Every axis has a title with units in brackets: "Water deficit (mm)", "NDVI anomaly (σ)", "Year". No unitless numbers.
- Y axes start at zero for bars. Lines may use a fitted domain, shown with a visible baseline at zero when it is in range.
- Gridlines: horizontal only, `--viz-grid`, 1 px. No chart borders, no 3D, no drop shadows on marks.
- Ticks: ≤ 6 on mobile, ≤ 10 on desktop; human-readable formats (`1,250 mm`, `2019`), tabular figures.
- **Direct labels over legends**: label line ends and bar groups directly. Use a legend only when direct labels would
  collide, and then place it above the plot, in series order.
- Title states the takeaway question, subtitle states dataset and period: "Modelled stress vs observed vegetation —
  2003–2024, NASA POWER + MODIS".

## 4. Uncertainty and honesty

- When the API provides uncertainty (ranges, standard deviations, `n`, caveats), show it: error bars or a shaded band
  at 15–20 % opacity of the series colour, and the `n` in the subtitle.
- Missing years are gaps, not interpolated lines. Mark them on the axis ("no data").
- Correlation is shown with its `n` and method next to it, never alone. A scatter or paired series is shown so viewers
  can judge the fit themselves.
- No smoothing, trend lines or extrapolation unless the engine returns them.

## 5. Score bars (rotation cards)

- Four horizontal bars, fixed order: water, income, soil, risk. Same 0–1 scale for all, with the numeric value
  (two decimals or 0–100) as a direct label at the bar end.
- Risk is displayed so that longer always means "better under your priorities" — label it "Low risk" to avoid an
  inverted reading.
- Bar track uses `--color-sunken`; the fill uses the concept colour.

## 6. Accessibility

- Every chart: `role="img"`, `aria-label` with a one-sentence summary generated from data, and a "View as table"
  toggle rendering the same data in a `<table>`.
- Tooltips open on hover **and** focus; each data point group is focusable by keyboard (roving tabindex).
- Animations ≤ 200 ms on data change, none under reduced motion.

## 7. Checks before done

- [ ] Every axis has a title with units.
- [ ] Every chart has a provenance chip and an accessible table alternative.
- [ ] No hard-coded data arrays in chart components or stories other than imports from contract fixtures.
- [ ] Screenshot at 390 px shows no overlapping labels.
- [ ] Uncertainty/caveats from the API are visible on the chart or directly beneath it.
