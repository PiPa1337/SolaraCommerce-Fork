import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "list",
  use: {
    trace: "retain-on-failure",
  },
  projects:
    process.env.PLAYWRIGHT_MULTI_BROWSER === "1"
      ? [
          { name: "chromium", use: { ...devices["Desktop Chrome"] } },
          {
            name: "firefox",
            testIgnore:
              /[/\\](assets|catalog|release-a11y|studio-builder|studio-visual)\.spec\.ts$/,
            use: { ...devices["Desktop Firefox"] },
          },
          {
            name: "webkit",
            testIgnore:
              /[/\\](assets|catalog|release-a11y|studio-builder|studio-visual)\.spec\.ts$/,
            use: { ...devices["Desktop Safari"] },
          },
        ]
      : [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
