import type { StoreProjectV2 } from "@solara/project-schema";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";
import { describe, expect, it } from "vitest";
import { buildCommerceSnapshot } from "./index";
import { offerData, productStructuredData } from "./structured-data";

function storeWithUpdatedAt(updatedAt: string): StoreProjectV2 {
  const store = structuredClone(catalogModernV2Store) as StoreProjectV2;
  store.updatedAt = updatedAt;
  return store;
}

function firstOffer(store: StoreProjectV2): Record<string, unknown> {
  const snapshot = buildCommerceSnapshot(store);
  const offer = snapshot.offers[0];
  if (!offer) throw new Error("La fixture no produjo una oferta.");
  return offerData(store, offer) as Record<string, unknown>;
}

function jsonLdOffers(data: Record<string, unknown>): Array<Record<string, unknown>> {
  const hasVariant = data.hasVariant as Array<Record<string, unknown>> | undefined;
  if (hasVariant) {
    return hasVariant.map((variant) => variant.offers as Record<string, unknown>);
  }
  return [data.offers as Record<string, unknown>];
}

describe("priceValidUntil derivado de updatedAt mas 90 dias", () => {
  it("cruza de mes: 2026-07-29 mas 90 dias es 2026-10-27", () => {
    const data = firstOffer(storeWithUpdatedAt("2026-07-29T12:00:00.000Z"));
    expect(data.priceValidUntil).toBe("2026-10-27");
  });

  it("cruza de año: 2025-10-27 mas 90 dias es 2026-01-25", () => {
    const data = firstOffer(storeWithUpdatedAt("2025-10-27T00:00:00.000Z"));
    expect(data.priceValidUntil).toBe("2026-01-25");
  });

  it("bordes de mes con hora final y 29 de febrero bisiesto", () => {
    const finDeFebrero = firstOffer(storeWithUpdatedAt("2026-02-20T23:59:59.999Z"));
    expect(finDeFebrero.priceValidUntil).toBe("2026-05-21");
    const bisiesto = firstOffer(storeWithUpdatedAt("2028-02-28T00:00:00.000Z"));
    expect(bisiesto.priceValidUntil).toBe("2028-05-28");
  });

  it("no usa el valor viejo fijo al 31 de diciembre", () => {
    const store = storeWithUpdatedAt("2026-07-29T12:00:00.000Z");
    const data = firstOffer(store);
    expect(data.priceValidUntil).not.toBe("2026-12-31");
    expect(String(data.priceValidUntil)).not.toMatch(/-12-31$/);
  });

  it("el JSON-LD de Product emite el mismo priceValidUntil que offerData", () => {
    const store = storeWithUpdatedAt("2026-07-29T12:00:00.000Z");
    const snapshot = buildCommerceSnapshot(store);
    const product = store.products[0];
    if (!product) throw new Error("La fixture no tiene productos.");
    const data = productStructuredData(store, product, snapshot) as Record<string, unknown>;
    const offers = jsonLdOffers(data);
    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) {
      expect(offer.priceValidUntil).toBe("2026-10-27");
    }
  });
});
