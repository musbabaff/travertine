import { expect, test } from "@playwright/test";
import { DEMO_QUERY, fakeEngine } from "./engine";

for (const width of [390, 1440]) {
  test(`Yeni arayüz ve veri akışı ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem("travertine-cosmo-intro-v4", "seen"));
    await fakeEngine(page);
    await page.goto(`/?${DEMO_QUERY}`);

    await expect(page.getByRole("heading", { name: "Çiftliğe genel bakış" })).toBeVisible();
    await expect(page.getByText("Yıllık ortalama sıcaklık")).toBeVisible();
    await expect(page.getByText("Toprak yapısı")).toBeVisible();
    await expect(page.getByText("Kök bölgesi ortalama nemi")).toBeVisible();
    await expect(page.getByRole("link", { name: "Tarlayı incele" })).toHaveAttribute("href", /lat=/);
    await expect(page.getByRole("link", { name: "Hasat" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Sulama" })).toHaveCount(0);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `screenshots/integration/dashboard-${width}.png`, fullPage: true });

    await page.getByRole("link", { name: "Ekim önerilerini gör" }).click();
    await expect(page).toHaveURL(/\/app\/explore\?.*lat=/);
    await expect(page.getByRole("heading", { name: "Ekim nöbetlerini keşfedin" })).toBeVisible();
    await expect(page.getByText("Kışlık buğday").first()).toBeVisible();
    await expect(page.getByText(/yıldaki tahmini su açığı/).first()).toBeVisible();
    await page.screenshot({ path: `screenshots/integration/explore-${width}.png`, fullPage: true });

    await page.goto(`/app/evidence?${DEMO_QUERY}`);
    await expect(page.getByRole("heading", { name: "Kanıt" })).toBeVisible();
    await expect(page.getByTestId("method")).toContainText("Pearson korelasyonu");
    await page.screenshot({ path: `screenshots/integration/evidence-${width}.png`, fullPage: true });

    await page.goto(`/app?${DEMO_QUERY}`);
    await expect(page.getByRole("heading", { name: "Tarlanız" })).toBeVisible();
    await page.waitForTimeout(3000);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `screenshots/integration/field-${width}.png`, fullPage: false });
  });
}
