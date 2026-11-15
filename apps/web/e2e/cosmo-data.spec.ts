import { expect, test } from "@playwright/test";
import tr from "../src/i18n/tr.json";
import { DEMO_QUERY, fakeEngine } from "./engine";

const T = tr as Record<string, string>;
const step = (i: number, part: "title" | "action") => T[`cosmo.tour.${i}.${part}`];

test("Cosmo guided tour runs end to end in Turkish", async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem("travertine.locale", "tr"));
  await fakeEngine(page);
  await page.goto("/app/overview");
  await page.keyboard.press("Shift");

  const tour = page.getByRole("dialog", { name: T["cosmo.tour.label"] });
  await expect(tour).toBeVisible();
  await expect(tour.getByRole("heading", { name: step(0, "title") })).toBeVisible();
  for (let i = 0; i <= 5; i++) {
    await tour.getByRole("button", { name: step(i, "action") }).click();
    await expect(tour.getByRole("heading", { name: step(i + 1, "title"), exact: true })).toBeVisible();
  }
  await tour.getByRole("button", { name: step(6, "action") }).click();
  await expect(page).toHaveURL(/\/app/);
  await tour.getByRole("button", { name: step(7, "action") }).click();
  await tour.getByRole("button", { name: step(8, "action") }).click();
  await expect(page).toHaveURL(/lat=/);
  for (let i = 9; i <= 15; i++) await tour.getByRole("button", { name: step(i, "action") }).click();
  await expect(page).toHaveURL(/\/app\/evidence\?.*lat=/);
  await expect(tour.getByRole("heading", { name: step(16, "title") })).toBeVisible();
  await tour.getByRole("button", { name: step(16, "action") }).first().click();
  await expect(tour).toHaveCount(0);
});

test("Without speech recognition the microphone is hidden and no error shows", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("travertine-cosmo-intro-v4", "seen");
    const w = window as unknown as Record<string, unknown>;
    delete w.webkitSpeechRecognition;
    delete w.SpeechRecognition;
  });
  await fakeEngine(page);
  await page.goto(`/app/explore?${DEMO_QUERY}`);
  await page.keyboard.press("Shift");
  await page.getByRole("button", { name: "Ask Cosmo" }).click();
  const chat = page.getByRole("dialog", { name: "Chat with Cosmo" });
  await expect(chat.getByText(/no working voice input, so the microphone is hidden/)).toBeVisible();
  await expect(chat.getByRole("button", { name: "Ask by voice" })).toHaveCount(0);
  await expect(chat.locator(".cosmo-voice-status")).toHaveCount(0);
});

test("Cosmo answers from the engine's rotations for the selected field", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("travertine-cosmo-intro-v4", "seen"));
  await fakeEngine(page);
  await page.goto(`/app/explore?${DEMO_QUERY}`);
  await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Shift");
  await page.getByRole("button", { name: "Ask Cosmo" }).click();
  const chat = page.getByRole("dialog", { name: "Chat with Cosmo" });
  await chat.getByRole("button", { name: "Which rotation ranks first, and why?" }).click();
  await expect(chat.getByText(/ranks first with a total score of/)).toBeVisible();
  await chat.getByRole("button", { name: "How does my current rotation compare?" }).click();
  await expect(chat.getByText(/No current rotation has been entered/)).toBeVisible();
});
