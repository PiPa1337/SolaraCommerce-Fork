import {
  escapeAttribute,
  escapeHtml,
  findAsset,
  formatMoney,
  joinHtml,
  type RenderContext,
  renderImage,
  type SafeHtml,
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

function productCopy(project: StoreProjectV1) {
  return project.publicCopy.product;
}

export function productImage(project: StoreProjectV1, product: Product, eager = false): SafeHtml {
  const assetId = product.variants[0]?.imageId ?? product.imageIds[0];
  return renderImage(project, assetId, {
    className: "solara-product-image",
    loading: eager ? "eager" : "lazy",
    fetchPriority: eager ? "high" : "auto",
    sizes: "(max-width: 640px) 44vw, (max-width: 1024px) 30vw, (max-width: 1280px) 23vw, 280px",
    fallbackAlt: product.title,
  });
}

export function productCard(
  project: StoreProjectV1,
  product: Product,
  variant: "editorial" | "compact",
  eager = false,
): SafeHtml {
  const price = lowestPrice(product);
  const hasRange = product.variants.some((item) => item.price !== price);
  const available = product.variants.some((item) => item.available);
  const image = productImage(project, product, eager);
  const href = `/productos/${escapeAttribute(product.slug)}/`;

  const variantValues = product.variants.flatMap((item) => Object.values(item.optionValues));
  return safeHtml(`<article class="solara-product-card solara-product-card--${variant}" data-product-card data-product-title="${escapeAttribute(product.title)}" data-product-price="${price}" data-product-available="${String(available)}" data-product-tags="${escapeAttribute(product.tags.join(" "))}" data-product-variants="${escapeAttribute(variantValues.join(" "))}">
    <a class="solara-product-media" href="${href}" aria-label="${escapeAttribute(`Ver ${product.title}`)}">
      ${image}
    </a>
    <div class="solara-product-copy">
      <div>
        <p class="solara-product-brand">${escapeHtml(product.brand)}</p>
        <h3><a href="${href}">${escapeHtml(product.title)}</a></h3>
      </div>
      <p class="solara-product-price">${hasRange ? `${escapeHtml(productCopy(project).from)} ` : ""}${escapeHtml(formatMoney(price))}</p>
    </div>
    <p class="solara-product-description">${escapeHtml(product.description)}</p>
    <p class="solara-product-status">${available ? escapeHtml(productCopy(project).available) : escapeHtml(productCopy(project).outOfStock)}</p>
  </article>`);
}

export function renderProductCards(
  project: StoreProjectV1,
  products: readonly Product[],
  variant: "editorial" | "compact",
): SafeHtml {
  return joinHtml(
    products.map((product, index) => productCard(project, product, variant, index < 4)),
  );
}

export function renderBrand(project: StoreProjectV1): SafeHtml {
  const logo = findAsset(project, project.identity.logoAssetId);
  if (!logo) {
    return safeHtml(
      `<span class="solara-wordmark">${escapeHtml(project.identity.brandName)}</span>`,
    );
  }

  return renderImage(project, logo.id, {
    className: "solara-logo",
    loading: "eager",
    fetchPriority: "high",
    sizes: "(max-width: 767px) 8rem, 12rem",
    fallbackAlt: project.identity.brandName,
  });
}
