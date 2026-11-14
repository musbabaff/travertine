# Travertine brand

The Travertine logo is a teal terraced mark — stepped pools, like the travertine terraces of Pamukkale in the demo
region — above or beside the word TRAVERTINE in navy. These files are the only approved versions.

## Files

| File | Use |
|---|---|
| `original/travertine-logo-original.png` | The original artwork as supplied (1254 × 1254 px, unmodified). Source of everything below. |
| `original/*` (favicons, `site.webmanifest`) | The originally supplied favicon set, kept unmodified for reference. The site uses the mark-only icons below instead, because the full logo is illegible at 16–32 px. |
| `travertine-mark.svg` | Mark only. Favicons, app icons, footers, small spaces. |
| `travertine-lockup-horizontal.svg` | Mark left, wordmark right. Site header, documents, printed plan. |
| `travertine-lockup-horizontal-on-dark.svg` | Same, wordmark in off-white, for navy or dark photos. |
| `travertine-logo-stacked.svg` | Mark above wordmark, as in the original. Landing hero, slides, posters. |
| `travertine-logo-stacked-on-dark.svg` | Same, for dark backgrounds. |
| `travertine-wordmark.svg`, `travertine-wordmark-on-dark.svg` | Wordmark only, where the mark already appears nearby. |
| `png/travertine-mark-1024.png`, `png/travertine-lockup-horizontal-2400.png` | High-resolution PNGs for tools that do not take SVG. |
| `../images/social-preview.png` | 1280 × 640 repository social preview. |

In the web app, use the components in `apps/web/src/components/brand/logo.tsx` (`BrandMark`, `BrandLockup`) rather
than the files, so the artwork stays inline and sharp. App icons live in `apps/web/src/app` (`favicon.ico`,
`icon.svg`, `apple-icon.png`, `opengraph-image.png`) and `apps/web/public/icons`.

### How the vectors were made

The SVGs are a faithful trace of the original PNG, not a redraw. `build/trace.py` separates the teal and navy pixels
and traces them with potrace; rendered back at the original size they match the original pixels with an
intersection-over-union of 0.990 (mark) and 0.991 (wordmark), with the differing pixels confined to the anti-aliased
edge. `build/build_svgs.py` composes the variants using only translation and uniform scaling;
`apps/web/scripts/build-brand-assets.mjs` and `build/build_ico.py` render the PNG and ICO files. Re-run them in that
order after any change to the original.

## Colours

Sampled from the original artwork (median of the solid pixels).

| Name | Hex | Use |
|---|---|---|
| Brand teal | `#5CB0B5` | **The mark only.** 2.36:1 on off-white: never use it for text, links, icons or controls. |
| Brand navy | `#061832` | Wordmark, primary text (`--color-ink`, 16.6:1 on off-white). |
| Brand off-white | `#FAF7F2` | Background behind the logo, cards and header (`--color-surface`). |
| Text teal | `#1F666B` | Accessible teal for links and buttons (`--color-teal-700`, 6.2:1; white on it 6.6:1). Same hue as the brand teal. |

`.claude/skills/data-viz/check-palette.mjs` reads the tokens from `apps/web/src/app/globals.css` and checks every
pair in CI.

## Clear space

Keep a clear space of **X** on every side, where X is the cap height of the wordmark in that lockup. For the mark on
its own, X is a quarter of the mark's height. Nothing — text, edges, other logos — enters that space.

## Minimum size

| Version | Minimum on screen | Minimum in print |
|---|---|---|
| Horizontal lockup | 24 px tall (wordmark caps ≈ 8 px) | 8 mm tall |
| Stacked logo | 64 px tall | 20 mm tall |
| Mark only | 16 px wide | 5 mm wide |

Below the lockup minimum, use the mark alone.

## Do not

- Stretch, squash, rotate, skew or crop the mark or the wordmark.
- Recolour the mark. It is always brand teal, on light and on dark backgrounds.
- Recolour the wordmark in anything other than navy (light backgrounds) or off-white (dark backgrounds).
- Add outlines, shadows, glows, gradients or textures.
- Rearrange, re-space or retype the wordmark, or set "Travertine" in another typeface as a logo.
- Place the logo on busy imagery or on a background with too little contrast for the wordmark.
- Combine the logo with NASA logos, insignia or mission patches, or with any other organisation's mark in a way that
  implies endorsement. Travertine is independent and not affiliated with NASA.
