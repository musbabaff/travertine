import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import validation from "../../../packages/contract/fixtures/validation.json";
import { DEMO_QUERY, fakeEngine } from "./engine";

test.describe("Evidence screen", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("travertine.locale", "en"));
  });
  test("asks for a field when none is set", async ({ page }) => {
    await fakeEngine(page);
    await page.goto("/app/evidence");
    await expect(page.getByText("Choose a field first")).toBeVisible();
  });

  test("shows correlation, n, method and every caveat exactly as returned", async ({ page }) => {
    await fakeEngine(page);
    await page.goto(`/app/evidence?${DEMO_QUERY}`);
    await expect(page.getByTestId("correlation")).toHaveText(`r = ${validation.correlation.toFixed(2)}`);
    await expect(page.getByText(`n = ${validation.n}`, { exact: true })).toBeVisible();
    await expect(page.getByTestId("method")).toHaveText(validation.method);
    const items = page.getByTestId("caveats").locator("li");
    await expect(items).toHaveCount(validation.caveats.length);
    for (const [i, c] of validation.caveats.entries()) await expect(items.nth(i)).toHaveText(c);
    // Served by the (fake) engine itself: no baseline banner.
    await expect(page.getByTestId("baseline-note")).toHaveCount(0);
  });

  test("compares the model with the baseline, both intervals and the verdict", async ({ page }) => {
    await fakeEngine(page);
    await page.goto(`/app/evidence?${DEMO_QUERY}`);
    const box = page.getByTestId("model-vs-baseline");
    await expect(box).toContainText(validation.baseline!.name);
    await expect(box).toContainText(`95 % interval ${validation.correlation_ci95![0].toFixed(2)} to ${validation.correlation_ci95![1].toFixed(2)}`);
    await expect(box).toContainText(`95 % interval ${validation.baseline!.correlation_ci95[0].toFixed(2)} to ${validation.baseline!.correlation_ci95[1].toFixed(2)}`);
    await expect(page.getByTestId("verdict")).toContainText("No detectable difference between the model and the baseline: the interval of the difference includes 0.");
  });

  test("labels the fixture as demo data when the engine does not serve validation", async ({ page }) => {
    await fakeEngine(page, "partial");
    await page.goto(`/app/evidence?${DEMO_QUERY}`);
    await expect(page.getByTestId("baseline-note")).toContainText("Demo data: the published back-test");
    await expect(page.getByTestId("live-badge")).toBeVisible();
  });

  test("reads each year from the keyboard and offers a table", async ({ page }) => {
    await fakeEngine(page);
    await page.goto(`/app/evidence?${DEMO_QUERY}`);
    await page.getByRole("img", { name: /Back-test/ }).focus();
    await page.keyboard.press("Home");
    await expect(page.getByText(`${validation.years[0].year}: stress`)).toBeVisible();
    await page.getByRole("button", { name: "View as table" }).click();
    await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(validation.years.length);
  });

  test("shows an error with retry", async ({ page }) => {
    await fakeEngine(page, "error");
    await page.goto(`/app/evidence?${DEMO_QUERY}`);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Could not load the back-test");
  });

  test("has no serious accessibility violations", async ({ page }) => {
    await fakeEngine(page);
    await page.goto(`/app/evidence?${DEMO_QUERY}`);
    await expect(page.getByTestId("correlation")).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
});
