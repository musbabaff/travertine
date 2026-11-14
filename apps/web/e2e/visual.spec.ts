import { expect, test, type Page } from "@playwright/test";
import { DEMO_QUERY, fakeEngine, type EngineMode } from "./engine";

/**
 * Screenshot capture for the visual-review skill. Run with `pnpm test:visual` (optionally `-g <route>`).
 * Output: apps/web/screenshots/<route>/<state>-<viewport>.png (git-ignored).
 */
const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 900 },
];

interface State {
  name: string;
  mode: EngineMode;
  query: string;
  locale?: "tr";
  ready: (p: Page) => Promise<void>;
  act?: (p: Page) => Promise<void>;
}

const alert = (p: Page) => expect(p.getByRole("main").getByRole("alert")).toBeVisible();

const ROUTES: Record<string, { path: string; settle: number; states: State[] }> = {
  field: {
    path: "/app",
    settle: 3000, // camera move + tiles
    states: [
      { name: "empty", mode: "ok", query: "", ready: (p) => expect(p.getByText(/Mark a field/)).toBeVisible() },
      { name: "loaded", mode: "ok", query: DEMO_QUERY, ready: (p) => expect(p.getByText("Clay loam")).toBeVisible() },
      { name: "loading", mode: "slow", query: DEMO_QUERY, ready: (p) => expect(p.locator("[aria-busy=true]")).toBeVisible() },
      { name: "error", mode: "error", query: DEMO_QUERY, ready: alert },
      { name: "fallback", mode: "down", query: DEMO_QUERY, ready: (p) => expect(p.getByTestId("demo-badge")).toBeVisible() },
      { name: "loaded-tr", mode: "ok", query: DEMO_QUERY, locale: "tr", ready: (p) => expect(p.getByText("Killi tın")).toBeVisible() },
    ],
  },
  explore: {
    path: "/app/explore",
    settle: 600,
    states: [
      { name: "no-field", mode: "ok", query: "", ready: (p) => expect(p.getByText("Choose a field first")).toBeVisible() },
      { name: "loaded", mode: "ok", query: DEMO_QUERY, ready: (p) => expect(p.getByText("Why this ranking").first()).toBeVisible() },
      {
        name: "water-open",
        mode: "ok",
        query: DEMO_QUERY,
        ready: (p) => expect(p.getByText("Why this ranking").first()).toBeVisible(),
        act: async (p) => {
          await p.getByRole("button", { name: "Water by year" }).first().click();
          await p.getByRole("button", { name: "Compare", exact: true }).nth(0).click();
        },
      },
      { name: "loading", mode: "slow", query: DEMO_QUERY, ready: (p) => expect(p.locator("[aria-busy=true]").first()).toBeVisible() },
      { name: "error", mode: "error", query: DEMO_QUERY, ready: alert },
      { name: "fallback", mode: "down", query: DEMO_QUERY, ready: (p) => expect(p.getByText("Demo data only includes 4-year rotations.")).toBeVisible() },
      {
        name: "compare",
        mode: "ok",
        query: DEMO_QUERY,
        ready: (p) => expect(p.getByText("Why this ranking").first()).toBeVisible(),
        act: async (p) => {
          const c = p.getByRole("button", { name: "Compare", exact: true });
          await c.nth(0).click();
          await c.nth(3).click();
          await p.getByRole("button", { name: "Compare side by side" }).click();
          await expect(p.getByRole("dialog")).toBeVisible();
        },
      },
      { name: "loaded-tr", mode: "ok", query: DEMO_QUERY, locale: "tr", ready: (p) => expect(p.getByText("Bu sıralamanın nedeni").first()).toBeVisible() },
    ],
  },
  evidence: {
    path: "/app/evidence",
    settle: 400,
    states: [
      { name: "no-field", mode: "ok", query: "", ready: (p) => expect(p.getByText("Choose a field first")).toBeVisible() },
      { name: "baseline", mode: "partial", query: DEMO_QUERY, ready: (p) => expect(p.getByTestId("baseline-note")).toBeVisible() },
      {
        name: "scatter",
        mode: "ok",
        query: DEMO_QUERY,
        ready: (p) => expect(p.getByTestId("correlation")).toBeVisible(),
        act: async (p) => {
          await p.getByRole("radio", { name: "Scatter" }).click();
          await p.getByRole("img", { name: /Back-test/ }).focus();
          await p.keyboard.press("End");
        },
      },
      {
        name: "table",
        mode: "ok",
        query: DEMO_QUERY,
        ready: (p) => expect(p.getByTestId("correlation")).toBeVisible(),
        act: async (p) => {
          await p.getByRole("img", { name: /Back-test/ }).focus();
          await p.keyboard.press("ArrowRight");
          await p.getByRole("button", { name: "View as table" }).click();
        },
      },
      { name: "loading", mode: "slow", query: DEMO_QUERY, ready: (p) => expect(p.locator("[aria-busy=true]").first()).toBeVisible() },
      { name: "error", mode: "error", query: DEMO_QUERY, ready: alert },
      { name: "fallback", mode: "down", query: DEMO_QUERY, ready: (p) => expect(p.getByTestId("baseline-note")).toBeVisible() },
      { name: "loaded-tr", mode: "partial", query: DEMO_QUERY, locale: "tr", ready: (p) => expect(p.getByText("Korelasyon").first()).toBeVisible() },
    ],
  },
};

test.describe.configure({ mode: "parallel" });

for (const [route, cfg] of Object.entries(ROUTES)) {
  for (const vp of VIEWPORTS) {
    for (const s of cfg.states) {
      test(`${route} ${s.name} @${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        if (s.locale) await page.addInitScript(() => localStorage.setItem("travertine.locale", "tr"));
        await fakeEngine(page, s.mode);
        await page.goto(`${cfg.path}${s.query ? `?${s.query}` : ""}`);
        await s.ready(page);
        await s.act?.(page);
        await page.waitForTimeout(cfg.settle);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, "horizontal overflow").toBeLessThanOrEqual(0);
        await page.screenshot({ path: `screenshots/${route}/${s.name}-${vp.name}.png`, fullPage: s.name !== "compare" });
      });
    }
  }
}
