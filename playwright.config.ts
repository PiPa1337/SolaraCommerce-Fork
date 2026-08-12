import { defineConfig, devices } from "@playwright/test";

// El Studio v1 se soporta y valida por completo en Chromium. Firefox y WebKit
// repiten únicamente los contratos del sitio público exportado: esta lista es
// explícita para que un nuevo barrido interno del editor no triplique por
// accidente el gate release ni convierta diferencias del browser del Studio en
// supuestas regresiones del storefront.
const publicStorefrontSpecs =
  /[/\\](catalog-modern|exported-store|exporter-sentinel|scale-store|storefront-nojs|ui-sweep-a(?:27|28|29|30))\.spec\.ts$/;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // 1 reintento por test: con 532 tests y 4 workers, un puñado de aserciones
  // sensibles a timing (ventanas de ~1 frame) flakea una vez por corrida bajo
  // presión de suite; cada test se verifica dos veces en contexto fresco.
  retries: 1,
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
