import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import exploreFixture from "../../../packages/contract/fixtures/rotations-explore.json";
import { DEMO_QUERY, fakeEngine } from "./engine";

const rankings = (page: import("@playwright/test").Page) => page.locator("ol > li article h3");

test.describe("Explore screen", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("travertine.locale", "en"));
  });
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

test.describe("Current rotation as baseline", () => {
  test("shows the baseline with rule violations and the difference on every alternative", async ({ page }) => {
    await fakeEngine(page);
    const fixture = exploreFixture;
    await page.route("http://engine.test/v1/rotations/explore", async (route) => {
      if (route.request().method() === "OPTIONS") return route.fallback();
      const body = route.request().postDataJSON();
      const [base, ...rest] = fixture.rotations;
      const delta = (r: typeof base) => Object.fromEntries((["water", "income", "soil", "risk", "total"] as const).map((k) => [k, +(r.scores[k] - base.scores[k]).toFixed(3)]));
      const response = body.current_rotation
        ? { ...fixture, rotations: rest.map((r) => ({ ...r, vs_baseline: delta(r) })), baseline: { ...base, rule_violations: [{ rule: "no_legume_in_cycle", message: "Test message: the sequence has no legume." }] } }
        : fixture;
      return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify(response) });
    });
    await page.goto(`/app/explore?${DEMO_QUERY}&cur=${fixture.rotations[0].sequence.join(",")}`);
    await expect(page.getByTestId("baseline-card")).toBeVisible();
    await expect(page.getByTestId("rule-violations")).toContainText("Test message: the sequence has no legume.");
    await expect(page.getByText("Differences from your current rotation").first()).toBeVisible();
  });
});
