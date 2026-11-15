import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import climate from "../../../packages/contract/fixtures/field-climate.json";
import soil from "../../../packages/contract/fixtures/field-soil.json";
import vegetation from "../../../packages/contract/fixtures/field-vegetation.json";
import validation from "../../../packages/contract/fixtures/validation.json";
import { DEMO_QUERY, fakeEngine } from "./engine";

test.describe("Data screen", () => {
  test("lists every dataset from the responses with its link", async ({ page }) => {
    await fakeEngine(page);
    await page.goto(`/app/data?${DEMO_QUERY}`);
    await expect(page.getByRole("heading", { name: /Datasets \(\d+\)/ })).toBeVisible();
    const names = new Set([...climate.provenance, ...soil.provenance, ...vegetation.provenance, ...validation.provenance].map((p) => p.dataset));
    for (const name of names) await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(page.getByText("Live engine").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Open dataset/ }).first()).toHaveAttribute("href", /^https:\/\//);
  });

  test("marks requests answered from fixtures", async ({ page }) => {
    await fakeEngine(page, "partial");
    await page.goto(`/app/data?${DEMO_QUERY}`);
    await expect(page.getByText("Demo data (contract fixture)").first()).toBeVisible();
  });

  test("shows crop sources and map services without a field", async ({ page }) => {
    await fakeEngine(page);
    await page.goto("/app/data");
    await expect(page.getByText("Choose a field to see its sources")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Crop parameters" })).toBeVisible();
    await expect(page.getByText(/EOxCloudless 2016/)).toBeVisible();
  });

  test("shows a failed request with retry", async ({ page }) => {
    await fakeEngine(page, "error");
    await page.goto(`/app/data?${DEMO_QUERY}`);
    await expect(page.getByText("Failed").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" }).first()).toBeVisible();
  });

  test("has no serious accessibility violations", async ({ page }) => {
    await fakeEngine(page);
    await page.goto(`/app/data?${DEMO_QUERY}`);
    await expect(page.getByRole("heading", { name: /Datasets/ })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
});
