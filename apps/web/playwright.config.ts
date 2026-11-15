import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against a production build whose engine URL points at a fake host (http://engine.test).
 * Tests intercept that host to serve contract fixtures, slow responses, errors or outages,
 * so every UI state — including the mock-layer fallback — is exercised for real.
 * Set PW_CHANNEL=msedge or chrome to use an installed browser instead of Playwright's Chromium.
 */
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.PW_CHANNEL || undefined,
    // Entry animations fade text in; axe must measure the colours the text ends with, not a frame mid-fade.
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: process.env.PW_CHANNEL || undefined, reducedMotion: "reduce" } }],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    port: PORT,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: { NEXT_PUBLIC_ENGINE_URL: "http://engine.test" },
  },
});
