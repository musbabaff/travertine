---
name: accessibility
description: WCAG 2.2 AA rules for apps/web — contrast, keyboard navigation, focus states, labels, reduced motion. Use for every interactive element, colour choice, animation, chart and map interaction.
---

# Accessibility (WCAG 2.2 AA)

## 1. Contrast

- Body and small text: **≥ 4.5:1** against its actual background. Large text (≥ 24 px, or ≥ 18.66 px at 600): ≥ 3:1.
- UI component boundaries (input borders, slider tracks, toggle outlines) and meaningful graphics (chart marks, map
  field outline): **≥ 3:1** against adjacent colours.
- Use only token pairs whose ratios are listed in `design-system`. New pairs must be measured and the ratio recorded.
- Never place text over the map tiles or an image without an opaque surface behind it.

## 2. Keyboard

- Every action reachable with Tab / Shift+Tab, activated with Enter or Space. No keyboard traps (dialogs trap focus
  intentionally and release it on close, returning focus to the trigger).
- Logical tab order follows visual order. No positive `tabindex`.
- Sliders: arrow keys step 0.05, PageUp/PageDown step 0.25, Home/End to 0/1. Use native `<input type="range">` or a
  component with `role="slider"` and `aria-valuemin/max/now/valuetext`.
- Map: the field can be set without a mouse — a place search plus "Use map centre" / coordinate input. Map canvas is
  focusable with arrow-key pan and +/- zoom (MapLibre keyboard handler on).
- A "Skip to content" link is the first focusable element on every page.
- Escape closes popovers, dialogs and the tour.

## 3. Focus

- Visible focus on every focusable element via `:focus-visible`: 2 px solid `--color-teal-700` outline, 2 px offset, plus
  a 4 px `--color-teal-100` halo on dark-on-light surfaces. Never `outline: none` without a replacement.
- Focus is never hidden behind sticky headers or map overlays (`scroll-margin-top` on sections).
- After route changes, move focus to the page `<h1>`; after async updates, do not steal focus.

## 4. Labels and semantics

- Every input has a visible `<label>` (or `aria-labelledby`); placeholders are never the only label.
- Icon-only buttons have `aria-label` from locale files.
- Use landmarks: one `<header>`, `<nav>`, `<main>`, `<footer>`. One `<h1>` per page; headings do not skip levels.
- Live updates (rotation ranking changes, analysis finished) announce politely through one `aria-live="polite"` region
  with a short summary, e.g. "Rankings updated. Top rotation: wheat, chickpea, cotton."
- Errors are linked to their field with `aria-describedby` and announced.
- Charts: `role="img"` with an `aria-label` summary plus an accessible data table (visually hidden or toggleable).
- `lang` attribute matches the active locale (`en` / `tr`).

## 5. Colour is never the only signal

Score bars carry a numeric label; crop families carry a text label or pattern; error states carry an icon and text;
the selected rotation carries a check mark and "Selected" text, not only a colour.

## 6. Motion

- Respect `prefers-reduced-motion: reduce`: no parallax, no auto-playing animation, map uses `jumpTo` instead of
  `flyTo`, card reorder is instant, skeleton pulse stops.
- Nothing flashes more than 3 times per second. No auto-advancing carousels.

## 7. Touch and zoom

- Targets ≥ 44 × 44 px on touch layouts (24 × 24 minimum with spacing on desktop, per 2.5.8).
- Page works at 200 % zoom and 320 px reflow without loss of content. Never disable pinch zoom.

## 8. Checks before done

- [ ] `@axe-core/playwright` scan on every route reports zero serious or critical violations.
- [ ] Manual keyboard pass: complete the main flow (set field → explore → compare → evidence) with keyboard only.
- [ ] Reduced-motion emulation pass shows no movement beyond short fades.
- [ ] Lighthouse accessibility ≥ 90 (target 100).
