import { referenceStore } from "@solara/project-schema/fixture";
import { describe, expect, it } from "vitest";
import {
  buildCartLine,
  buildWhatsAppMessage,
  formatMoney,
  parseCart,
  reconcileCartLines,
  STOREFRONT_RUNTIME_CSS,
  STOREFRONT_RUNTIME_JS,
} from "./index";

describe("mutation-killers: storefront-runtime / dinero", () => {
  it("parseCart rechaza precio float y quantity float (mutacion quitar isInteger)", () => {
    expect(
      parseCart([
        {
          variantId: "v1",
          title: "T",
          variantTitle: "V",
          sku: "S",
          unitPrice: 100.5 as any,
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
          unitPrice: 100,
          quantity: 1.5 as any,
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
  it("reconcilia precio autoridad: no permite precio stale del localStorage", () => {
    const tampered = [
      {
        productId: "p1",
        variantId: "v1",
        title: "M",
        variantTitle: "V",
        sku: "S",
        unitPrice: 1,
        quantity: 1,
        available: true,
      } as any,
    ];
    const catalog = [
      {
        productId: "p1",
        variantId: "v1",
        title: "M",
        variantTitle: "V",
        sku: "S",
        price: 9999,
        available: true,
      } as any,
    ];
    const r = reconcileCartLines(tampered, catalog);
    expect(r[0]?.unitPrice).toBe(9999);
    expect(r[0]?.unitPrice).not.toBe(1);
    // mutación que copie unitPrice del cart en lugar de catalog fallaría
  });
  it("precio 0 se preserva y no se convierte en falsy (mutacion if(price) )", () => {
    const cart = [
      {
        productId: "p1",
        variantId: "v1",
        title: "Gratis",
        variantTitle: "V",
        sku: "S",
        unitPrice: 999,
        quantity: 1,
        available: true,
      } as any,
    ];
    const catalog = [
      {
        productId: "p1",
        variantId: "v1",
        title: "Gratis",
        variantTitle: "V",
        sku: "S",
        price: 0,
        available: true,
      } as any,
    ];
    const r = reconcileCartLines(cart, catalog);
    expect(r[0]?.unitPrice).toBe(0);
  });
  it("total WhatsApp usa centavos enteros y no float", () => {
    const prod = referenceStore.products[0]!;
    const variant = prod.variants[0]!;
    const line = buildCartLine(prod, variant!, 2);
    const msg = buildWhatsAppMessage(referenceStore as any, [line as any], {
      name: "Ana",
      phone: "123",
      address: "CABA",
      notes: "",
    });
    const expected = formatMoney(variant?.price * 2);
    expect(msg).toContain(expected);
    // alterar a float (price/100 sin Math) produciría decimales erróneos
    expect(msg).not.toContain("NaN");
    expect(msg).toMatch(/\$|ARS/);
  });
  it("buildWhatsAppMessage nunca incluye SKU (includeSku tolerado pero ignorado)", () => {
    const prod = referenceStore.products[0]!;
    const variant = prod.variants[0]!;
    const line = buildCartLine(prod, variant!, 1);
    const withSku = buildWhatsAppMessage(
      { ...referenceStore, whatsapp: { ...referenceStore.whatsapp, includeSku: true } } as any,
      [line as any],
      { name: "A", phone: "B", address: "C", notes: "" },
    );
    expect(withSku).not.toContain(`[${variant?.sku}]`);
    expect(withSku).not.toContain(variant?.sku ?? "\u0000");
    const withoutSku = buildWhatsAppMessage(
      { ...referenceStore, whatsapp: { ...referenceStore.whatsapp, includeSku: false } } as any,
      [line as any],
      { name: "A", phone: "B", address: "C", notes: "" },
    );
    expect(withoutSku).not.toContain(`[${variant?.sku}]`);
    expect(withSku).toBe(withoutSku);
  });
  it("ghost image se limpia cuando catalog no tiene imagen (no preservar vieja)", () => {
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
        imageWidth: 200,
        imageHeight: 200,
      } as any,
    ];
    const catalogNoImg = [
      {
        productId: "p1",
        variantId: "v1",
        title: "M",
        variantTitle: "V",
        sku: "S",
        price: 100,
        available: true,
      } as any,
    ];
    const r = reconcileCartLines(cart, catalogNoImg);
    expect(r[0]?.imageUrl).toBeUndefined();
    // mutación que haga if(current.imageUrl) reconciled.imageUrl = ... else keep old fallaría
  });
  it("runtime serializado usa IntersectionObserver y no scrollY", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("IntersectionObserver");
    expect(STOREFRONT_RUNTIME_JS).not.toContain("scrollY");
    expect(STOREFRONT_RUNTIME_JS).not.toContain('addEventListener("wheel"');
  });
  it("runtime serializado no contiene sinks HTML ni políticas permisivas", () => {
    expect(STOREFRONT_RUNTIME_JS).not.toContain("innerHTML");
    expect(STOREFRONT_RUNTIME_JS).not.toContain("createPolicy");
    expect(STOREFRONT_RUNTIME_JS).not.toContain("setHtml");
  });
  it("runtime serializado respeta prefers-reduced-motion", () => {
    expect(STOREFRONT_RUNTIME_CSS).toContain("prefers-reduced-motion");
  });
});
