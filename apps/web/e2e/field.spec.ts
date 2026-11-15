import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import ndvi30 from "../../../packages/contract/fixtures/field-ndvi.json";
import { DEMO_QUERY, fakeEngine } from "./engine";

test.describe("Field screen", () => {
  test("shows the empty state, then analyses the demo field", async ({ page }) => {
    await fakeEngine(page);
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "Your field" })).toBeVisible();
    await expect(page.getByText("Mark a field to begin")).toBeVisible();

    await page.getByRole("button", { name: "Use the Denizli demo field" }).click();
    await expect(page).toHaveURL(/lat=37\.8/);
    await expect(page.getByTestId("field-area")).toContainText("ha");
    await expect(page.getByText("Climate at a glance")).toBeVisible();
    await expect(page.getByText("Clay loam")).toBeVisible();
    await expect(page.getByText("Live engine")).toBeVisible();
  });

  test("shows 30 m NDVI beside the 250 m record", async ({ page }) => {
    await fakeEngine(page);
    await page.goto(`/app?${DEMO_QUERY}`);
    const box = page.getByTestId("ndvi30");
    await expect(box).toContainText("30 m HLS");
    await expect(box.locator("tbody tr")).toHaveCount(ndvi30.seasons.length);
    await expect(box).toContainText(ndvi30.caveats[0]);
  });

  test("never zooms satellite imagery beyond its native resolution", async ({ page }) => {
    await fakeEngine(page);
    await page.goto(`/app?${DEMO_QUERY}`);
    await page.getByRole("radio", { name: "Satellite" }).click();
    await expect(page.getByTestId("imagery-credit")).toBeVisible();
    // Without an ArcGIS key the 10 m Sentinel-2 layer is used, capped at zoom 14.
    await expect.poll(() => page.evaluate(() => (window as unknown as { __travertineMap?: { getMaxZoom(): number } }).__travertineMap?.getMaxZoom())).toBe(14);
  });

  test("restores the field from a shared URL and toggles irrigation", async ({ page }) => {
    await fakeEngine(page);
    await page.goto(`/app?${DEMO_QUERY}`);
    await expect(page.getByTestId("field-area")).toContainText("11");
    const sw = page.getByRole("switch", { name: "Irrigated" });
    await sw.click();
    await expect(sw).toHaveAttribute("aria-checked", "true");
    await expect(page).toHaveURL(/irr=1/);
  });

  test("draws a polygon by clicking the map", async ({ page }) => {
    await fakeEngine(page);
    await page.goto("/app");
    const map = page.getByTestId("field-map");
    await expect(map.locator("canvas")).toBeVisible();
    const box = (await map.boundingBox())!;
    const cx = box.x + box.width * 0.7, cy = box.y + box.height * 0.5;
    for (const [dx, dy] of [[0, 0], [80, 0], [80, 60], [0, 60]]) await page.mouse.click(cx + dx, cy + dy);
    await expect(page.getByText("4 corners")).toBeVisible();
    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page.getByTestId("field-area")).toContainText(/ha|m²/);
  });

  test("shows an error with retry when the engine rejects the field", async ({ page }) => {
    await fakeEngine(page, "error");
    await page.goto(`/app?${DEMO_QUERY}`);
    await expect(page.getByRole("complementary").getByRole("alert")).toContainText("No soil data for this location.");
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  test("falls back to fixtures and says so when the engine is down", async ({ page }) => {
    await fakeEngine(page, "down");
    await page.goto(`/app?${DEMO_QUERY}`);
    await expect(page.getByTestId("demo-badge")).toContainText("engine unreachable");
    await expect(page.getByText("Clay loam")).toBeVisible();
  });

  test("switches to Turkish", async ({ page }) => {
    await fakeEngine(page);
    await page.goto(`/app?${DEMO_QUERY}`);
    await page.getByRole("radio", { name: "TR" }).click();
    await expect(page.getByRole("heading", { name: "Tarlanız" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
  });

  test("has no serious accessibility violations", async ({ page }) => {
    await fakeEngine(page);
    await page.goto(`/app?${DEMO_QUERY}`);
    await expect(page.getByText("Clay loam")).toBeVisible();
    const results = await new AxeBuilder({ page }).exclude(".maplibregl-canvas").analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });
});
