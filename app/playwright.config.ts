import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: "test-results",
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100/api/health",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "node e2e/support/gcs-fixture-server.mjs",
      url: "http://127.0.0.1:4443/health",
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
  globalSetup: "./e2e/support/global-setup.ts",
});
