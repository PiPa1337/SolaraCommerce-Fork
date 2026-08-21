import { expect, type Page } from "@playwright/test";

/**
 * Espera la señal determinista de inicialización del storefront
 * (`data-solara-ready="1"` en <html>, emitida al final de storefrontBoot).
 * Reemplaza timeouts fijos: los asserts pueden correr inmediatamente después.
 * Política completa: docs/TESTING.md (Política de estabilidad E2E).
 */
export async function waitForStorefrontReady(page: Page, timeoutMs = 10_000): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.solaraReady ?? "0"), {
      timeout: timeoutMs,
      intervals: [50, 100, 250],
    })
    .toBe("1");
}
