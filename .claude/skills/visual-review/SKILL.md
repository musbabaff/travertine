---
name: visual-review
description: Mandatory screenshot review after building or changing any screen in apps/web. Run the app, capture 390/768/1440 px screenshots, inspect them, list and fix defects. A screen is not done until its screenshots pass.
---

# Visual review

A screen is **not done** until this review passes. Do it after every change that affects what a user sees, before
reporting the work as finished or opening a PR.

## 1. Run the app

```bash
pnpm dev                      # mock layer (fixtures) unless NEXT_PUBLIC_ENGINE_URL is set
```

Review on fixtures first, then against the engine if one is available.

## 2. Capture screenshots

Use the Playwright script `apps/web/e2e/visual.spec.ts` (`pnpm --filter web test:visual`) or the in-app browser.
Capture every touched route at these viewports:

| Name | Width × height |
|---|---|
| mobile | 390 × 844 |
| tablet | 768 × 1024 |
| desktop | 1440 × 900 |

For each route capture **all states**: loaded, loading (throttle or force skeleton), empty, error (force a failed
request), and any open panel/dialog. Also capture: keyboard focus visible on the first three focusable elements, and the
Turkish locale for the loaded state (longer strings break layouts first).

Screenshots go to `apps/web/screenshots/<route>/<state>-<viewport>.png` (git-ignored). Full-page where the page scrolls.

## 3. Inspect — open every screenshot and check

Look at each image yourself. Do not skip this or infer from code.

- **Alignment**: edges line up to a common column; labels align with their controls; icons are optically centred.
- **Spacing**: only design-system steps; consistent gaps between siblings; no element touching a container edge;
  page gutter correct for the viewport.
- **Overflow**: no horizontal page scroll; no clipped text; long Turkish strings wrap, not truncate mid-word, unless an
  ellipsis plus tooltip is intentional; tables scroll inside their own container on mobile.
- **Hierarchy**: one obvious primary action per region; title → content → action order is readable at a glance.
- **Contrast**: text meets AA (see `accessibility`); nothing relies on colour alone.
- **States**: loading has skeletons in the content's shape; empty and error states have a title, a sentence and an
  action; nothing renders as a blank box.
- **Data**: every number has a unit and a provenance chip; no `NaN`, `undefined`, `null`, `[object Object]` or raw ISO
  timestamps; the Demo data badge is visible when on fixtures.
- **Touch**: targets ≥ 44 × 44 px at 390 px.
- **Map**: attribution visible and unobstructed; overlays do not cover the selected field on any viewport.

## 4. Report and fix

Write a defect list in this form, then fix every item and re-capture the affected screenshots:

```
route: /app/explore  viewport: 390
1. [overflow] rotation card crop names overflow at year 5 (Turkish) — fix: allow wrap, min-width 0
2. [spacing] slider labels 6 px from track, should be 8
```

Repeat until a full pass finds no defects. In the final report state: routes reviewed, viewports, states, number of
defects found and fixed, and anything knowingly deferred (with reason).

## 5. Live review on the deployed site (mandatory, after every merge)

Mocked tiles and fixtures hide real problems: blurry imagery, slow cold starts, real engine text in Turkish, layout
with real data lengths. A defect the human can see in thirty seconds on a phone must never reach them. So, once a
change is live on https://travertinefields.com (check the `travertine-commit` meta tag matches the merged commit):

1. Open the production URL in a real browser with **real network data**: no route interception, no fixtures, no
   `fakeEngine`.
2. At **390 px and 1440 px**, exercise the real flow end to end:
   - choose a field (the demo field **and** one field elsewhere, ideally on another continent);
   - wait for the real engine responses (they can take minutes on a cold location; the slow hint must show);
   - switch map views (Map and Satellite) and zoom in on the field;
   - open Explore, move a slider, change the horizon; open Evidence;
   - switch the language to Turkish and back.
3. Take screenshots at each step, **open and look at every one**, and list defects as in §4.
4. Fix, merge, and repeat the live pass until clean. Only then report the item as done, and include the live
   screenshots (or the most relevant ones) in the report.

Script it with Playwright against the production URL (`page.goto("https://travertinefields.com/...")`, no
`page.route`), or drive the built-in browser pane. Record in the report which fields, viewports and steps were run
live, and which real responses were slow or failed.

## 6. Pass criteria (all must hold)

- [ ] All touched routes × 3 viewports × all states captured and opened.
- [ ] Zero open defects, or each deferred one listed with a reason and agreed with the human.
- [ ] No horizontal scroll at 390 px (`document.documentElement.scrollWidth <= 390`).
- [ ] No console errors or React warnings during the capture run.
- [ ] The live pass of §5 ran on production with real data at 390 and 1440 px and found no open defects.
