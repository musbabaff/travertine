import { expect, test } from "@playwright/test";
import { DEMO_QUERY, fakeEngine } from "./engine";

test.describe("Sensitivity test, farmer inputs and hazards", () => {
  test("rainfall and temperature sliders send a scenario", async ({ page }) => {
    await fakeEngine(page);
    const bodies: Record<string, unknown>[] = [];
    page.on("request", (r) => r.url().endsWith("/v1/rotations/explore") && r.method() === "POST" && bodies.push(JSON.parse(r.postData() ?? "{}")));
    await page.goto(`/app/explore?${DEMO_QUERY}`);
    const panel = page.getByTestId("scenario-panel");
    await expect(panel).toContainText("not a forecast");
    await panel.getByRole("slider", { name: "Rainfall" }).focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => bodies.some((b) => (b.scenario as { precipitation_factor?: number } | undefined)?.precipitation_factor !== undefined)).toBe(true);
  });

  test("the farmer's soil test is sent and the sources table appears", async ({ page }) => {
    await fakeEngine(page);
    const bodies: Record<string, unknown>[] = [];
    page.on("request", (r) => r.url().endsWith("/v1/rotations/explore") && r.method() === "POST" && bodies.push(JSON.parse(r.postData() ?? "{}")));
    await page.goto(`/app/explore?${DEMO_QUERY}`);
    const form = page.getByTestId("farmer-inputs");
    await form.locator("summary").click();
    await form.getByLabel(/^Sand/).fill("75");
    await form.getByRole("button", { name: "Apply" }).click();
    await expect(form.getByRole("alert")).toContainText("Give sand and clay together");
    await form.getByLabel(/^Clay/).fill("8");
    await form.getByRole("button", { name: "Apply" }).click();
    await expect.poll(() => bodies.some((b) => JSON.stringify(b.farmer_inputs ?? null).includes('"sand_pct":75'))).toBe(true);
    await expect(page.getByTestId("input-sources")).toContainText("soil.texture_class");
  });

  test("the field page shows the climate hazards", async ({ page }) => {
    await fakeEngine(page);
    await page.goto(`/app?${DEMO_QUERY}`);
    const hazards = page.getByTestId("hazards");
    await expect(hazards).toContainText("Frost days");
    await expect(hazards).toContainText("Longest dry spell");
  });
});
