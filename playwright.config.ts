import { defineConfig, devices } from "@playwright/test";

// El Studio v1 se soporta y valida por completo en Chromium. Firefox y WebKit
// repiten únicamente los contratos del sitio público exportado: esta lista es
// explícita para que un nuevo barrido interno del editor no triplique por
// accidente el gate release ni convierta diferencias del browser del Studio en
// supuestas regresiones del storefront.
const publicStorefrontSpecs =
  /[/\\](catalog-modern(?:-v2)?|exported-store|exporter-sentinel|scale-store|storefront-nojs|ui-sweep-a(?:27|28|29|30))\.spec\.ts$/;
const ciVisualSpecs = [
  /[/\\]__vision__[/\\]/,
  /[/\\](?:qa-visual(?:-[^/\\]+)?|quality-forge-visual|studio-visual|theme-preset-visual|visual-break)\.spec\.ts$/,
];

export default defineConfig({
  testDir: "./tests/e2e",
  // Las auditorías visuales dedicadas se mantienen disponibles localmente,
  // pero no bloquean CI mientras se estabiliza su entorno de ejecución.
  testIgnore: process.env.CI === "true" ? ciVisualSpecs : undefined,
  fullyParallel: false,
  // 0 reintentos en local (post-cambio rápido); CI conserva 1 para flakes de timing.
  retries: process.env.CI === "true" ? 1 : 0,
  // 3 workers por defecto en local para no congelar la máquina: cada spec levanta
  // su propio servidor en puerto aleatorio (listen(0) o rangos disjuntos por
  // archivo), así que la paralelización es segura pero acotada. En máquinas
  // 8C/16T usar PLAYWRIGHT_WORKERS=8 para la suite completa (~3-4 min).
  // Smoke quick (5 specs) queda en ~20-40s. Override con PLAYWRIGHT_WORKERS=N.
  workers: Number(process.env.PLAYWRIGHT_WORKERS ?? 3),
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "list",
  use: {
    trace: process.env.CI === "true" ? "retain-on-failure" : "off",
    serviceWorkers: "block",
  },
  outputDir: process.env.SOLARA_PERF_PLAYWRIGHT_OUTPUT_DIR ?? "test-results",
  projects:
    process.env.PLAYWRIGHT_MULTI_BROWSER === "1"
      ? [
          { name: "chromium", use: { ...devices["Desktop Chrome"] } },
          {
            name: "firefox",
            testMatch: publicStorefrontSpecs,
            use: { ...devices["Desktop Firefox"] },
          },
          {
            name: "webkit",
            testMatch: publicStorefrontSpecs,
            use: { ...devices["Desktop Safari"] },
          },
        ]
      : [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
