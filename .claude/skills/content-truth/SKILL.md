---
name: content-truth
description: Rules that keep every number, label and claim in Travertine traceable to real data. Use whenever you write UI copy, fixtures, docs, landing-page text, or render any value in apps/web.
---

# Content truth

Our competitive edge is honesty. One invented number destroys it. These rules are absolute.

## 1. Every number has a source

- Every number rendered in the UI comes from an API response (live or the contract fixture served by the mock layer).
  **No literals for data values in components**, no client-side "estimates" that the engine did not compute.
- Allowed client-side computation: unit formatting, rounding for display, sorting, and arithmetic that is plainly
  derived and labelled (e.g. field area from the drawn polygon, difference between two shown rotations).
- Copy on the landing page, tour and docs may quote only: numbers returned by the API for the demo field (fetched at
  build/runtime, not pasted), or figures from a cited published source with a link in `docs/` or on the page.
- Fixtures are realistic and traceable (see CLAUDE.md §5). When a fixture value is illustrative rather than measured,
  its provenance `note` says so, and the UI shows the Demo data badge.

## 2. Every dataset shows provenance

- Every response's `provenance[]` items are rendered: inline as a provenance chip next to the values they produced,
  and in full in the Data view (dataset, provider, spatial resolution, temporal coverage, access link, note).
- If a value has no matching provenance item, it is a bug — do not render the value; log it and show "Source missing".
- Uncertainty, ranges, sample sizes and caveats from the API are shown wherever the value is shown — not hidden in a
  tooltip only.

## 3. Caveats are shown verbatim

- Validation `caveats[]`, `method`, `n` and `correlation` are rendered exactly as returned. No paraphrasing, no
  reordering for optics, no hiding behind "Show more" on first view, no rounding that changes meaning
  (show correlation to two decimals, `n` exactly).
- A weak or negative correlation is displayed just as prominently as a strong one.

## 4. Copy rules

- No unsupported claims. Banned unless backed by a cited source on the same page: "proven", "guaranteed",
  "increases yield by", "saves X % water", "AI-powered", "accurate", "precise", "best", "optimal".
- Prefer: "estimated", "modelled", "based on <dataset> <years>", "in past years at this location".
- Scores are relative rankings under the user's priorities, not predictions. Say so near the ranking.
- Never imply NASA endorsement. Dataset names are factual ("NASA POWER daily data, 0.5° × 0.625°").
- Mock layer active → the Demo data badge is visible on every screen. Never remove or hide it while on fixtures.

## 5. Checks before done

- [ ] `grep -rnE "[0-9]+(\.[0-9]+)?\s?(mm|%|°C|ha|kg)" apps/web/src --include=*.tsx` — every hit is a unit label or a
      formatter, not a data value.
- [ ] Every chart, card and table on the screen has at least one provenance chip that resolves to a provenance item.
- [ ] Banned words grep over `apps/web/src/i18n/*.json` returns nothing unsupported.
- [ ] Validation caveats on screen match the fixture/API response string-for-string (covered by a unit test).
