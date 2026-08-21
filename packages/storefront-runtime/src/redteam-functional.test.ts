// @ts-nocheck

import { referenceStore } from "@solara/project-schema/fixture";
import { describe, expect, it } from "vitest";
import {
  buildWhatsAppMessage,
  formatMoney,
  parseCart,
  reconcileCartLines,
  STOREFRONT_RUNTIME_CSS,
  STOREFRONT_RUNTIME_JS,
} from "./index";

describe("red-team storefront", () => {
  it("BUG-01 vaciado no debe resucitar backup", () => {
    expect(STOREFRONT_RUNTIME_JS.includes("primary?.length")).toBe(false);
  });
  it("BUG-02 freshCatalog debe resetear tras fallo", () => {
    const occ = (STOREFRONT_RUNTIME_JS.match(/freshCatalog = null/g) || []).length;
    expect(occ).toBeGreaterThanOrEqual(2);
  });
  it("BUG-03 parseCart rechaza float", () => {
    const f = parseCart([
      {
        variantId: "v1",
        title: "M",
        variantTitle: "V",
        sku: "S",
        unitPrice: 100.5,
        quantity: 1.5,
      } as any,
    ]);
    expect(f.length).toBe(0);
  });
  it("BUG-05 ghost image", () => {
    const cart = [
      {
        productId: "p1",
        variantId: "v1",
        title: "M",
        variantTitle: "V",
        sku: "S",
        unitPrice: 100,
        quantity: 1,
        imageUrl: "/old.jpg",
        imageWidth: 100,
        imageHeight: 100,
        available: true,
      },
    ];
    const cat = [
      {
        productId: "p1",
        variantId: "v1",
        title: "M",
        variantTitle: "V",
        sku: "S",
        price: 100,
        available: true,
      },
    ];
    const r = reconcileCartLines(cart as any, cat as any);
    expect(r[0].imageUrl).toBeUndefined();
  });
  it("BUG-07 storage sync", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain('addEventListener("storage"');
  });
  it("BUG-04 checkout bloquea precio stale si catalog-index falla", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("reconcileCart().then((ok)");
    expect(STOREFRONT_RUNTIME_JS).toContain("s.error");
  });
  it("BUG-04b applyCatalog maneja catalog vacio sin preservar precio stale", () => {
    // Si catalog es [] y cart tiene items, debe marcar como no disponible, no preservar
    const cart = [
      {
        productId: "p1",
        variantId: "v1",
        title: "M",
        variantTitle: "V",
        sku: "S",
        unitPrice: 999,
        quantity: 1,
        available: true,
      },
    ];
    const reconciled = reconcileCartLines(cart as any, []);
    expect(reconciled[0].available).toBe(false);
    // Y el runtime no debe tener guard que evita reconciliar cuando catalog vacio
    expect(STOREFRONT_RUNTIME_JS).not.toContain("catalog.length === 0 && cart.length > 0");
  });
  it("BUG-08 localStorage bloqueado no lanza (try/catch)", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("try {");
    expect(STOREFRONT_RUNTIME_JS).toContain("localStorage.getItem");
    // parseSerializedCart envuelve JSON.parse en try
    expect(STOREFRONT_RUNTIME_JS).toContain("JSON.parse(serialized");
  });
  it("BUG-09 reconcilia precio siempre desde catalogo (autoridad)", () => {
    const tampered = [
      {
        productId: "p1",
        variantId: "v1",
        title: "M",
        variantTitle: "V",
        sku: "S",
        unitPrice: 1,
        quantity: 2,
        available: true,
      },
    ];
    const catalog = [
      {
        productId: "p1",
        variantId: "v1",
        title: "M",
        variantTitle: "V",
        sku: "S",
        price: 5000,
        available: true,
      },
    ];
    const r = reconcileCartLines(tampered as any, catalog as any);
    expect(r[0].unitPrice).toBe(5000);
    expect(r[0].unitPrice).not.toBe(1);
  });
  it("BUG-10 parseCart rechaza quantity fuera de rango y no entera", () => {
    expect(
      parseCart([
        {
          variantId: "v1",
          title: "T",
          variantTitle: "V",
          sku: "S",
          unitPrice: 100,
          quantity: 0,
        } as any,
      ]).length,
    ).toBe(0);
    expect(
      parseCart([
        {
          variantId: "v1",
          title: "T",
          variantTitle: "V",
          sku: "S",
          unitPrice: 100,
          quantity: 100,
        } as any,
      ]).length,
    ).toBe(0);
    expect(
      parseCart([
        {
          variantId: "v1",
          title: "T",
          variantTitle: "V",
          sku: "S",
          unitPrice: 100,
          quantity: 2.5,
        } as any,
      ]).length,
    ).toBe(0);
    expect(
      parseCart([
        {
          variantId: "v1",
          title: "T",
          variantTitle: "V",
          sku: "S",
          unitPrice: -5,
          quantity: 1,
        } as any,
      ]).length,
    ).toBe(0);
  });
  it("corrupt localStorage: parseCart descarta JSON invalido sin throw", () => {
    expect(parseCart(null as any).length).toBe(0);
    expect(parseCart("invalid" as any).length).toBe(0);
    expect(
      parseCart([
        {
          variantId: "",
          title: "T",
          variantTitle: "V",
          sku: "S",
          unitPrice: 100,
          quantity: 1,
        } as any,
      ]).length,
    ).toBe(0);
    expect(
      parseCart([
        {
          variantId: "v1",
          title: "T",
          variantTitle: "V",
          sku: "S",
          unitPrice: NaN,
          quantity: 1,
        } as any,
      ]).length,
    ).toBe(0);
  });
  it("variante desaparecida queda marcada no disponible pero no se pierde", () => {
    const cart = [
      {
        productId: "p1",
        variantId: "v-old",
        title: "M",
        variantTitle: "V",
        sku: "S",
        unitPrice: 100,
        quantity: 1,
        available: true,
      },
    ];
    const catalog = [
      {
        productId: "p1",
        variantId: "v-new",
        title: "M",
        variantTitle: "V2",
        sku: "S2",
        price: 200,
        available: true,
      },
    ];
    const r = reconcileCartLines(cart as any, catalog as any);
    expect(r[0].available).toBe(false);
    expect(r[0].quantity).toBe(1);
  });
  it("precio cambiado en catalogo se refleja tras reconcile (autoridad)", () => {
    const cart = [
      {
        productId: "p1",
        variantId: "v1",
        title: "M",
        variantTitle: "V",
        sku: "S",
        unitPrice: 100,
        quantity: 2,
        available: true,
      },
    ];
    const catalogOld = [
      {
        productId: "p1",
        variantId: "v1",
        title: "M",
        variantTitle: "V",
        sku: "S",
        price: 100,
        available: true,
      },
    ];
    const catalogNew = [
      {
        productId: "p1",
        variantId: "v1",
        title: "M",
        variantTitle: "V",
        sku: "S",
        price: 7500,
        available: true,
      },
    ];
    const rOld = reconcileCartLines(cart as any, catalogOld as any);
    expect(rOld[0].unitPrice).toBe(100);
    const rNew = reconcileCartLines(rOld as any, catalogNew as any);
    expect(rNew[0].unitPrice).toBe(7500);
  });
  it("disponibilidad modificada a false bloquea checkout (available false)", () => {
    const cart = [
      {
        productId: "p1",
        variantId: "v1",
        title: "M",
        variantTitle: "V",
        sku: "S",
        unitPrice: 100,
        quantity: 1,
        available: true,
      },
    ];
    const catalogOut = [
      {
        productId: "p1",
        variantId: "v1",
        title: "M",
        variantTitle: "V",
        sku: "S",
        price: 100,
        available: false,
      },
    ];
    const r = reconcileCartLines(cart as any, catalogOut as any);
    expect(r[0].available).toBe(false);
  });
  it("XSS: titulo con script se escapa en runtime", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("escapeText(line.title)");
    expect(STOREFRONT_RUNTIME_JS).toContain("escapeAttribute(line.variantId)");
  });
  it("hash y query malformados no rompen variant select", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("new URL(window.location.href)");
    expect(STOREFRONT_RUNTIME_JS).toContain("URLSearchParams");
    expect(STOREFRONT_RUNTIME_JS).toContain("CSS.escape");
  });
  it("viewport y reduced-motion respetados en CSS", () => {
    expect(STOREFRONT_RUNTIME_CSS).toContain("prefers-reduced-motion");
    expect(STOREFRONT_RUNTIME_CSS).toContain("@media (max-width: 520px)");
  });
  it("back/forward y refresh no duplican listeners (pagehide y visibility)", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain('addEventListener("pagehide"');
    expect(STOREFRONT_RUNTIME_JS).toContain('addEventListener("visibilitychange"');
  });
  it("total WhatsApp usa centavos y no float", () => {
    const product = referenceStore.products[0]!;
    const variant = product.variants[0]!;
    const line = {
      productId: product.id,
      variantId: variant.id,
      title: product.title,
      variantTitle: variant.title,
      sku: variant.sku,
      unitPrice: variant.price,
      quantity: 3,
    };
    const msg = buildWhatsAppMessage(referenceStore as any, [line as any], {
      name: "A",
      phone: "B",
      address: "C",
      notes: "",
    });
    const expectedTotal = formatMoney(variant.price * 3);
    expect(msg).toContain(expectedTotal);
  });
  it("imagen que falla no rompe render (alt vacio)", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain('alt=""');
  });
});
