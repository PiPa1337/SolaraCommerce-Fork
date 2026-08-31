/**
 * Generadores de feeds e índices públicos: sitemaps (URL, imagen, video),
 * feed Merchant de Google, índice de búsqueda y catálogo. Extraídos de
 * index.ts como parte de la división por responsabilidad (2026-08-21).
 */
import { normalizeSearchTokens } from "@solara/core";
import type { Category, Collection, Product, StoreProjectV1 } from "@solara/project-schema";
import { imageFor, imageUrl, productImagePaths, videoFor, videoUrl } from "./assets.js";
import { escapeXml } from "./html.js";
import type { CommerceSnapshot, PageDescriptor, PublicExportManifest } from "./index.js";
import {
  buildCommerceSnapshot,
  categoryProducts,
  effectiveHomeSections,
  productCategoryScope,
} from "./index.js";
import { merchantIdMap, merchantItemGroupIdMap } from "./merchant.js";
import { absoluteResourceUrl, absoluteUrl, normalizeBaseUrl } from "./urls.js";
export function buildSitemap(
  project: StoreProjectV1,
  pages: readonly PageDescriptor[],
  manifest?: PublicExportManifest,
): string {
  const indexableRoutes = new Set(
    manifest?.indexableRoutes ??
      pages
        .filter((page) => !["search", "cart", "checkout", "not-found"].includes(page.pageType))
        .map((page) => page.canonicalPath),
  );
  const urls = pages
    .filter((page) => indexableRoutes.has(page.canonicalPath))
    .map(
      (page) => `<url>
  <loc>${escapeXml(absoluteUrl(project, page.canonicalPath))}</loc>
  <lastmod>${(page.lastModifiedAt ?? project.updatedAt).slice(0, 10)}</lastmod>
  <changefreq>${page.pageType === "home" ? "daily" : "weekly"}</changefreq>
  <priority>${page.pageType === "home" ? "1.0" : page.pageType === "category" ? "0.8" : page.pageType === "collection" ? "0.7" : "0.6"}</priority>
  ${page.image ? `<image:image><image:loc>${escapeXml(absoluteResourceUrl(project, page.image))}</image:loc></image:image>` : ""}
</url>`,
    );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>`;
}

export function buildImageSitemap(
  project: StoreProjectV1,
  pages: readonly PageDescriptor[] = [],
): string {
  const byPage = new Map<string, string[]>();
  const add = (pagePath: string, url: string | undefined): void => {
    if (!url) return;
    const entries = byPage.get(pagePath) ?? [];
    if (!entries.includes(url)) entries.push(url);
    byPage.set(pagePath, entries);
  };
  pages
    .filter((page) => !["search", "cart", "checkout", "not-found"].includes(page.pageType))
    .forEach((page) => {
      add(page.canonicalPath, page.image);
      add(page.canonicalPath, page.preloadImage);
    });
  const pageSize = project.commerceTemplates.category.productsPerPage;
  project.products
    .filter((product) => product.status === "active")
    .forEach((product) => {
      productImagePaths(project, product).forEach((url) => {
        add(`/productos/${product.slug}/`, url);
      });
    });
  project.categories
    .filter((category) => category.status !== "hidden")
    .forEach((category) => {
      const totalPages = Math.max(
        1,
        Math.ceil(categoryProducts(project, category).length / pageSize),
      );
      for (let page = 1; page <= totalPages; page += 1) {
        add(
          page === 1
            ? `/categorias/${category.slug}/`
            : `/categorias/${category.slug}/pagina/${page}/`,
          imageUrl(project, category.imageId),
        );
      }
    });
  project.collections
    .filter((collection) => collection.status !== "hidden")
    .forEach((collection) => {
      const products = collection.productIds
        .map((id) => project.products.find((product) => product.id === id))
        .filter((product): product is Product => Boolean(product && product.status === "active"));
      const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
      for (let page = 1; page <= totalPages; page += 1) {
        add(
          page === 1
            ? `/colecciones/${collection.slug}/`
            : `/colecciones/${collection.slug}/pagina/${page}/`,
          imageUrl(project, collection.imageId),
        );
      }
    });
  const homePage = pages.find((page) => page.pageType === "home");
  const homeImage = homePage?.preloadImage ?? homePage?.image;
  add("/", homeImage);
  const urls = [...byPage.entries()].map(
    ([pagePath, entries]) => `<url>
  <loc>${escapeXml(absoluteUrl(project, pagePath))}</loc>
  ${entries
    .map(
      (url) => `<image:image>
    <image:loc>${escapeXml(absoluteResourceUrl(project, url))}</image:loc>
  </image:image>`,
    )
    .join("\n  ")}
</url>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>`;
}

export function buildVideoSitemap(project: StoreProjectV1): string {
  const hero = effectiveHomeSections(project).find(
    (section) => section.slot === "hero" && section.enabled,
  );
  const videoId =
    hero?.settings.mode === "video" && typeof hero.settings.videoAssetId === "string"
      ? hero.settings.videoAssetId
      : undefined;
  const video = videoFor(project, videoId);
  if (!video) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"></urlset>`;
  }
  const poster =
    imageUrl(project, video.posterAssetId) ??
    (typeof hero?.settings.posterAssetId === "string"
      ? imageUrl(project, hero.settings.posterAssetId)
      : undefined);
  const content = videoUrl(project, video.id);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  <url><loc>${escapeXml(absoluteUrl(project, "/"))}</loc><video:video>${poster ? `<video:thumbnail_loc>${escapeXml(absoluteResourceUrl(project, poster))}</video:thumbnail_loc>` : ""}<video:title>${escapeXml(video.name)}</video:title><video:description>${escapeXml(video.alt || video.name)}</video:description><video:content_loc>${escapeXml(absoluteResourceUrl(project, content ?? ""))}</video:content_loc><video:duration>${Math.round(video.durationSeconds)}</video:duration></video:video></url>
</urlset>`;
}

export function buildMerchantFeed(
  project: StoreProjectV1,
  snapshot = buildCommerceSnapshot(project),
): string {
  const offerIds = merchantIdMap(snapshot.offers.map((offer) => offer.variantId));
  const itemGroupIds = merchantItemGroupIdMap(snapshot.offers.map((offer) => offer.itemGroupId));
  const items = snapshot.offers.map((offer) => {
    const identifier = offer.gtin
      ? `<g:gtin>${escapeXml(offer.gtin)}</g:gtin>`
      : offer.mpn
        ? `<g:mpn>${escapeXml(offer.mpn)}</g:mpn>`
        : "<g:identifier_exists>no</g:identifier_exists>";
    const additionalImages = offer.imageUrls
      .slice(1)
      .map((image) => `<g:additional_image_link>${escapeXml(image)}</g:additional_image_link>`)
      .join("\n  ");
    const availabilityDate = offer.availability === "preorder" ? offer.availabilityDate : undefined;
    return `<item>
  <g:id>${escapeXml(offerIds.get(offer.variantId) ?? offer.variantId)}</g:id>
  <g:item_group_id>${escapeXml(itemGroupIds.get(offer.itemGroupId) ?? offer.itemGroupId)}</g:item_group_id>
  <g:item_group_title>${escapeXml(offer.itemGroupTitle)}</g:item_group_title>
  <title>${escapeXml(offer.title)}</title>
  <description>${escapeXml(offer.description)}</description>
  <link>${escapeXml(absoluteUrl(project, offer.variantPath))}</link>
  <g:image_link>${escapeXml(offer.imageUrls[0] ?? "")}</g:image_link>
  ${additionalImages}
  <g:availability>${offer.availability}</g:availability>
  ${availabilityDate ? `<g:availability_date>${escapeXml(availabilityDate)}</g:availability_date>` : ""}
  <g:price>${(offer.priceMinor / 100).toFixed(2)} ${offer.currency}</g:price>
  <g:condition>new</g:condition>
  <g:brand>${escapeXml(offer.brand)}</g:brand>
  ${identifier}
</item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
<channel>
  <title>${escapeXml(project.identity.brandName)}</title>
  <link>${escapeXml(normalizeBaseUrl(project.baseUrl))}</link>
  <description>${escapeXml(project.identity.description)}</description>
  ${items.join("\n")}
</channel>
</rss>`;
}

export function buildSearchIndex(project: StoreProjectV1): string {
  const entries = project.products
    .filter((product) => product.status === "active")
    .map((product) => {
      const prices = product.variants.map((variant) => variant.price);
      const image = imageUrl(project, product.imageIds[0]);
      const imageAsset = imageFor(project, product.imageIds[0]);
      const categoryIds = [...productCategoryScope(project, product)].filter(
        (id) => project.categories.find((category) => category.id === id)?.status !== "hidden",
      );
      const categoryNames = categoryIds
        .map((id) => project.categories.find((category) => category.id === id))
        .filter((category) => category?.status !== "hidden")
        .map((category) => category?.title)
        .filter((value): value is string => Boolean(value));
      const collectionIds = product.collectionIds.filter(
        (id) => project.collections.find((collection) => collection.id === id)?.status !== "hidden",
      );
      const collectionNames = collectionIds
        .map((id) => project.collections.find((collection) => collection.id === id))
        .filter((collection) => collection?.status !== "hidden")
        .map((collection) => collection?.title)
        .filter((value): value is string => Boolean(value));
      const options = [
        ...new Set(
          product.variants.flatMap((variant) =>
            Object.entries(variant.optionValues).map(([key, value]) => `${key}=${value}`),
          ),
        ),
      ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      return {
        id: product.id,
        slug: product.slug,
        title: product.title,
        brand: product.brand,
        description: product.description,
        tags: product.tags,
        categoryIds,
        collectionIds,
        categoryNames,
        collectionNames,
        options,
        ...(image ? { imageUrl: image } : {}),
        ...(imageAsset ? { imageWidth: imageAsset.width, imageHeight: imageAsset.height } : {}),
        priceMin: Math.min(...prices),
        available: product.variants.some((variant) => variant.available),
        path: `/productos/${product.slug}/`,
        tokens: {
          title: normalizeSearchTokens(product.title),
          brand: normalizeSearchTokens(product.brand),
          tags: normalizeSearchTokens((product.tags ?? []).join(" ")),
          categories: normalizeSearchTokens([...categoryNames, ...collectionNames].join(" ")),
          description: normalizeSearchTokens(product.description),
        },
      };
    });
  return JSON.stringify(entries);
}

export function buildCatalogIndex(project: StoreProjectV1): string {
  const entries = project.products
    .filter((product) => product.status === "active")
    .flatMap((product) =>
      product.variants.map((variant) => {
        const asset = imageFor(project, variant.imageId ?? product.imageIds[0]);
        const image = imageUrl(project, variant.imageId ?? product.imageIds[0]);
        return {
          productId: product.id,
          variantId: variant.id,
          title: product.title,
          variantTitle: variant.title,
          sku: variant.sku,
          price: variant.price,
          available: variant.available,
          ...(image ? { imageUrl: image } : {}),
          ...(asset ? { imageWidth: asset.width, imageHeight: asset.height } : {}),
        };
      }),
    );
  return JSON.stringify(entries);
}
