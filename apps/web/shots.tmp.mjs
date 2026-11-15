import { chromium } from "@playwright/test";
const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3];
const q = "lat=37.89&lon=28.98";
const routes = [["landing", "/"], ["overview", `/app/overview?${q}`], ["field", `/app?${q}`], ["explore", `/app/explore?${q}&h=3`], ["plan", `/app/plan?${q}&plan=winter_wheat,lentil,sunflower,barley`], ["evidence", `/app/evidence?${q}`], ["data", `/app/data?${q}`]];
const browser = await chromium.launch({ channel: "msedge" });
for (const lang of ["en", "tr"]) for (const [w, h] of [[390, 844], [1440, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript((l) => { localStorage.setItem("travertine.locale", l); localStorage.setItem("travertine-cosmo-intro-v4", "seen"); }, lang);
  const page = await ctx.newPage();
  for (const [name, path] of routes) {
    await page.goto(base + path, { waitUntil: "networkidle", timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(4000);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    await page.screenshot({ path: `${out}/${name}-${lang}-${w}.png`, fullPage: true });
    console.log(name, lang, w, "scrollWidth", sw);
  }
  await ctx.close();
}
await browser.close();
