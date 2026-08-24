/**
 * Datos estructurados JSON-LD (schema.org): tienda, breadcrumbs, ofertas y
 * productos. Extraídos de index.ts como parte de la división por
 * responsabilidad (2026-08-21).
 */
import type { Product, StoreProjectV1 } from "@solara/project-schema";
import { imageUrl, videoFor, videoUrl } from "./assets.js";
import type { CommerceOfferSnapshot, CommerceProductSnapshot, CommerceSnapshot } from "./index.js";
import { effectiveHomeSections } from "./index.js";
import { absoluteResourceUrl, absoluteUrl, normalizeBaseUrl } from "./urls.js";
import { publicWhatsAppPhone } from "./whatsapp.js";

/**
 * URLs de redes sociales declaradas en identity. Se emiten como sameAs en
 * OnlineStore para que Google asocie los perfiles con el sitio.
 */
function buildSameAs(project: StoreProjectV1): string[] {
  const links = [
    project.identity.instagramUrl,
    project.identity.facebookUrl,
    project.identity.tiktokUrl,
  ];
  return links.filter((url): url is string => typeof url === "string" && url.length > 0);
}

export function storeStructuredData(project: StoreProjectV1): unknown[] {
  const logo = imageUrl(project, project.identity.logoAssetId);
  const hero = effectiveHomeSections(project).find(
    (section) => section.slot === "hero" && section.enabled,
  );
  const heroVideoId =
    typeof hero?.settings.videoAssetId === "string" ? hero.settings.videoAssetId : undefined;
  const heroVideo = videoFor(project, heroVideoId);
  const heroPosterId =
    typeof hero?.settings.posterAssetId === "string"
      ? hero.settings.posterAssetId
      : heroVideo?.posterAssetId;
  const heroPosterUrl = heroPosterId ? imageUrl(project, heroPosterId) : undefined;
  const structured: unknown[] = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: project.identity.brandName,
      url: normalizeBaseUrl(project.baseUrl),
      inLanguage: project.locale,
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${normalizeBaseUrl(project.baseUrl)}/buscar/?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "OnlineStore",
      name: project.identity.brandName,
      legalName: project.identity.legalName,
      url: normalizeBaseUrl(project.baseUrl),
      description: project.identity.description,
      ...(logo ? { logo: absoluteResourceUrl(project, logo) } : {}),
      email: project.identity.email || undefined,
      ...(publicWhatsAppPhone(project) || project.identity.phone
        ? { telephone: publicWhatsAppPhone(project) || project.identity.phone }
        : {}),
      ...(project.identity.address ? { address: project.identity.address } : {}),
      ...(buildSameAs(project).length > 0 ? { sameAs: buildSameAs(project) } : {}),
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: project.policies.returns.countries,
        merchantReturnDays: project.policies.returns.returnDays,
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        returnMethod: "https://schema.org/ReturnByMail",
      },
    },
  ];
  if (heroVideo) {
    structured.push({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: heroVideo.name,
      description: heroVideo.alt || heroVideo.name,
      contentUrl: absoluteResourceUrl(project, videoUrl(project, heroVideo.id) ?? ""),
      ...(heroPosterUrl ? { thumbnailUrl: absoluteResourceUrl(project, heroPosterUrl) } : {}),
      duration: `PT${Math.round(heroVideo.durationSeconds)}S`,
      uploadDate: project.updatedAt,
    });
  }
  return structured;
}

export function breadcrumbData(
  project: StoreProjectV1,
  items: Array<{ name: string; path: string }>,
): unknown {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(project, item.path),
    })),
  };
}

export function offerData(project: StoreProjectV1, offer: CommerceOfferSnapshot): unknown {
  return {
    "@type": "Offer",
    url: absoluteUrl(project, offer.variantPath),
    priceCurrency: offer.currency,
    price: (offer.priceMinor / 100).toFixed(2),
    ...(offer.compareAtPriceMinor !== undefined && offer.compareAtPriceMinor > offer.priceMinor
      ? {
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: (offer.compareAtPriceMinor / 100).toFixed(2),
            priceCurrency: offer.currency,
            valueAddedTaxIncluded: true,
          },
        }
      : {}),
    availability:
      offer.availability === "in_stock"
        ? "https://schema.org/InStock"
        : offer.availability === "preorder"
          ? "https://schema.org/PreOrder"
          : "https://schema.org/OutOfStock",
    ...(offer.availabilityDate ? { availabilityStarts: offer.availabilityDate } : {}),
    itemCondition: "https://schema.org/NewCondition",
    // Google Merchant recomienda una fecha de validez del precio para rich
    // snippets. Determinística a partir de updatedAt del proyecto.
    priceValidUntil: `${new Date(project.updatedAt).getUTCFullYear()}-12-31`,
    seller: { "@type": "Organization", name: project.identity.brandName },
    shippingDetails: {
      "@type": "OfferShippingDetails",
      shippingDestination: {
        "@type": "DefinedRegion",
        addressCountry: project.policies.shipping.countries,
      },
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        handlingTime: {
          "@type": "QuantitativeValue",
          minValue: project.policies.shipping.handlingDaysMin,
          maxValue: project.policies.shipping.handlingDaysMax,
          unitCode: "DAY",
        },
        transitTime: {
          "@type": "QuantitativeValue",
          minValue: project.policies.shipping.transitDaysMin,
          maxValue: project.policies.shipping.transitDaysMax,
          unitCode: "DAY",
        },
      },
    },
  };
}

export function schemaOptionName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const aliases: Record<string, string> = {
    color: "color",
    colour: "color",
    coloracion: "color",
    talle: "size",
    tamano: "size",
    size: "size",
    material: "material",
    patron: "pattern",
    pattern: "pattern",
  };
  return aliases[normalized] ?? normalized.replace(/[^a-z0-9]+/g, "");
}

export function productStructuredData(
  project: StoreProjectV1,
  product: Product,
  snapshot: CommerceSnapshot,
): unknown {
  const productSnapshot = snapshot.products.find((item) => item.productId === product.id);
  if (!productSnapshot) return {};
  const variantNodes = productSnapshot.offers.map((offer) => ({
    "@type": "Product",
    name: offer.title,
    sku: offer.sku || undefined,
    ...(offer.gtin ? { gtin13: offer.gtin } : {}),
    ...(offer.mpn ? { mpn: offer.mpn } : {}),
    ...(offer.imageUrls.length ? { image: offer.imageUrls } : {}),
    offers: offerData(project, offer),
  }));

  if (product.variants.length === 1) {
    const visibleReviews = (product.reviews ?? []).filter((review) => review.visible);
    const reviewNodes = visibleReviews.slice(0, 10).map((review) => ({
      "@type": "Review",
      author: { "@type": "Person", name: review.authorName },
      ...(review.title ? { name: review.title } : {}),
      reviewBody: review.body,
      datePublished: review.publishedAt,
      reviewRating: { "@type": "Rating", ratingValue: review.rating, bestRating: 5 },
    }));
    const averageRating =
      visibleReviews.length > 0
        ? visibleReviews.reduce((sum, r) => sum + r.rating, 0) / visibleReviews.length
        : null;
    return {
      "@context": "https://schema.org",
      ...variantNodes[0],
      name: product.title,
      description: product.description,
      brand: { "@type": "Brand", name: product.brand },
      url: absoluteUrl(project, productSnapshot.canonicalPath),
      ...(reviewNodes.length > 0 ? { review: reviewNodes } : {}),
      ...(averageRating !== null
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: averageRating.toFixed(1),
              reviewCount: visibleReviews.length,
              bestRating: 5,
            },
          }
        : {}),
    };
  }

  const variesBy = Array.from(
    new Set(product.variants.flatMap((variant) => Object.keys(variant.optionValues))),
  ).map((option) => `https://schema.org/${schemaOptionName(option)}`);

  return {
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    productGroupID: product.id,
    name: product.title,
    description: product.description,
    brand: { "@type": "Brand", name: product.brand },
    url: absoluteUrl(project, `/productos/${product.slug}/`),
    ...(productSnapshot.imageUrls.length ? { image: productSnapshot.imageUrls } : {}),
    variesBy,
    hasVariant: variantNodes,
    ...(() => {
      const reviews = (product.reviews ?? []).filter((review) => review.visible);
      if (reviews.length === 0) return {};
      const reviewNodes = reviews.slice(0, 10).map((review) => ({
        "@type": "Review",
        author: { "@type": "Person", name: review.authorName },
        ...(review.title ? { name: review.title } : {}),
        reviewBody: review.body,
        datePublished: review.publishedAt,
        reviewRating: { "@type": "Rating", ratingValue: review.rating, bestRating: 5 },
      }));
      const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      return {
        review: reviewNodes,
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: avg.toFixed(1),
          reviewCount: reviews.length,
          bestRating: 5,
        },
      };
    })(),
  };
}

/**
 * ItemList para paginas de categoria: lista los productos con su posicion.
 * Google lo usa para generar carruseles en resultados de busqueda.
 */
export function itemListData(
  project: StoreProjectV1,
  listName: string,
  canonicalPath: string,
  products: Product[],
): unknown {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(project, `/productos/${product.slug}/`),
      name: product.title,
    })),
  };
}

/** ItemList liviano desde snapshots de productos (para el home). */
export function itemListFromSnapshots(
  project: StoreProjectV1,
  listName: string,
  products: CommerceProductSnapshot[],
): unknown {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(project, product.canonicalPath),
      name: product.title,
      ...(product.imageUrls[0] ? { image: product.imageUrls[0] } : {}),
    })),
  };
}
