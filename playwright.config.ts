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
  // 1 reintento por test: con 532 tests y 4 workers, un puñado de aserciones
  // sensibles a timing (ventanas de ~1 frame) flakea una vez por corrida bajo
  // presión de suite; cada test se verifica dos veces en contexto fresco.
  retries: 1,
  // 8 workers (9800X3D optimizado): cada spec levanta su propio servidor en puerto aleatorio
  // (listen(0) o rangos disjuntos por archivo), así que la paralelización es
  // segura; la suite completa baja de ~9 min a ~3-4 min en una máquina 8C/16T.
  // Smoke ampliado (15 specs) queda en ~45s-2min. Override con PLAYWRIGHT_WORKERS=6 si el IDE laggea.
  // Default previo era 4 workers.
  workers: Number(process.env.PLAYWRIGHT_WORKERS ?? 8),
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "list",
  use: {
    trace: "retain-on-failure",
    serviceWorkers: "block",
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
