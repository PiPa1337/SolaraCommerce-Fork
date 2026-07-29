import {
  escapeAttribute,
  escapeHtml,
  findAsset,
  formatMoney,
  joinHtml,
  type RenderContext,
  renderImage,
  type SafeHtml,
  safeAssetUrl,
  safeHtml,
} from "@solara/module-sdk";
import type { AssetId, Product, StoreProjectV1 } from "@solara/project-schema";

export function scopedAssetId(moduleId: string): AssetId {
  return `module-style-${moduleId}` as AssetId;
}

export function visibleProducts(context: RenderContext<unknown>): readonly Product[] {
  const requested =
    context.products ??
    (context.category
      ? context.project.products.filter((product) =>
          context.category?.productIds.includes(product.id),
        )
      : context.collection
        ? context.project.products.filter((product) =>
            context.collection?.productIds.includes(product.id),
          )
        : context.project.products);
  return requested.filter((product) => product.status === "active");
}

export function lowestPrice(product: Product): number {
  return Math.min(...product.variants.map((variant) => variant.price));
}

export function productImage(project: StoreProjectV1, product: Product, eager = false): SafeHtml {
  const assetId = product.variants[0]?.imageId ?? product.imageIds[0];
  return renderImage(project, assetId, {
    className: "solara-product-image",
    loading: eager ? "eager" : "lazy",
    sizes: "(max-width: 720px) 92vw, (max-width: 1100px) 45vw, 30vw",
    fallbackAlt: product.title,
  });
}

export function productCard(
  project: StoreProjectV1,
  product: Product,
  variant: "editorial" | "compact",
): SafeHtml {
  const price = lowestPrice(product);
  const hasRange = product.variants.some((item) => item.price !== price);
  const available = product.variants.some((item) => item.available);
  const image = productImage(project, product);
  const href = `/productos/${escapeAttribute(product.slug)}/`;

  return safeHtml(`<article class="solara-product-card solara-product-card--${variant}">
    <a class="solara-product-media" href="${href}" aria-label="${escapeAttribute(`Ver ${product.title}`)}">
      ${image}
    </a>
    <div class="solara-product-copy">
      <div>
        <p class="solara-product-brand">${escapeHtml(product.brand)}</p>
        <h3><a href="${href}">${escapeHtml(product.title)}</a></h3>
      </div>
      <p class="solara-product-price">${hasRange ? "Desde " : ""}${escapeHtml(formatMoney(price))}</p>
    </div>
    <p class="solara-product-description">${escapeHtml(product.description)}</p>
    <p class="solara-product-status">${available ? "Disponible" : "Agotado"}</p>
  </article>`);
}

export function renderProductCards(
  project: StoreProjectV1,
  products: readonly Product[],
  variant: "editorial" | "compact",
): SafeHtml {
  return joinHtml(products.map((product) => productCard(project, product, variant)));
}

export function renderBrand(project: StoreProjectV1): SafeHtml {
  const logo = findAsset(project, project.identity.logoAssetId);
  if (!logo) {
    return safeHtml(
      `<span class="solara-wordmark">${escapeHtml(project.identity.brandName)}</span>`,
    );
  }

  return safeHtml(
    `<img class="solara-logo" src="${escapeAttribute(safeAssetUrl(logo.source, ""))}" alt="${escapeAttribute(project.identity.brandName)}" width="${logo.width}" height="${logo.height}">`,
  );
}
