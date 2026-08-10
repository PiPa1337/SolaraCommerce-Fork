import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  // 4 workers: cada spec levanta su propio servidor en puerto aleatorio
  // (listen(0) o rangos disjuntos por archivo), así que la paralelización es
  // segura; la suite completa baja de ~9 min a ~3 min en una máquina 8C/16T.
  workers: 4,
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
