import { expect, test } from "@playwright/test";
import { fakeEngine } from "./engine";

test("Cosmo modeli ve ekran turu", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await fakeEngine(page);
  await page.goto("/");

  const tour = page.getByRole("dialog", { name: "Cosmo ile sistem tanıtımı" });
  await expect(tour).toBeVisible();
  await expect(tour.getByRole("heading", { name: "Merhaba, ben Cosmo!" })).toBeVisible();
  await expect(page.locator(".cosmo-tour-guide .cosmo-stage.is-live")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".cosmo-tour-guide canvas")).toBeVisible();
  await expect(page.locator(".cosmo-tour-speech")).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: "screenshots/integration/cosmo-intro-1440.png" });

  for (const title of ["Genel Bakış", "İklim geçmişi", "Tarla sağlığı", "Su dengesi", "Tarla görünümü", "Tarla İzleme"]) {
    await tour.getByRole("button", { name: /Tanıtıma başla|İklimi incele|Toprağa geç|Su dengesini gör|Tarla görünümüne geç|Tarla İzleme'yi aç/ }).click();
    await expect(tour.getByRole("heading", { name: title })).toBeVisible();
  }

  await tour.getByRole("button", { name: "Haritaya geç" }).click();
  await expect(page).toHaveURL(/\/app/);
  await expect(tour.getByRole("heading", { name: "Harita" })).toBeVisible();
  await tour.getByRole("button", { name: "Örnek tarla ile dene" }).click();
  await expect(tour.getByRole("heading", { name: "Örnek tarlayı seçelim" })).toBeVisible();
  await tour.getByRole("button", { name: "Örnek tarlayı seç" }).click();
  await expect(page).toHaveURL(/lat=/);
  await expect(tour.getByRole("heading", { name: "Tarla özeti" })).toBeVisible();
  await tour.getByRole("button", { name: "Ekim önerilerini aç" }).click();
  await expect(page).toHaveURL(/\/app\/explore\?.*lat=/);
  await expect(tour.getByRole("heading", { name: "Ekim Önerileri" })).toBeVisible();
  await tour.getByRole("button", { name: "Öncelikleri incele" }).click();
  await expect(tour.getByRole("heading", { name: "Öncelikleriniz" })).toBeVisible();
  await tour.getByRole("button", { name: "Sonuçları gör" }).click();
  await expect(tour.getByRole("heading", { name: "Sıralanmış seçenekler" })).toBeVisible();
  await tour.getByRole("button", { name: "Veri ve Yöntem'e geç" }).click();
  await expect(tour.getByRole("heading", { name: "Veri ve Yöntem" })).toBeVisible();
  await tour.getByRole("button", { name: "Kanıt ekranını aç" }).click();
  await expect(page).toHaveURL(/\/app\/evidence\?.*lat=/);
  await expect(tour.getByRole("heading", { name: "Model doğrulaması" })).toBeVisible();
  await tour.getByRole("button", { name: "Yöntemi incele" }).click();
  await expect(tour.getByRole("heading", { name: "Yöntem ve sınırlar" })).toBeVisible();
  await tour.getByRole("button", { name: "Turu tamamla" }).click();
  await expect(tour.getByRole("heading", { name: "Tur tamamlandı" })).toBeVisible();
  await tour.getByRole("button", { name: "Turu bitir" }).click();
  await expect(tour).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cosmo'ya sor" })).toBeVisible();
});

test("Cosmo mobilde tanıtım ve sohbet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fakeEngine(page);
  await page.goto("/");
  const tour = page.getByRole("dialog", { name: "Cosmo ile sistem tanıtımı" });
  await expect(tour).toBeVisible();
  await expect(page.locator(".cosmo-tour-guide .cosmo-stage.is-live")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".cosmo-tour-speech")).toBeVisible({ timeout: 10_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "screenshots/integration/cosmo-intro-390.png" });
  await tour.getByRole("button", { name: "Turu geç" }).click();
  await page.getByRole("button", { name: "Cosmo'ya sor" }).click();
  await expect(page.getByRole("dialog", { name: "Cosmo ile sohbet" })).toBeVisible();
  await expect(page.locator(".cosmo-chat .cosmo-stage.is-live")).toBeVisible({ timeout: 20_000 });
});
