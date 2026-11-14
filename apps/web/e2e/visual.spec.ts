import { expect, test, type Page } from "@playwright/test";
import { DEMO_QUERY, fakeEngine, type EngineMode } from "./engine";

/**
 * Screenshot capture for the visual-review skill. Run with `pnpm test:visual`.
 * Output: apps/web/screenshots/<route>/<state>-<viewport>.png (git-ignored).
 */
const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 900 },
];

const STATES: { name: string; mode: EngineMode; query: string; locale?: "tr"; ready: (p: Page) => Promise<void> }[] = [
  { name: "empty", mode: "ok", query: "", ready: (p) => expect(p.getByText(/Mark a field/)).toBeVisible() },
  { name: "loaded", mode: "ok", query: DEMO_QUERY, ready: (p) => expect(p.getByText("Clay loam")).toBeVisible() },
  { name: "loading", mode: "slow", query: DEMO_QUERY, ready: (p) => expect(p.locator("[aria-busy=true]")).toBeVisible() },
  { name: "error", mode: "error", query: DEMO_QUERY, ready: (p) => expect(p.getByRole("complementary").getByRole("alert")).toBeVisible() },
  { name: "fallback", mode: "down", query: DEMO_QUERY, ready: (p) => expect(p.getByTestId("demo-badge")).toBeVisible() },
  { name: "loaded-tr", mode: "ok", query: DEMO_QUERY, locale: "tr", ready: (p) => expect(p.getByText("Killi tın")).toBeVisible() },
];

test.describe.configure({ mode: "parallel" });

for (const vp of VIEWPORTS) {
  for (const s of STATES) {
    test(`field ${s.name} @${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      if (s.locale) await page.addInitScript(() => localStorage.setItem("travertine.locale", "tr"));
      await fakeEngine(page, s.mode);
      await page.goto(`/app${s.query ? `?${s.query}` : ""}`);
      await s.ready(page);
      await page.waitForTimeout(3000); // let the camera move finish and tiles settle
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, "horizontal overflow").toBeLessThanOrEqual(0);
      await page.screenshot({ path: `screenshots/field/${s.name}-${vp.name}.png`, fullPage: true });
    });
  }
}
