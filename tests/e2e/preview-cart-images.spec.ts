import { expect, test } from "@playwright/test";
import { getPreviewAssetSources, renderPreviewHtml } from "@solara/exporter";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";

test("el preview hidrata imágenes dinámicas del carrito y las mantiene cuadradas", async ({
  page,
}) => {
  const product = catalogModernV2Store.products.find((candidate) => candidate.status === "active");
  const variant = product?.variants.find((candidate) => candidate.available);
  const asset = catalogModernV2Store.assets.find((candidate) =>
    candidate.source.startsWith("data:image/"),
  );
  if (!product || !variant || !asset)
    throw new Error("La fixture no tiene línea de carrito usable");

  const assetSources = getPreviewAssetSources(catalogModernV2Store);
  const previewAsset = [...assetSources.entries()].find(([path]) => path.includes(asset.hash));
  if (!previewAsset) throw new Error("No se encontró la fuente de preview del producto");
  const [imageUrl, imageSource] = previewAsset;
  const cart = [
    {
      productId: product.id,
      variantId: variant.id,
      title: product.title,
      variantTitle: variant.title,
      sku: variant.sku,
      unitPrice: variant.price,
      quantity: 1,
      imageUrl,
      imageWidth: asset.width,
      imageHeight: asset.height,
      available: true,
    },
  ];
  const rendered = renderPreviewHtml(catalogModernV2Store, "draft", "/carrito/", {
    assetTransport: "parent",
  });
  if (typeof rendered !== "string") throw new Error("El preview no devolvió HTML");
  const html = rendered.replace(
    "</head>",
    `<script id="solara-preview-cart" data-hydrated="true" type="application/json">${JSON.stringify(cart)}</script></head>`,
  );

  await page.setContent('<iframe title="preview"></iframe>');
  await page.evaluate(
    ({ html: iframeHtml, imagePath, source }) => {
      const iframe = document.querySelector<HTMLIFrameElement>("iframe");
      if (!iframe) throw new Error("No se encontró el iframe");
      window.addEventListener("message", (event) => {
        if (event.source !== iframe.contentWindow) return;
        if (event.data?.type !== "solara-preview-assets-request") return;
        const paths = Array.isArray(event.data.paths) ? event.data.paths : [];
        const sources: Record<string, string> = {};
        if (paths.includes(imagePath)) sources[imagePath] = source;
        iframe.contentWindow?.postMessage({ type: "solara-preview-assets-response", sources }, "*");
      });
      iframe.srcdoc = iframeHtml;
    },
    { html, imagePath: imageUrl, source: imageSource },
  );

  const frame = page.frameLocator('iframe[title="preview"]');
  const image = frame.locator(".solara-cart-page [data-cart-lines] .solara-cart-line img");
  await expect(image).toHaveCount(1);
  await expect
    .poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  const metrics = await image.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      objectFit: getComputedStyle(element).objectFit,
    };
  });
  expect(Math.abs(metrics.width - metrics.height)).toBeLessThanOrEqual(0.5);
  expect(metrics.objectFit).toBe("contain");
});
