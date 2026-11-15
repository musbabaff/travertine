import { expect, test } from "@playwright/test";
import { DEMO_QUERY, fakeEngine } from "./engine";

test("Cosmo guided tour across the app (English)", async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await fakeEngine(page);
  await page.goto("/app/overview");

  const tour = page.getByRole("dialog", { name: "Guided tour with Cosmo" });
  await expect(tour).toBeVisible();
  await expect(tour.getByRole("heading", { name: "Hello, I'm Cosmo!" })).toBeVisible();
  await expect(page.locator(".cosmo-tour-guide .cosmo-stage.is-live")).toBeVisible({ timeout: 30_000 });

  const steps: [string, string][] = [
    ["Start the tour", "Overview"],
    ["Look at the climate", "Climate record"],
    ["Go to the soil", "Soil and vegetation"],
    ["See the water balance", "Water balance"],
    ["Go to the field view", "Field view"],
    ["Open the field screen", "Field"],
  ];
  for (const [button, heading] of steps) {
    await tour.getByRole("button", { name: button }).click();
    await expect(tour.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await tour.getByRole("button", { name: "Go to the map" }).click();
  await expect(page).toHaveURL(/\/app/);
  await expect(tour.getByRole("heading", { name: "Map" })).toBeVisible();
  await tour.getByRole("button", { name: "Try the demo field" }).click();
  await tour.getByRole("button", { name: "Select the demo field" }).click();
  await expect(page).toHaveURL(/lat=/);
  await expect(tour.getByRole("heading", { name: "Field summary" })).toBeVisible();
  await tour.getByRole("button", { name: "Open rotations" }).click();
  await expect(page).toHaveURL(/\/app\/explore\?.*lat=/);
  await tour.getByRole("button", { name: "Look at priorities" }).click();
  await tour.getByRole("button", { name: "See the results" }).click();
  await tour.getByRole("button", { name: "Go to Evidence" }).click();
  await tour.getByRole("button", { name: "Open the evidence screen" }).click();
  await expect(page).toHaveURL(/\/app\/evidence\?.*lat=/);
  await tour.getByRole("button", { name: "Read the method" }).click();
  await tour.getByRole("button", { name: "Finish the tour" }).click();
  await expect(tour.getByRole("heading", { name: "Tour complete" })).toBeVisible();
  await tour.getByRole("button", { name: "Close the tour" }).first().click();
  await expect(tour).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ask Cosmo" })).toBeVisible();
});

test("Cosmo follows the language toggle and answers glossary questions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("travertine-cosmo-intro-v4", "seen"));
  await fakeEngine(page);
  await page.goto(`/app/evidence?${DEMO_QUERY}`);
  await page.getByRole("button", { name: "Ask Cosmo" }).click();
  const chat = page.getByRole("dialog", { name: "Chat with Cosmo" });
  await expect(chat).toBeVisible();
  await chat.getByRole("button", { name: "What is evapotranspiration?" }).click();
  await expect(chat.getByText(/Evapotranspiration is the water that leaves a field as vapour/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);

  await chat.getByRole("button", { name: "Close the chat" }).click();
  await page.getByRole("radio", { name: "TR" }).click();
  await page.getByRole("button", { name: "Cosmo'ya sor" }).click();
  const sohbet = page.getByRole("dialog", { name: "Cosmo ile sohbet" });
  await expect(sohbet.getByText(/Evapotranspirasyon, tarladan buhar olarak ayrılan sudur/)).toBeVisible();
});

test("The landing page does not load the 3D model", async ({ page }) => {
  const glb: string[] = [];
  page.on("request", (r) => r.url().endsWith(".glb") && glb.push(r.url()));
  await fakeEngine(page);
  await page.goto("/");
  await page.waitForTimeout(3000);
  await expect(page.getByRole("dialog", { name: "Guided tour with Cosmo" })).toHaveCount(0);
  expect(glb).toEqual([]);
});
