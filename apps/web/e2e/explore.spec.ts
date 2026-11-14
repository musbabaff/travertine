import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { DEMO_QUERY, fakeEngine } from "./engine";

const rankings = (page: import("@playwright/test").Page) => page.locator("ol > li article h3");

test.describe("Explore screen", () => {
  test("asks for a field when none is set", async ({ page }) => {
    await fakeEngine(page);
    await page.goto("/app/explore");
    await expect(page.getByText("Choose a field first")).toBeVisible();
    await page.getByRole("link", { name: "Go to Field" }).click();
    await expect(page).toHaveURL(/\/app$/);
  });

  test("shows ranked rotation cards with scores and explanations", async ({ page }) => {
    await fakeEngine(page);
    await page.goto(`/app/explore?${DEMO_QUERY}`);
    await expect(rankings(page)).toHaveCount(5);
    await expect(rankings(page).first()).toContainText("Winter wheat");
    await expect(page.getByText("Why this ranking").first()).toBeVisible();
    await page.getByRole("button", { name: "Water by year" }).first().click();
    await expect(page.getByRole("img", { name: /water demand and deficit/ }).first()).toBeVisible();
  });

  test("re-ranks when priorities change and keeps them in the URL", async ({ page }) => {
    await fakeEngine(page, "down"); // engine unreachable → mock layer re-ranks fixture scores
    await page.goto(`/app/explore?${DEMO_QUERY}&p=1,0,0,0&h=4`);
    await expect(rankings(page)).toHaveCount(5);
    const waterTop = await rankings(page).first().textContent();
    for (const name of ["Save water", "Income"]) {
      const slider = page.getByRole("slider", { name });
      await slider.focus();
      await page.keyboard.press(name === "Income" ? "End" : "Home");
    }
    await expect(page).toHaveURL(/p=0\.00%2C1\.00%2C0\.00%2C0\.00/);
    await expect(rankings(page).first()).not.toHaveText(waterTop ?? "");
    await expect(rankings(page).first()).toContainText("Maize");
  });

  test("compares two rotations side by side", async ({ page }) => {
    await fakeEngine(page);
    await page.goto(`/app/explore?${DEMO_QUERY}`);
    const compare = page.getByRole("button", { name: "Compare", exact: true });
    await compare.nth(0).click();
    await compare.nth(2).click();
    await page.getByRole("button", { name: "Compare side by side" }).click();
    const dialog = page.getByRole("dialog", { name: "Side-by-side comparison" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Total water deficit")).toHaveCount(2);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("shows an error with retry", async ({ page }) => {
    await fakeEngine(page, "error");
    await page.goto(`/app/explore?${DEMO_QUERY}`);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Could not load rotations");
  });

  test("has no serious accessibility violations", async ({ page }) => {
    await fakeEngine(page);
    await page.goto(`/app/explore?${DEMO_QUERY}`);
    await expect(rankings(page)).toHaveCount(5);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });
});
