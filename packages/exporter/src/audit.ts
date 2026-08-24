/**
 * Auditoría del proyecto: issues técnicos, de contenido y SEO, combinados
 * con el reporte de optimización. Extraídos de index.ts como parte de la
 * división por responsabilidad (2026-08-21).
 */

import type { StoreProjectV1 } from "@solara/project-schema";
import { isCatalogModernPlaceholderAsset } from "@solara/project-schema";
import { optimizeProject } from "@solara/site-optimizer";
import { imageFor } from "./assets.js";
import { buildMerchantFeed } from "./feeds.js";
import { escapeXml } from "./html.js";
import type { AuditIssue, AuditReport } from "./index.js";
import {
  buildCommerceSnapshot,
  dataUrlBytes,
  effectiveHomeSections,
  publicMediaUsage,
} from "./index.js";
import { publicWhatsAppPhone } from "./whatsapp.js";

export function auditProject(project: StoreProjectV1, publicAiContext = true): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const productSlugs = new Map<string, number>();
  const categorySlugs = new Map<string, number>();
  const collectionSlugs = new Map<string, number>();
  const snapshot = buildCommerceSnapshot(project);
  const mediaUsage = publicMediaUsage(project);
  const reservedSlugs = new Set([
    "assets",
    "categorias",
    "colecciones",
    "productos",
    "envios",
    "devoluciones",
    "privacidad",
    "terminos",
    "contacto",
    "nosotros",
    "buscar",
    "carrito",
    "compra",
  ]);

  if (!project.baseUrl.startsWith("https://")) {
    issues.push({
      code: "domain.https",
      severity: "critical",
      message: "El dominio de producción debe usar HTTPS.",
      path: "baseUrl",
    });
  }

  let baseUrlPathname = "/";
  try {
    baseUrlPathname = new URL(project.baseUrl).pathname;
  } catch {
    baseUrlPathname = "/";
  }
  if (baseUrlPathname !== "/") {
    issues.push({
      code: "domain.baseurl-path",
      severity: "warning",
      message:
        "La baseUrl usa una subcarpeta; verificá que el hosting conserve el prefijo en navegación, runtime, PWA y recursos.",
      path: "baseUrl",
    });
  }

  if (publicAiContext) {
    issues.push({
      code: "privacy.public-ai-context",
      severity: "warning",
      area: "ai",
      message:
        "El contexto público para agentes expone contacto, políticas, SKUs, precios y productos activos en ai-context.json y llms.txt.",
      path: "publicAiContext",
      fixTarget: "export",
    });
  }
  const externalMediaHosts = new Map<string, Set<string>>();
  const mediaSources = [
    ...project.assets.flatMap((asset) => [
      asset.source,
      asset.fallbackSource ?? "",
      ...(asset.responsiveSources?.map((source) => source.source) ?? []),
    ]),
    ...project.videos.map((video) => video.source),
  ];
  mediaSources.forEach((source) => {
    if (!/^https?:\/\//i.test(source)) return;
    try {
      const url = new URL(source);
      const host = url.hostname.toLowerCase();
      const protocols = externalMediaHosts.get(host) ?? new Set<string>();
      protocols.add(url.protocol);
      externalMediaHosts.set(host, protocols);
    } catch {
      // El schema ya rechaza formatos imposibles; no duplica el diagnóstico aquí.
    }
  });
  externalMediaHosts.forEach((protocols, host) => {
    issues.push({
      code: "privacy.external-media-host",
      severity: "warning",
      area: "technical",
      message: `El sitio público carga medios desde ${host}; ese host puede recibir solicitudes de visitantes.`,
      path: "assets",
      fixTarget: "assets",
    });
    if (protocols.has("http:")) {
      issues.push({
        code: "privacy.http-media",
        severity: "warning",
        area: "technical",
        message: `El medio remoto de ${host} usa HTTP sin cifrado; reemplazalo por HTTPS si el proveedor lo permite.`,
        path: "assets",
        fixTarget: "assets",
      });
    }
  });
  if (publicWhatsAppPhone(project)) {
    issues.push({
      code: "privacy.external-host",
      severity: "warning",
      area: "technical",
      message:
        "El checkout abre WhatsApp en wa.me; ese host externo recibe la solicitud cuando el cliente confirma.",
      path: "whatsapp.phone",
      fixTarget: "export",
    });
  }

  if (project.origin?.seed === "clean") {
    const placeholders = project.assets.filter((asset) =>
      isCatalogModernPlaceholderAsset(project, asset),
    );
    const usedPlaceholders = placeholders.filter((asset) => mediaUsage.assetIds.has(asset.id));
    if (usedPlaceholders.length > 0) {
      issues.push({
        code: "template.placeholder",
        severity: "critical",
        message:
          "Reemplazá las imágenes de plantilla que todavía aparecen en el sitio antes de publicar esta tienda.",
        path: "assets",
        area: "content",
        fixTarget: "assets",
      });
    }
    const unusedPlaceholders = placeholders.length - usedPlaceholders.length;
    if (unusedPlaceholders > 0) {
      issues.push({
        code: "template.placeholder.unused",
        severity: "warning",
        message: `${unusedPlaceholders} imagen${unusedPlaceholders === 1 ? "" : "es"} de plantilla no se usa${unusedPlaceholders === 1 ? "" : "n"} en el sitio público; podés eliminarla${unusedPlaceholders === 1 ? "" : "s"}.`,
        path: "assets",
        area: "content",
        fixTarget: "assets",
      });
    }
  }

  project.products.forEach((product, productIndex) => {
    productSlugs.set(product.slug, (productSlugs.get(product.slug) ?? 0) + 1);
    if (product.status !== "active") return;
    if (!product.description.trim()) {
      issues.push({
        code: "product.description",
        severity: "critical",
        message: `${product.title} no tiene descripción.`,
        path: `products.${productIndex}.description`,
      });
    }
    if (product.imageIds.length === 0) {
      issues.push({
        code: "product.image",
        severity: "critical",
        message: `${product.title} no tiene imagen.`,
        path: `products.${productIndex}.imageIds`,
      });
    }
    product.imageIds.forEach((assetId) => {
      const asset = imageFor(project, assetId);
      if (!asset || !asset.alt.trim()) {
        issues.push({
          code: "image.alt",
          severity: "warning",
          message: `${product.title} tiene una imagen sin texto alternativo.`,
          path: `products.${productIndex}.imageIds`,
        });
      }
      if (asset && !asset.responsiveSources?.length) {
        issues.push({
          code: "image.responsive",
          severity: "warning",
          message: `${product.title} tiene una imagen sin variantes responsive (WebP/srcset).`,
          path: `products.${productIndex}.imageIds`,
        });
      }
    });
    product.variants.forEach((variant, variantIndex) => {
      if (variant.price <= 0) {
        issues.push({
          code: "variant.price",
          severity: "critical",
          message: `${product.title}, ${variant.title} no tiene un precio válido.`,
          path: `products.${productIndex}.variants.${variantIndex}.price`,
        });
      }
      if (!variant.gtin && !variant.mpn && !variant.sku) {
        issues.push({
          code: "variant.identifier",
          severity: "warning",
          message: `${product.title}, ${variant.title} no tiene identificador comercial.`,
          path: `products.${productIndex}.variants.${variantIndex}`,
        });
      }
    });
  });

  project.videos.forEach((video, videoIndex) => {
    const heroPoster = effectiveHomeSections(project).some(
      (section) =>
        section.enabled &&
        section.slot === "hero" &&
        section.settings.videoAssetId === video.id &&
        typeof section.settings.posterAssetId === "string" &&
        section.settings.posterAssetId.length > 0,
    );
    if (!video.posterAssetId && !heroPoster) {
      issues.push({
        code: "video.poster",
        severity: "critical",
        message: `${video.name} necesita un poster para mantener un primer paint estable.`,
        path: `videos.${videoIndex}.posterAssetId`,
        area: "content",
        fixTarget: "assets",
      });
    }
    const videoBytes = dataUrlBytes(video.source);
    if (videoBytes && videoBytes.byteLength > 30 * 1024 * 1024) {
      issues.push({
        code: "video.size",
        severity: "critical",
        message: `${video.name} supera el límite inicial de 30 MB.`,
        path: `videos.${videoIndex}.source`,
        area: "content",
        fixTarget: "assets",
      });
    }
    if (video.durationSeconds > 15) {
      issues.push({
        code: "video.duration",
        severity: "warning",
        message: `${video.name} supera la duración recomendada de 15 segundos.`,
        path: `videos.${videoIndex}.durationSeconds`,
        area: "content",
        fixTarget: "assets",
      });
    }
  });

  project.categories.forEach((category) => {
    categorySlugs.set(category.slug, (categorySlugs.get(category.slug) ?? 0) + 1);
  });
  project.collections.forEach((collection) => {
    collectionSlugs.set(collection.slug, (collectionSlugs.get(collection.slug) ?? 0) + 1);
  });

  productSlugs.forEach((count, slug) => {
    if (count > 1) {
      issues.push({
        code: "product.slug.duplicate",
        severity: "critical",
        message: `El slug de producto "${slug}" está repetido.`,
      });
    }
  });
  categorySlugs.forEach((count, slug) => {
    if (count > 1) {
      issues.push({
        code: "category.slug.duplicate",
        severity: "critical",
        message: `El slug de categoría "${slug}" está repetido.`,
      });
    }
  });
  collectionSlugs.forEach((count, slug) => {
    if (count > 1) {
      issues.push({
        code: "collection.slug.duplicate",
        severity: "critical",
        message: `El slug de colección "${slug}" está repetido.`,
        area: "technical",
        fixTarget: "catalog",
      });
    }
  });

  [...productSlugs.keys(), ...categorySlugs.keys(), ...collectionSlugs.keys()].forEach((slug) => {
    if (reservedSlugs.has(slug)) {
      issues.push({
        code: "slug.reserved",
        severity: "critical",
        message: `El slug "${slug}" está reservado por una ruta pública.`,
        area: "technical",
        fixTarget: "catalog",
      });
    }
  });

  if (project.policies.shipping.handlingDaysMin > project.policies.shipping.handlingDaysMax) {
    issues.push({
      code: "shipping.handling-range",
      severity: "critical",
      message: "El rango de preparación de envíos es inválido.",
      area: "content",
      fixTarget: "summary",
    });
  }
  if (project.policies.shipping.transitDaysMin > project.policies.shipping.transitDaysMax) {
    issues.push({
      code: "shipping.transit-range",
      severity: "critical",
      message: "El rango de tránsito de envíos es inválido.",
      area: "content",
      fixTarget: "summary",
    });
  }
  if (!project.identity.phone.trim() || !project.identity.address.trim()) {
    issues.push({
      code: "identity.contact",
      severity: "warning",
      message: "La tienda debería publicar teléfono y dirección comercial.",
      area: "content",
      fixTarget: "summary",
    });
  }

  project.products.forEach((product, productIndex) => {
    if (product.status !== "active") return;
    if (!product.brand.trim()) {
      issues.push({
        code: "product.brand",
        severity: "warning",
        message: `${product.title} no tiene marca comercial.`,
        area: "merchant",
        path: `products.${productIndex}.brand`,
        fixTarget: "catalog",
        entity: { type: "product", id: product.id, label: product.title },
      });
    }
    product.variants.forEach((variant, variantIndex) => {
      if (variant.stockStatus === "preorder" && !variant.availabilityDate) {
        issues.push({
          code: "variant.availability-date",
          severity: "critical",
          message: `${product.title}, ${variant.title} necesita fecha de disponibilidad para preorder.`,
          area: "merchant",
          path: `products.${productIndex}.variants.${variantIndex}.availabilityDate`,
          fixTarget: "catalog",
          entity: { type: "variant", id: variant.id, label: `${product.title} - ${variant.title}` },
        });
      }
      if (variant.stockStatus !== "preorder" && variant.availabilityDate) {
        issues.push({
          code: "variant.availability-date.unused",
          severity: "warning",
          message: `${product.title}, ${variant.title} tiene una fecha que sólo aplica a preorder.`,
          area: "merchant",
          path: `products.${productIndex}.variants.${variantIndex}.availabilityDate`,
          fixTarget: "catalog",
        });
      }
    });
  });

  const feed = buildMerchantFeed(project, snapshot);
  // Verificar cada oferta con `feed.includes(markup)` es O(ofertas × feed):
  // con 3.600 ofertas y un feed de ~1 MB son ~10 GB de comparación de strings.
  // El feed se construye desde el MISMO snapshot (price/availability no pueden
  // divergir); el contrato real es la presencia de cada oferta en el feed.
  const feedItemIds = new Set(
    [...feed.matchAll(/<g:id>([^<]+)<\/g:id>/g)].map((match) => match[1]),
  );
  snapshot.offers.forEach((offer) => {
    if (!feedItemIds.has(escapeXml(offer.variantId))) {
      issues.push({
        code: "merchant.snapshot-mismatch",
        severity: "critical",
        message: `La oferta ${offer.variantId} no coincide con el snapshot comercial.`,
        area: "merchant",
        fixTarget: "export",
        entity: { type: "variant", id: offer.variantId, label: offer.title },
      });
    }
  });

  if (!project.policies.shipping.details.trim() || !project.policies.returns.details.trim()) {
    issues.push({
      code: "policies.incomplete",
      // warning: el Studio no tiene editor de políticas; un crítico sin UI
      // para resolverlo bloquearía producción de forma inalcanzable.
      severity: "warning",
      message: "Las políticas de envío y devoluciones deben estar completas.",
    });
  }

  issues.push({
    code: "merchant.whatsapp-checkout",
    severity: "warning",
    message:
      "Google Merchant puede rechazar una tienda cuyo pedido se completa únicamente por WhatsApp.",
  });

  return issues.map((issue) => ({
    ...issue,
    area:
      issue.area ??
      (issue.code.startsWith("merchant") || issue.code.startsWith("variant.")
        ? "merchant"
        : issue.code.startsWith("domain") || issue.code.includes("slug")
          ? "technical"
          : issue.code.startsWith("image") || issue.code.startsWith("product")
            ? "content"
            : "structured-data"),
    fixTarget:
      issue.fixTarget ??
      (issue.code.startsWith("image")
        ? "assets"
        : issue.code.startsWith("variant")
          ? "catalog"
          : "seo"),
  }));
}

export function auditReport(project: StoreProjectV1, publicAiContext = true): AuditReport {
  const baseIssues = auditProject(project, publicAiContext);
  const optimization = optimizeProject(project, { mode: "draft", publicAiContext: false });
  const existingPaths = new Set(baseIssues.map((issue) => issue.path).filter(Boolean));
  const optimizationIssues: AuditIssue[] = optimization.findings
    .filter((finding) => !finding.path || !existingPaths.has(finding.path))
    .map((finding) => ({
      code: finding.code,
      severity: finding.severity,
      area: finding.area,
      message: finding.message,
      ...(finding.path ? { path: finding.path } : {}),
      ...(finding.entity ? { entity: finding.entity } : {}),
    }));
  const issues = [...baseIssues, ...optimizationIssues];
  return {
    issues,
    criticalCount: issues.filter((issue) => issue.severity === "critical").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
    merchantMode: "experimental-whatsapp",
    optimization,
  };
}
