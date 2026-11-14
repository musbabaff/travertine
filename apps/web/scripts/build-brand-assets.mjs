// Renders raster brand assets from the SVGs in docs/brand (built by docs/brand/build/build_svgs.py).
// Run from apps/web:  node scripts/build-brand-assets.mjs   (uses Playwright; PW_CHANNEL=msedge locally)
// Then:               python ../../docs/brand/build/build_ico.py
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const brand = join(root, "docs/brand");
const web = join(root, "apps/web");
const read = (f) => readFileSync(join(brand, f), "utf8");
const en = JSON.parse(readFileSync(join(web, "src/i18n/en.json"), "utf8"));

const PAPER = "#FAF7F2";
const NAVY = "#061832";
const mark = read("travertine-mark.svg");
const lockup = read("travertine-lockup-horizontal.svg");
const MW = 570, MH = 312;

/** Square icon: the mark centred, `fill` = share of the width it occupies. */
const squareIcon = (size, fill, bg) =>
  `<div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:${bg}">` +
  `<div style="width:${Math.round(size * fill)}px">${mark.replace("<svg ", '<svg width="100%" ')}</div></div>`;

const font = `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=block" rel="stylesheet">`;

/** Social card: lockup, tagline, domain. Text comes from en.json, nothing else is claimed. */
const card = (w, h) => `${font}
<div style="position:relative;width:${w}px;height:${h}px;background:${PAPER};box-sizing:border-box;padding:${Math.round(h * 0.13)}px ${Math.round(w * 0.075)}px;display:flex;flex-direction:column;justify-content:space-between;font-family:'IBM Plex Sans',sans-serif;color:${NAVY}">
  <div style="width:${Math.round(w * 0.42)}px">${lockup.replace("<svg ", '<svg width="100%" ')}</div>
  <div>
    <div style="font-size:${Math.round(h * 0.083)}px;line-height:1.15;font-weight:600;letter-spacing:-0.01em;max-width:16ch">${en["app.tagline"]}</div>
    <div style="margin-top:${Math.round(h * 0.04)}px;font-size:${Math.round(h * 0.036)}px;color:#5C5446">${en["home.eyebrow"]}</div>
  </div>
  <div style="font-size:${Math.round(h * 0.034)}px;font-weight:500;color:#1F666B">travertinefields.com</div>
  <div style="position:absolute;right:${Math.round(w * 0.07)}px;top:${Math.round(h * 0.5 - (w * 0.34 * MH) / MW / 2)}px;width:${Math.round(w * 0.34)}px">${mark.replace("<svg ", '<svg width="100%" ')}</div>
</div>`;

const jobs = [
  // App icons (opaque, paper background) and the maskable variant with an 80 % safe zone.
  ["apps/web/src/app/apple-icon.png", 180, 180, squareIcon(180, 0.74, PAPER)],
  ["apps/web/public/icons/icon-192.png", 192, 192, squareIcon(192, 0.76, PAPER)],
  ["apps/web/public/icons/icon-512.png", 512, 512, squareIcon(512, 0.76, PAPER)],
  ["apps/web/public/icons/icon-maskable-512.png", 512, 512, squareIcon(512, 0.58, PAPER)],
  // Favicon sources (transparent), packed into favicon.ico by build_ico.py.
  ["docs/brand/build/favicon-256.png", 256, 256, squareIcon(256, 0.96, "transparent")],
  // Social images.
  ["apps/web/src/app/opengraph-image.png", 1200, 630, card(1200, 630)],
  ["docs/images/social-preview.png", 1280, 640, card(1280, 640)],
  // High-resolution PNG exports for slides and documents.
  ["docs/brand/png/travertine-mark-1024.png", 1024, Math.round((1024 * MH) / MW), mark.replace("<svg ", '<svg width="100%" ')],
  ["docs/brand/png/travertine-lockup-horizontal-2400.png", 2400, Math.round((2400 * MH) / Number(lockup.match(/viewBox="0 0 (\d+)/)[1])), lockup.replace("<svg ", '<svg width="100%" ')],
];

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [out, w, h, html] of jobs) {
  mkdirSync(dirname(join(root, out)), { recursive: true });
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:transparent">${html}</body></html>`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(root, out), omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  console.log("wrote", out);
}

// Square SVG favicon for modern browsers (the mark centred in a square viewBox).
const pad = (MW - MH) / 2;
writeFileSync(join(web, "src/app/icon.svg"), mark.replace(`viewBox="0 0 ${MW} ${MH}"`, `viewBox="0 ${-pad} ${MW} ${MW}"`));
console.log("wrote apps/web/src/app/icon.svg");
await browser.close();
