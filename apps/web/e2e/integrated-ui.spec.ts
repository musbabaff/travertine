import { expect, test } from "@playwright/test";
import { DEMO_QUERY, fakeEngine } from "./engine";

for (const width of [390, 1440]) {
  test(`New interface and data flow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem("travertine-cosmo-intro-v4", "seen"));
    await fakeEngine(page);
    await page.goto(`/app/overview?${DEMO_QUERY}`);

    await expect(page.getByRole("heading", { name: "Your field at a glance" })).toBeVisible();
    await expect(page.getByText("Mean annual temperature").first()).toBeVisible();
    await expect(page.getByText("Clay loam")).toBeVisible();
    await expect(page.getByRole("link", { name: "Inspect the field" })).toHaveAttribute("href", /lat=/);
    // No navigation to features without a data source.
    for (const name of ["Harvest", "Irrigation", "Notifications", "Hasat", "Sulama"]) await expect(page.getByRole("link", { name })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `screenshots/integration/overview-${width}.png`, fullPage: true });

    await page.getByRole("link", { name: "Explore rotations" }).click();
    await expect(page).toHaveURL(/\/app\/explore\?.*lat=/);
    await expect(page.getByText("Why this ranking").first()).toBeVisible();
    await page.screenshot({ path: `screenshots/integration/explore-${width}.png`, fullPage: true });

    await page.goto(`/app/evidence?${DEMO_QUERY}`);
    await expect(page.getByTestId("correlation")).toBeVisible();
    await page.screenshot({ path: `screenshots/integration/evidence-${width}.png`, fullPage: true });

    await page.goto(`/app/data?${DEMO_QUERY}`);
    await expect(page.getByRole("heading", { name: /Datasets/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `screenshots/integration/data-${width}.png`, fullPage: true });

    await page.goto(`/app?${DEMO_QUERY}`);
    await expect(page.getByRole("heading", { name: "Your field" })).toBeVisible();
    await page.waitForTimeout(3000);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `screenshots/integration/field-${width}.png` });
  });
}
