import { expect, test, type Page } from "@playwright/test";
import en from "../src/i18n/en.json";
import tr from "../src/i18n/tr.json";
import { fakeEngine } from "./engine";

/** Like the engine: a current rotation longer than the horizon is rejected with 422. */
async function strictExplore(page: Page) {
  await page.route("http://engine.test/v1/rotations/explore", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    if ((body.current_rotation?.length ?? 0) > body.horizon_years) {
      return route.fulfill({
        status: 422,
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        body: JSON.stringify({ code: "invalid_request", message: "current_rotation is longer than horizon_years." }),
      });
    }
    return route.fallback();
  });
}

for (const [lang, dict] of [["en", en], ["tr", tr]] as const) {
  test.describe(`current rotation and horizon (${lang})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((l) => {
        localStorage.setItem("travertine.locale", l);
        localStorage.setItem("travertine-cosmo-intro-v4", "seen");
      }, lang);
      await fakeEngine(page);
      await strictExplore(page);
    });

    test("shortening the horizon shortens the current rotation", async ({ page }) => {
      await page.goto("/app/explore?lat=37.89&lon=28.98&h=4&cur=cotton,cotton,cotton,cotton");
      await page.getByRole("radio", { name: dict["explore.horizon.years"].replace("{n}", "3") }).click();
      await expect(page).toHaveURL(/h=3/);
      await expect(page).toHaveURL(/cur=cotton%2Ccotton%2Ccotton(&|$)/);
      await expect(page.getByTestId("current-rotation").locator("select")).toHaveCount(3);
      await expect(page.locator("[data-testid=reasoning], article, li").first()).toBeVisible();
      await expect(page.getByText(dict["explore.error.title"])).toHaveCount(0);
    });

    test("a shared link with more crops than years loads without an error", async ({ page }) => {
      await page.goto("/app/explore?lat=37.89&lon=28.98&h=3&cur=cotton,cotton,cotton,cotton");
      await expect(page.getByTestId("current-rotation")).toBeVisible();
      await expect(page.getByText(dict["explore.error.title"])).toHaveCount(0);
      await expect(page.getByText("current_rotation is longer")).toHaveCount(0);
      await expect(page.getByTestId("current-rotation").locator("select")).toHaveCount(3);
    });
  });
}
