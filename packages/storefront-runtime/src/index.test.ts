import { referenceStore } from "@solara/project-schema/fixture";
import { describe, expect, it } from "vitest";
import {
  buildCartLine,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  formatMoney,
  STOREFRONT_RUNTIME_CSS,
  STOREFRONT_RUNTIME_JS,
} from "./index";

describe("storefront runtime", () => {
  it("genera un mensaje determinista con variante y SKU", () => {
    const product = referenceStore.products[0];
    const variant = product?.variants[0];
    if (!product || !variant) throw new Error("Fixture incompleto");

    const message = buildWhatsAppMessage(referenceStore, [buildCartLine(product, variant, 2)], {
      name: "Malena Ortiz",
      phone: "11 5555 0142",
      address: "Av. Forest 842, CABA",
      notes: "Entregar por la tarde",
    });

    expect(message).toContain("2 x Manta Bruma (Musgo) [ML-BRU-MUS]");
    expect(message).toContain(formatMoney(15_700_000));
    expect(message).toContain("Malena Ortiz");
  });

  it("codifica el enlace de WhatsApp", () => {
    const url = buildWhatsAppUrl("+54 9 11 2345-6789", "Pedido\nManta");
    expect(url).toBe("https://wa.me/5491123456789?text=Pedido%0AManta");
  });

  it("usa observadores para motion y limita los listeners de scroll a uno pasivo", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("IntersectionObserver");
    expect(STOREFRONT_RUNTIME_JS).not.toContain('addEventListener("scroll", ()');
    expect(STOREFRONT_RUNTIME_JS).not.toContain('addEventListener("scroll", function');
    expect(STOREFRONT_RUNTIME_JS).toContain(
      'window.addEventListener("scroll", update, { passive: true })',
    );
  });

  it("declara motion progresivo sin bloquear el HTML inicial", () => {
    expect(STOREFRONT_RUNTIME_CSS).toContain("--motion-intensity");
    expect(STOREFRONT_RUNTIME_CSS).toContain("prefers-reduced-motion");
    expect(STOREFRONT_RUNTIME_CSS).toContain("@keyframes solara-motion-fade-up");
    expect(STOREFRONT_RUNTIME_CSS).not.toContain(
      'html[data-motion-ready="true"] [data-motion-root]:not',
    );
    expect(STOREFRONT_RUNTIME_JS).toContain("motionEntry");
  });

  it("serializa las microinteracciones dentro del boot", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("initMicroInteractions");
    expect(STOREFRONT_RUNTIME_JS).toContain("data-back-to-top");
  });

  it("incluye FAQ con exclusividad y contadores de stats autocontenidos", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("initFAQStats");
    expect(STOREFRONT_RUNTIME_JS).toContain("data-faq-root");
    expect(STOREFRONT_RUNTIME_JS).toContain("data-stat-target");
    expect(STOREFRONT_RUNTIME_JS).toContain("toLocaleString");
    expect(STOREFRONT_RUNTIME_JS).toContain('hasFeature("micro")');
    expect(STOREFRONT_RUNTIME_JS).not.toContain("initMicroInteractions.initFAQStats");
  });

  it("incluye comportamiento accesible para el popup de búsqueda", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("data-catalog-search-dialog");
    expect(STOREFRONT_RUNTIME_JS).toContain("data-catalog-search-open");
    expect(STOREFRONT_RUNTIME_JS).toContain("showModal");
    expect(STOREFRONT_RUNTIME_JS).toContain("data-catalog-search-close");
    expect(STOREFRONT_RUNTIME_JS).toContain("catalog-search-open");
  });

  it("serializa los helpers de búsqueda dentro del runtime público", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("function levenshtein");
    expect(STOREFRONT_RUNTIME_JS).toContain("function matchToken");
    expect(STOREFRONT_RUNTIME_JS).toContain("function scoreEntry");
    expect(STOREFRONT_RUNTIME_JS).toContain("function normalizeSearchTokens");
    expect(STOREFRONT_RUNTIME_JS).toContain("storefrontBoot");
  });

  it("expone los helpers de búsqueda por un nombre canónico estable", () => {
    // La cadena debe definir bindings con nombre fijo (sobreviven minificación y
    // transpilación CJS) y el boot debe accederlos vía globalThis, nunca a
    // través de referencias de módulo que se reescriben al serializar.
    expect(STOREFRONT_RUNTIME_JS).toContain(
      "const normalizeSearchTokens = function normalizeSearchTokens",
    );
    expect(STOREFRONT_RUNTIME_JS).toContain("const scoreEntry = function scoreEntry");
    expect(STOREFRONT_RUNTIME_JS).toContain(
      "globalThis.__solaraSearchHelpers = { normalizeSearchTokens, levenshtein, matchToken, scoreEntry }",
    );
    expect(STOREFRONT_RUNTIME_JS).toContain("searchApi.normalizeSearchTokens");
    expect(STOREFRONT_RUNTIME_JS).toContain("searchApi.scoreEntry");
    expect(STOREFRONT_RUNTIME_JS).not.toContain("__solaraSearchHelpers.__solaraSearchHelpers");
  });

  it("mantiene el runtime por debajo de 52 KB crudos", () => {
    // Medición Task 1A: runtime JS 51.228 B en bytes crudos (sin gzip).
    expect(Buffer.byteLength(STOREFRONT_RUNTIME_JS, "utf8")).toBeLessThanOrEqual(52 * 1024);
  });
});
