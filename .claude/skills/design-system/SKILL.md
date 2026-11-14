---
name: design-system
description: Travertine design tokens (colour, type, spacing, radius, shadow, motion), component rules and a do/don't list. Use whenever you build, restyle or review any UI in apps/web.
---

# Travertine design system

The look is inspired by the travertine terraces of Pamukkale, Denizli: warm mineral white, mineral-water teal, deep
navy for ink, and one warm accent used sparingly. The product should feel calm, precise and trustworthy — closer to a
well-made instrument than a marketing site.

All tokens live in `apps/web/src/app/globals.css` as CSS custom properties and are exposed to Tailwind through
`@theme`. **Components use tokens only. No raw hex, px font sizes or ad-hoc shadows in components.**

## 1. Colour tokens

Contrast ratios below are measured against `--color-canvas` (#F5F1E8). Do not change a value without re-measuring.

| Token | Hex | Use | Contrast on canvas |
|---|---|---|---|
| `--color-canvas` | `#F5F1E8` | App background (warm off-white) | — |
| `--color-surface` | `#FBF9F5` | Cards, panels, popovers | — |
| `--color-sunken` | `#EDE7DB` | Inputs, tracks, table stripes | — |
| `--color-border` | `#D8CEBB` | Dividers, card outlines (decorative) | 1.38 |
| `--color-border-strong` | `#8C7F68` | Input/control borders (must be ≥ 3:1) | 3.48 |
| `--color-ink` | `#0F1B2D` | Primary text, deep navy | 15.33 |
| `--color-ink-2` | `#5C5446` | Secondary text | 6.63 |
| `--color-ink-muted` | `#6B6252` | Captions, metadata, units | 5.33 |
| `--color-teal-700` | `#13615F` | Primary actions, links, selected state | 6.42 |
| `--color-teal-600` | `#1B7774` | Hover for primary | 4.73 |
| `--color-teal-500` | `#2A9490` | Non-text only (map field outline, focus halo) | 3.25 |
| `--color-teal-100` | `#D6ECE9` | Selected backgrounds, subtle highlights | — |
| `--color-accent` | `#A84B14` | **The one accent** (terracotta): top-ranked badge, key callout. Max one use per view region. | 5.06 |
| `--color-danger` | `#A63D32` | Errors | 5.59 |
| `--color-warning` | `#8A5A00` | Caveats, demo-data badge | 5.26 |
| `--color-navy-900` | `#0F1B2D` | Dark surfaces (header on landing, tooltips) | — |

Text on `teal-700` and on `accent` is `#FFFFFF` (7.23 and 5.70). Dark-surface text is `#EEE8DC` (14.17 on navy).

Chart colours are defined in the `data-viz` skill, not here.

## 2. Typography

One family: **IBM Plex Sans** (Latin + Latin Extended for Turkish), loaded with `next/font`. Weights 400, 500, 600 only.
Numbers in tables, score bars and stat readouts use `font-variant-numeric: tabular-nums`.

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `text-display` | 48 / 52 px (clamp 36→48) | 600 | Landing hero only |
| `text-h1` | 32 / 38 | 600 | Page title |
| `text-h2` | 24 / 30 | 600 | Section title |
| `text-h3` | 18 / 24 | 600 | Card title |
| `text-body` | 16 / 24 | 400 | Default |
| `text-sm` | 14 / 20 | 400 | Secondary, table cells |
| `text-xs` | 12 / 16 | 500 | Labels, units, provenance chips — never below 12 px |

Letter spacing: `-0.01em` on h1/display, `0.04em` + uppercase only for `text-xs` overline labels. Max line length 72ch.

## 3. Spacing

4 px base. Allowed steps: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96 (Tailwind `1 2 3 4 5 6 8 10 12 16 24`).
Page gutter: 16 px at < 768, 24 px at 768–1279, 32 px at ≥ 1280. Card padding: 16 px mobile, 20–24 px desktop.
Vertical rhythm between sections: 48 px mobile, 64 px desktop.

## 4. Radius

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 6 px | Chips, inputs, small buttons |
| `--radius-md` | 10 px | Buttons, cards |
| `--radius-lg` | 16 px | Panels, sheets, map overlays |
| `--radius-full` | 9999 px | Pills, slider thumbs, avatars |

## 5. Shadow

Shadows are warm (navy at low alpha), never pure black.

| Token | Value | Use |
|---|---|---|
| `--shadow-1` | `0 1px 2px rgb(15 27 45 / 0.06), 0 1px 1px rgb(15 27 45 / 0.04)` | Cards at rest |
| `--shadow-2` | `0 4px 12px rgb(15 27 45 / 0.08), 0 1px 3px rgb(15 27 45 / 0.06)` | Hover, popovers |
| `--shadow-3` | `0 12px 32px rgb(15 27 45 / 0.14)` | Panels floating over the map, dialogs |

## 6. Motion

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Enter, expand |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Reorder, move |
| `--dur-fast` | 120 ms | Hover, press, focus |
| `--dur-base` | 200 ms | Expand, fade, panel |
| `--dur-slow` | 320 ms | Card reorder (FLIP), sheet open |

Animate `transform` and `opacity` only. Under `prefers-reduced-motion: reduce`, all durations become 0 ms except
opacity fades, which drop to ≤ 100 ms. Map fly-to animations are replaced by jump-to.

## 7. Component rules

- **Buttons**: three variants only — `primary` (teal-700 fill, white text), `secondary` (surface fill, border-strong
  outline, ink text), `ghost` (no fill, teal-700 text). Height 40 px (44 px on touch layouts). One primary button per
  view region.
- **Cards**: surface fill, 1 px `--color-border`, `--radius-md`, `--shadow-1`. No coloured card backgrounds except the
  selected state (`teal-100` + 2 px teal-700 left edge or outline).
- **Inputs, toggles, sliders**: visible label above or left, 1 px border-strong, focus ring (see accessibility).
  Sliders show the current value as text next to the label.
- **Provenance chip**: `text-xs`, sunken fill, ink-muted text, dataset short name + resolution, opens a popover with the
  full provenance item. Attached to every number derived from a dataset.
- **Badges**: `Demo data` badge uses warning text on `#F6EBD3` with a 1 px warning border — always visible while the
  mock layer is active, never dismissible.
- **Skeletons**: sunken fill, same footprint as the loaded content, subtle 1.2 s opacity pulse (static under reduced
  motion).
- **Empty / error states**: one short title, one sentence of explanation, one action (e.g. Retry). Icon optional, line
  icons only.
- **Icons**: one line-icon set (Lucide), 1.5 px stroke, 16 or 20 px, `currentColor`. Never emoji.
- **Map overlays**: floating panels use surface + `--shadow-3` + `--radius-lg`, never translucent glass blur over text.

## 8. Do / Don't

| Do | Don't |
|---|---|
| Use tokens for every colour, size, radius, shadow and duration | Hard-code hex values or px sizes in components |
| Use whitespace and type weight to create hierarchy | Use more than one accent colour, or the accent more than once per region |
| Use flat colour fills | Use stock gradients, mesh blobs, glassmorphism or glow effects |
| Use line icons from one set | Use emoji anywhere in the UI, copy or commit messages shown in-app |
| Show real data with units | Use placeholder lorem ipsum or fake stats in shipped UI |
| Design the empty, loading and error state with the screen | Leave blank areas or spinners with no context |
| Align to the 4 px grid and a clear column structure | Centre everything; use generic hero + three feature cards template layouts |
| Write numbers with units and tabular figures | Mix units or decimal precision within one table or chart |
| Use IBM Plex Sans only | Add a second typeface, including a separate display or mono family |
| Keep NASA as a factual data-source name | Use NASA logos, insignia or visual branding |

## 9. Checklist (run before marking any UI work done)

- [ ] `grep -rnE "#[0-9a-fA-F]{3,8}\b" apps/web/src --include=*.tsx` returns no hits outside token files and chart palettes.
- [ ] No `font-family` other than the Plex variable; no font sizes outside the scale.
- [ ] No gradients (`grep -rn "gradient" apps/web/src` has no hits outside documented exceptions).
      Documented exception: `.tv-slider` track in `globals.css` uses a hard-stop `linear-gradient` to fill the
      track up to the value (WebKit has no range-progress pseudo-element). It renders two flat colours, never a blend.
- [ ] No emoji characters in `apps/web/src` or locale files.
- [ ] Every interactive element uses one of the defined button/input patterns.
- [ ] Accent appears at most once per view region.
