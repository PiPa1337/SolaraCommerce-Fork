/**
 * Auditoría pura del snapshot público. Calcula problemas SEO, media, Merchant,
 * rendimiento y contexto IA sin descargar recursos ni modificar el proyecto.
 */
import {
  type Category,
  getCategoryAncestors,
  getCategoryProductIds,
  type ImageAsset,
  type Product,
  type StoreProjectV1,
} from "@solara/project-schema";

export type OptimizationSeverity = "critical" | "warning" | "info";
export type OptimizationArea =
  | "technical"
  | "content"
  | "structured-data"
  | "merchant"
  | "performance"
  | "ai";

export interface OptimizationFinding {
  code: string;
  severity: OptimizationSeverity;
  area: OptimizationArea;
  message: string;
  path?: string;
  fixable: boolean;
  entity?: {
    type: "store" | "product" | "variant" | "category" | "collection" | "asset";
    id: string;
    label: string;
  };
}

export interface AppliedOptimization {
  code: string;
  description: string;
}

export interface OptimizationRoute {
  path: string;
  pageType:
    | "home"
    | "category"
    | "collection"
    | "product"
    | "about"
    | "contact"
    | "legal"
    | "search"
    | "cart"
    | "checkout";
  indexable: boolean;
  canonicalPath: string;
  title: string;
  description: string;
  linkedFromHome: boolean;
}

export interface OptimizationReport {
  snapshotHash: string;
  score: number;
  findings: readonly OptimizationFinding[];
  appliedFixes: readonly AppliedOptimization[];
  routes: readonly OptimizationRoute[];
  counts: {
    critical: number;
    warnings: number;
    info: number;
    indexable: number;
    activeProducts: number;
    assets: number;
  };
  performance: {
    imageBytes: number;
    videoBytes: number;
    responsiveImages: number;
    eagerCandidates: number;
    largeImages: number;
  };
  aiReadiness: {
    entityComplete: boolean;
    factualProductCoverage: number;
    canonicalCoverage: number;
    structuredDataSource: "shared-snapshot";
    publicContextAvailable: boolean;
  };
}

export interface OptimizationOptions {
  mode: "draft" | "production";
  profile?: "safe" | "strict";
  publicAiContext?: boolean;
}

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

function dataUrlBytes(source: string): number {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(source);
  if (!match) return 0;
  const payload = match[3] ?? "";
  if (match[2]) return Math.floor((payload.replace(/=+$/, "").length * 3) / 4);
  try {
    return decodeURIComponent(payload).length;
  } catch {
    return payload.length;
  }
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function publicUrl(project: StoreProjectV1, path: string): string {
  return `${project.baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function route(
  path: string,
  pageType: OptimizationRoute["pageType"],
  indexable: boolean,
  canonicalPath: string,
  title: string,
  description: string,
  linkedFromHome: boolean,
): OptimizationRoute {
  return { path, pageType, indexable, canonicalPath, title, description, linkedFromHome };
}

function categoryProducts(project: StoreProjectV1, category: Category): Product[] {
  const ids = new Set(getCategoryProductIds(project, category.id));
  return project.products.filter((product) => product.status === "active" && ids.has(product.id));
}

function buildRoutes(project: StoreProjectV1): OptimizationRoute[] {
  const pageByKind = new Map(project.pages.map((page) => [page.kind, page]));
  const home = pageByKind.get("home");
  const about = pageByKind.get("about");
  const contact = pageByKind.get("contact");
  const pageSize = project.commerceTemplates.category.productsPerPage;
  const routes: OptimizationRoute[] = [
    route(
      "/",
      "home",
      true,
      "/",
      home?.seoTitle ?? project.seo.title,
      home?.seoDescription ?? project.seo.description,
      true,
    ),
    route(
      "/nosotros/",
      "about",
      true,
      "/nosotros/",
      about?.seoTitle ?? `Nosotros | ${project.identity.brandName}`,
      about?.seoDescription ?? project.identity.description,
      true,
    ),
    route(
      "/contacto/",
      "contact",
      true,
      "/contacto/",
      contact?.seoTitle ?? `Contacto | ${project.identity.brandName}`,
      contact?.seoDescription ?? "Escribinos para coordinar tu pedido.",
      true,
    ),
    route(
      "/envios/",
      "legal",
      true,
      "/envios/",
      `Envios | ${project.identity.brandName}`,
      project.policies.shipping.summary,
      false,
    ),
    route(
      "/devoluciones/",
      "legal",
      true,
      "/devoluciones/",
      `Cambios y devoluciones | ${project.identity.brandName}`,
      project.policies.returns.summary,
      false,
    ),
    route(
      "/privacidad/",
      "legal",
      true,
      "/privacidad/",
      `Privacidad | ${project.identity.brandName}`,
      "Como usamos los datos compartidos al realizar un pedido.",
      false,
    ),
    route(
      "/terminos/",
      "legal",
      true,
      "/terminos/",
      `Terminos | ${project.identity.brandName}`,
      "Condiciones comerciales de la tienda.",
      false,
    ),
  ];

  if (project.commerceTemplates.search.enabled) {
    routes.push(
      route(
        "/buscar/",
        "search",
        false,
        "/buscar/",
        `Buscar | ${project.identity.brandName}`,
        "Busca productos por nombre, categoria o etiqueta.",
        true,
      ),
    );
  }
  if (project.commerceTemplates.cart.enabled) {
    routes.push(
      route(
        "/carrito/",
        "cart",
        false,
        "/carrito/",
        `Carrito | ${project.identity.brandName}`,
        "Revisa los productos de tu pedido.",
        true,
      ),
    );
  }
  if (project.commerceTemplates.checkout.enabled) {
    routes.push(
      route(
        "/compra/",
        "checkout",
        false,
        "/compra/",
        `Compra | ${project.identity.brandName}`,
        "Completa los datos para coordinar tu pedido.",
        true,
      ),
    );
  }

  project.categories.forEach((category) => {
    const products = categoryProducts(project, category);
    const pages = Math.max(1, Math.ceil(products.length / pageSize));
    for (let page = 1; page <= pages; page += 1) {
      const suffix = page === 1 ? "" : `pagina/${page}/`;
      const path = `/categorias/${category.slug}/${suffix}`;
      routes.push(
        route(
          path,
          "category",
          true,
          path,
          `${category.title} | ${project.identity.brandName}`,
          category.description,
          page === 1,
        ),
      );
    }
  });

  project.collections.forEach((collection) => {
    const path = `/colecciones/${collection.slug}/`;
    routes.push(
      route(
        path,
        "collection",
        true,
        path,
        `${collection.title} | ${project.identity.brandName}`,
        collection.description,
        true,
      ),
    );
  });

  project.products
    .filter((product) => product.status === "active")
    .forEach((product) => {
      const path = `/productos/${product.slug}/`;
      routes.push(
        route(
          path,
          "product",
          true,
          path,
          `${product.title} | ${project.identity.brandName}`,
          product.description,
          true,
        ),
      );
    });
  return routes;
}

function addFinding(
  findings: OptimizationFinding[],
  finding: Omit<OptimizationFinding, "fixable"> & { fixable?: boolean },
): void {
  findings.push({ ...finding, fixable: finding.fixable ?? false });
}

function auditProject(
  project: StoreProjectV1,
  routes: readonly OptimizationRoute[],
): OptimizationFinding[] {
  const findings: OptimizationFinding[] = [];
  const allSlugs = new Map<string, string[]>();
  const addSlug = (slug: string, kind: string) => {
    const values = allSlugs.get(slug) ?? [];
    values.push(kind);
    allSlugs.set(slug, values);
  };
  project.products.forEach((product) => {
    addSlug(product.slug, "producto");
  });
  project.categories.forEach((category) => {
    addSlug(category.slug, "categoria");
  });
  project.collections.forEach((collection) => {
    addSlug(collection.slug, "coleccion");
  });
  allSlugs.forEach((kinds, slug) => {
    if (new Set(kinds).size > 1 || kinds.length > 1) {
      addFinding(findings, {
        code: "route.slug.duplicate",
        severity: "critical",
        area: "technical",
        message: `El slug publico "${slug}" se repite entre ${kinds.join(", ")}.`,
        path: "slug",
      });
    }
    if (reservedSlugs.has(slug)) {
      addFinding(findings, {
        code: "route.slug.reserved",
        severity: "critical",
        area: "technical",
        message: `El slug "${slug}" esta reservado por una ruta publica.`,
        path: "slug",
      });
    }
  });

  if (!project.baseUrl.startsWith("https://")) {
    addFinding(findings, {
      code: "domain.https",
      severity: "critical",
      area: "technical",
      message: "El dominio de produccion debe usar HTTPS.",
      path: "baseUrl",
    });
  }
  if (!project.identity.brandName.trim() || !project.identity.description.trim()) {
    addFinding(findings, {
      code: "ai.entity.incomplete",
      severity: "warning",
      area: "ai",
      message: "La entidad de marca necesita nombre y descripcion publica.",
      path: "identity",
    });
  }
  if (!project.identity.email.trim() && !project.identity.phone.trim()) {
    addFinding(findings, {
      code: "ai.contact.missing",
      severity: "warning",
      area: "ai",
      message: "La tienda no publica email ni telefono de contacto.",
      path: "identity.contact",
    });
  }

  const activeProducts = project.products.filter((product) => product.status === "active");
  activeProducts.forEach((product, productIndex) => {
    if (!product.description.trim()) {
      addFinding(findings, {
        code: "content.product.description",
        severity: "critical",
        area: "content",
        message: `${product.title} no tiene descripcion publica.`,
        path: `products.${productIndex}.description`,
        fixable: false,
        entity: { type: "product", id: product.id, label: product.title },
      });
    }
    if (product.imageIds.length === 0) {
      addFinding(findings, {
        code: "content.product.image",
        severity: "critical",
        area: "content",
        message: `${product.title} no tiene imagen publica.`,
        path: `products.${productIndex}.imageIds`,
        entity: { type: "product", id: product.id, label: product.title },
      });
    }
    product.variants.forEach((variant, variantIndex) => {
      if (variant.price <= 0) {
        addFinding(findings, {
          code: "merchant.variant.price",
          severity: "critical",
          area: "merchant",
          message: `${product.title}, ${variant.title} no tiene un precio valido.`,
          path: `products.${productIndex}.variants.${variantIndex}.price`,
          entity: { type: "variant", id: variant.id, label: `${product.title} - ${variant.title}` },
        });
      }
      if (!variant.sku && !variant.gtin && !variant.mpn) {
        addFinding(findings, {
          code: "merchant.variant.identifier",
          severity: "warning",
          area: "merchant",
          message: `${product.title}, ${variant.title} no tiene SKU, GTIN ni MPN.`,
          path: `products.${productIndex}.variants.${variantIndex}`,
          entity: { type: "variant", id: variant.id, label: `${product.title} - ${variant.title}` },
        });
      }
    });
  });

  project.assets.forEach((asset: ImageAsset, assetIndex) => {
    if (!asset.alt.trim()) {
      addFinding(findings, {
        code: "content.asset.alt",
        severity: "warning",
        area: "content",
        message: `${asset.name} no tiene texto alternativo.`,
        path: `assets.${assetIndex}.alt`,
        fixable: true,
        entity: { type: "asset", id: asset.id, label: asset.name },
      });
    }
    if (!asset.responsiveSources?.length && asset.width >= 1200) {
      addFinding(findings, {
        code: "performance.asset.responsive",
        severity: "warning",
        area: "performance",
        message: `${asset.name} es grande y no tiene variantes responsive.`,
        path: `assets.${assetIndex}.responsiveSources`,
        fixable: true,
        entity: { type: "asset", id: asset.id, label: asset.name },
      });
    }
    const bytes = dataUrlBytes(asset.source);
    if (bytes > 1_500_000) {
      addFinding(findings, {
        code: "performance.asset.weight",
        severity: "warning",
        area: "performance",
        message: `${asset.name} supera 1.5 MB en su recurso original.`,
        path: `assets.${assetIndex}.source`,
        fixable: true,
        entity: { type: "asset", id: asset.id, label: asset.name },
      });
    }
  });

  project.categories.forEach((category, categoryIndex) => {
    if (!category.description.trim()) {
      addFinding(findings, {
        code: "content.category.description",
        severity: "warning",
        area: "content",
        message: `${category.title} no tiene contexto editorial para buscadores.`,
        path: `categories.${categoryIndex}.description`,
        entity: { type: "category", id: category.id, label: category.title },
      });
    }
  });

  const titles = new Map<string, string[]>();
  routes
    .filter((item) => item.indexable)
    .forEach((item) => {
      const values = titles.get(item.title) ?? [];
      values.push(item.path);
      titles.set(item.title, values);
      if (!item.canonicalPath.startsWith("/")) {
        addFinding(findings, {
          code: "seo.canonical.invalid",
          severity: "critical",
          area: "technical",
          message: `La ruta ${item.path} no tiene canonical interno valido.`,
          path: item.path,
        });
      }
      if (!item.title.trim() || !item.description.trim()) {
        addFinding(findings, {
          code: "seo.metadata.missing",
          severity: "warning",
          area: "content",
          message: `La ruta ${item.path} necesita title y description.`,
          path: item.path,
          fixable: true,
        });
      }
    });
  titles.forEach((paths, title) => {
    if (paths.length > 1) {
      addFinding(findings, {
        code: "seo.title.duplicate",
        severity: "warning",
        area: "content",
        message: `El title "${title}" se repite en ${paths.length} rutas.`,
        path: paths.join(","),
      });
    }
  });

  const linkedProductIds = new Set(
    activeProducts
      .filter((product) => product.categoryIds.length || product.collectionIds.length)
      .map((product) => product.id),
  );
  activeProducts.forEach((product) => {
    if (!linkedProductIds.has(product.id)) {
      addFinding(findings, {
        code: "seo.product.orphan",
        severity: "warning",
        area: "technical",
        message: `${product.title} no esta asignado a una categoria ni coleccion.`,
        path: `products.${product.id}`,
        entity: { type: "product", id: product.id, label: product.title },
      });
    }
  });

  if (!project.policies.shipping.details.trim() || !project.policies.returns.details.trim()) {
    addFinding(findings, {
      code: "ai.policies.incomplete",
      severity: "warning",
      area: "ai",
      message: "Las politicas de envio y cambios necesitan informacion publica completa.",
      path: "policies",
    });
  }
  return findings;
}

function normalizeForHash(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(normalizeForHash).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${normalizeForHash(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Produce hallazgos deterministas y contexto público opcional para un snapshot. */
export function optimizeProject(
  project: StoreProjectV1,
  options: OptimizationOptions = { mode: "production", publicAiContext: true },
): OptimizationReport {
  const routes = buildRoutes(project);
  const findings = auditProject(project, routes);
  const imageBytes = project.assets.reduce((total, asset) => total + dataUrlBytes(asset.source), 0);
  const videoBytes = project.videos.reduce((total, video) => total + dataUrlBytes(video.source), 0);
  const responsiveImages = project.assets.filter((asset) => asset.responsiveSources?.length).length;
  const largeImages = project.assets.filter((asset) => asset.width >= 1200).length;
  const activeProducts = project.products.filter((product) => product.status === "active");
  const productsWithFacts = activeProducts.filter(
    (product) => product.description.trim() && product.imageIds.length > 0,
  ).length;
  const critical = findings.filter((finding) => finding.severity === "critical").length;
  const warnings = findings.filter((finding) => finding.severity === "warning").length;
  const info = findings.filter((finding) => finding.severity === "info").length;
  const entityComplete = Boolean(
    project.identity.brandName.trim() &&
      project.identity.description.trim() &&
      (project.identity.email.trim() || project.identity.phone.trim()),
  );
  const canonicalCoverage = routes.filter(
    (routeItem) => routeItem.indexable && routeItem.canonicalPath.startsWith("/"),
  ).length;
  const score = Math.max(0, Math.min(100, 100 - critical * 12 - warnings * 3));
  const appliedFixes: AppliedOptimization[] = [
    {
      code: "html.canonical",
      description: "El exporter generara un canonical autocontenido por pagina indexable.",
    },
    {
      code: "html.robots",
      description:
        options.mode === "draft"
          ? "El borrador usara noindex y nofollow."
          : "La produccion permitira rastreo y usara previews enriquecidas.",
    },
    {
      code: "structured.shared-snapshot",
      description: "HTML, JSON-LD, sitemap y feed se construiran desde el mismo snapshot.",
    },
    {
      code: "assets.deduplicate",
      description:
        "Los recursos se deduplicaran por hash y solo se incluiran si tienen uso publico.",
    },
    {
      code: "runtime.progressive",
      description: "La busqueda, el carrusel y el carrito se cargaran como mejoras progresivas.",
    },
    ...(options.mode === "production" && options.publicAiContext
      ? [
          {
            code: "ai.public-context",
            description: "Se generaran llms.txt y ai-context.json con datos publicos.",
          },
        ]
      : []),
  ];
  return {
    snapshotHash: hashString(normalizeForHash(project)),
    score,
    findings,
    appliedFixes,
    routes,
    counts: {
      critical,
      warnings,
      info,
      indexable: routes.filter((routeItem) => routeItem.indexable).length,
      activeProducts: activeProducts.length,
      assets: project.assets.length,
    },
    performance: {
      imageBytes,
      videoBytes,
      responsiveImages,
      eagerCandidates: Math.min(4, project.assets.length),
      largeImages,
    },
    aiReadiness: {
      entityComplete,
      factualProductCoverage: activeProducts.length ? productsWithFacts / activeProducts.length : 1,
      canonicalCoverage: routes.filter((routeItem) => routeItem.indexable).length
        ? canonicalCoverage / routes.filter((routeItem) => routeItem.indexable).length
        : 1,
      structuredDataSource: "shared-snapshot",
      publicContextAvailable: options.mode === "production" && Boolean(options.publicAiContext),
    },
  };
}

function cleanText(value: string): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Construye contexto factual opcional sin agregar requests al runtime. */
export function buildAiContext(
  project: StoreProjectV1,
  options: { compact?: boolean } = {},
): string {
  const routes = buildRoutes(project).filter((item) => item.indexable);
  const products = project.products
    .filter((product) => product.status === "active")
    .map((product) => ({
      id: product.id,
      name: product.title,
      url: publicUrl(project, `/productos/${product.slug}/`),
      brand: product.brand,
      description: cleanText(product.description),
      categories: product.categoryIds
        .flatMap((id) => [
          project.categories.find((category) => category.id === id),
          ...getCategoryAncestors(project, id as Category["id"]),
        ])
        .filter(
          (category, index, all) =>
            category && all.findIndex((item) => item?.id === category.id) === index,
        )
        .map((category) => category?.title)
        .filter((title): title is string => Boolean(title)),
      offers: product.variants.map((variant) => ({
        id: variant.id,
        title: variant.title,
        sku: variant.sku,
        price: variant.price,
        currency: project.currency,
        availability: variant.stockStatus,
        url: publicUrl(
          project,
          `/productos/${product.slug}/?variant=${encodeURIComponent(variant.id)}`,
        ),
      })),
    }));
  const context = {
    schemaVersion: 1,
    site: {
      name: project.identity.brandName,
      legalName: project.identity.legalName,
      description: cleanText(project.identity.description),
      url: publicUrl(project, "/"),
      locale: project.locale,
      currency: project.currency,
    },
    contact: {
      email: project.identity.email || undefined,
      phone: project.identity.phone || undefined,
      address: project.identity.address || undefined,
      whatsapp: project.whatsapp.phone || undefined,
    },
    pages: routes.map(({ path, pageType, canonicalPath, title, description }) => ({
      path,
      pageType,
      canonicalUrl: publicUrl(project, canonicalPath),
      title,
      description: cleanText(description),
    })),
    categories: project.categories.map((category) => ({
      id: category.id,
      name: category.title,
      ...(category.parentId ? { parentId: category.parentId } : {}),
      url: publicUrl(project, `/categorias/${category.slug}/`),
      description: cleanText(category.description),
      productCount: getCategoryProductIds(project, category.id).length,
    })),
    policies: {
      shipping: cleanText(project.policies.shipping.details),
      returns: cleanText(project.policies.returns.details),
    },
    products,
    snapshot: project.updatedAt,
  };
  return options.compact ? JSON.stringify(context) : JSON.stringify(context, null, 2);
}

export function buildLlmsTxt(project: StoreProjectV1): string {
  const routes = buildRoutes(project).filter((item) => item.indexable);
  const products = project.products.filter((product) => product.status === "active");
  const lines = [
    `# ${project.identity.brandName}`,
    "",
    cleanText(project.identity.description),
    "",
    "## Paginas principales",
    ...routes
      .slice(0, 80)
      .map(
        (item) =>
          `- [${cleanText(item.title)}](${publicUrl(project, item.canonicalPath)}): ${cleanText(item.description)}`,
      ),
    "",
    "## Categorias",
    ...project.categories.map(
      (category) =>
        `- [${cleanText(category.title)}](${publicUrl(project, `/categorias/${category.slug}/`)}): ${cleanText(category.description)}`,
    ),
    "",
    "## Productos",
    ...products.map(
      (product) =>
        `- [${cleanText(product.title)}](${publicUrl(project, `/productos/${product.slug}/`)}): ${cleanText(product.description)}`,
    ),
    "",
    "## Politicas",
    `- Envios: ${cleanText(project.policies.shipping.details)}`,
    `- Cambios y devoluciones: ${cleanText(project.policies.returns.details)}`,
    `- Contacto: ${publicUrl(project, "/contacto/")}`,
  ];
  return `${lines.join("\n")}\n`;
}

export function serializeOptimizationReport(report: OptimizationReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
