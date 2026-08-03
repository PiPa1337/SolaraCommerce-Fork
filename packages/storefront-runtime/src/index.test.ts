import { gzipSync } from "node:zlib";
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

  it("usa observadores sin instalar listeners globales de scroll", () => {
    expect(STOREFRONT_RUNTIME_JS).not.toContain('addEventListener("scroll"');
    expect(STOREFRONT_RUNTIME_JS).not.toContain("scrollY");
    expect(STOREFRONT_RUNTIME_JS).toContain("IntersectionObserver");
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

  it("incluye comportamiento accesible para el popup de búsqueda", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("data-catalog-search-dialog");
    expect(STOREFRONT_RUNTIME_JS).toContain("data-catalog-search-open");
    expect(STOREFRONT_RUNTIME_JS).toContain("showModal");
    expect(STOREFRONT_RUNTIME_JS).toContain("data-catalog-search-close");
    expect(STOREFRONT_RUNTIME_JS).toContain("catalog-search-open");
  });

  it("mantiene el runtime por debajo de 35 KB gzip", () => {
    expect(gzipSync(STOREFRONT_RUNTIME_JS).byteLength).toBeLessThanOrEqual(35 * 1024);
  });
});
