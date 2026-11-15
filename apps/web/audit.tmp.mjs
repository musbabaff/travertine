import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "msedge" });
const q = "lat=37.89&lon=28.98";
const routes = ["/", `/app/overview?${q}`, `/app?${q}`, `/app/explore?${q}`, `/app/plan?${q}&plan=winter_wheat,lentil,sunflower,barley`, `/app/evidence?${q}`, `/app/data?${q}`];
for (const path of routes) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem("travertine-cosmo-intro-v4", "seen"));
  const page = await ctx.newPage();
  const seen = [];
  page.on("response", (r) => { if (r.url().includes("api.travertinefields.com")) seen.push(`${new URL(r.url()).pathname} ${r.status()}`); });
  await page.goto("https://travertinefields.com" + path, { waitUntil: "networkidle", timeout: 180000 }).catch(() => {});
  await page.waitForTimeout(8000);
  const badge = await page.evaluate(() => document.querySelector("[data-testid=demo-badge]") ? "DEMO BADGE" : document.querySelector("[data-testid=live-badge]") ? "live" : "none");
  const warn = await page.evaluate(() => [...document.querySelectorAll(".text-warning")].map((e) => e.textContent.trim()).filter((t) => /demo|örnek/i.test(t)).slice(0, 2));
  console.log(path.split("?")[0], badge, [...new Set(seen)].join(", "), warn.length ? "| labels: " + warn.join(" / ") : "");
  await ctx.close();
}
await browser.close();
