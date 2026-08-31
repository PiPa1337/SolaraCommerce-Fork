import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";
import { describe, expect, it } from "vitest";
import { buildMerchantFeed } from "./feeds";
import { auditProject, buildCommerceSnapshot } from "./index";
import { merchantIdMap, merchantItemGroupIdMap, normalizeMerchantItemGroupId } from "./merchant";
import { offerData, productStructuredData } from "./structured-data";

function feedItem(feed: string, variantId: string): string {
  const markerStart = feed.indexOf(`<g:id>${variantId}</g:id>`);
  if (markerStart < 0) throw new Error(`Falta la variante ${variantId} en el feed.`);
  const itemStart = feed.lastIndexOf("<item>", markerStart);
  const itemEnd = feed.indexOf("</item>", markerStart);
  return feed.slice(itemStart, itemEnd + "</item>".length);
}

describe("Merchant export normalization", () => {
  it("mantiene IDs válidos y acota IDs de grupo largos de forma determinista", () => {
    const longId = `producto-${"x".repeat(60)}`;
    const otherLongId = `producto-${"y".repeat(60)}`;
    const ids = merchantItemGroupIdMap([longId, otherLongId, "grupo-corto"]);

    expect(ids.get("grupo-corto")).toBe("grupo-corto");
    expect(ids.get(longId)).toBe(normalizeMerchantItemGroupId(longId));
    expect(ids.get(longId)?.length).toBeLessThanOrEqual(50);
    expect(ids.get(otherLongId)?.length).toBeLessThanOrEqual(50);
    expect(ids.get(longId)).not.toBe(ids.get(otherLongId));

    const offerIds = merchantIdMap([longId, otherLongId]);
    expect(offerIds.get(longId)?.length).toBeLessThanOrEqual(50);
    expect(offerIds.get(longId)).not.toBe(offerIds.get(otherLongId));
  });

  it("normaliza el grupo del snapshot y exporta su título común", () => {
    const store = structuredClone(catalogModernV2Store);
    const product = store.products[0];
    if (!product) throw new Error("La fixture no tiene productos.");
    product.id = `producto-${"x".repeat(60)}`;
    const variant = product.variants[0];
    if (!variant) throw new Error("La fixture no tiene variantes.");
    variant.id = `variante-${"y".repeat(60)}`;

    const snapshot = buildCommerceSnapshot(store);
    const offer = snapshot.offers.find((candidate) => candidate.productId === product.id);
    if (!offer) throw new Error("La fixture no produjo una oferta.");
    const feed = buildMerchantFeed(store, snapshot);

    expect(offer.itemGroupId.length).toBeLessThanOrEqual(50);
    expect(offer.variantId.length).toBeGreaterThan(50);
    expect(offer.itemGroupTitle).toBe(product.title);
    expect(
      (productStructuredData(store, product, snapshot) as Record<string, unknown>).productGroupID,
    ).toBe(offer.itemGroupId);
    expect(feed).toContain(`<g:item_group_title>${product.title}</g:item_group_title>`);
    expect(feed).not.toContain(product.id);
    expect(feed).not.toContain(`<g:id>${variant.id}</g:id>`);
    expect(
      [...feed.matchAll(/<g:id>([^<]+)<\/g:id>/g)].every((match) => (match[1]?.length ?? 0) <= 50),
    ).toBe(true);
  });

  it("emite availability_date sólo para ofertas en preorden", () => {
    const store = structuredClone(catalogModernV2Store);
    const product = store.products[0];
    const variant = product?.variants[0];
    if (!product || !variant) throw new Error("La fixture no tiene una variante.");
    const date = "2026-09-15T00:00:00.000Z";

    variant.stockStatus = "out_of_stock";
    variant.availabilityDate = date;
    const outSnapshot = buildCommerceSnapshot(store);
    const outOffer = outSnapshot.offers.find((offer) => offer.variantId === variant.id);
    if (!outOffer) throw new Error("Falta la oferta agotada.");
    const outData = offerData(store, outOffer) as Record<string, unknown>;
    expect(feedItem(buildMerchantFeed(store, outSnapshot), variant.id)).not.toContain(
      "<g:availability_date>",
    );
    expect(outData).not.toHaveProperty("availabilityStarts");

    variant.stockStatus = "preorder";
    const preorderSnapshot = buildCommerceSnapshot(store);
    const preorderOffer = preorderSnapshot.offers.find((offer) => offer.variantId === variant.id);
    if (!preorderOffer) throw new Error("Falta la oferta en preorden.");
    const preorderData = offerData(store, preorderOffer) as Record<string, unknown>;
    expect(feedItem(buildMerchantFeed(store, preorderSnapshot), variant.id)).toContain(
      `<g:availability_date>${date}</g:availability_date>`,
    );
    expect(preorderData).toHaveProperty("availabilityStarts", date);
  });

  it("audita la divergencia entre el switch visible y el estado de stock", () => {
    const store = structuredClone(catalogModernV2Store);
    const product = store.products[0];
    const variant = product?.variants[0];
    if (!product || !variant) throw new Error("La fixture no tiene una variante.");
    variant.available = false;
    variant.stockStatus = "in_stock";

    expect(auditProject(store)).toContainEqual(
      expect.objectContaining({
        code: "variant.availability-mismatch",
        severity: "warning",
        entity: expect.objectContaining({ type: "variant", id: variant.id }),
      }),
    );
  });
});
