import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { catalogModernCleanStore } from "@solara/project-schema/catalog-modern-template";
import { describe, expect, it } from "vitest";
import { buildAiContext, buildLlmsTxt, optimizeProject } from "./index";

describe("site optimizer", () => {
  it("construye un informe determinista para la demo de 50 productos", () => {
    const first = optimizeProject(catalogModernStore, {
      mode: "production",
      publicAiContext: true,
    });
    const second = optimizeProject(catalogModernStore, {
      mode: "production",
      publicAiContext: true,
    });

    expect(first).toEqual(second);
    expect(first.counts.activeProducts).toBe(50);
    expect(first.routes.filter((route) => route.pageType === "product")).toHaveLength(50);
    expect(first.aiReadiness.structuredDataSource).toBe("shared-snapshot");
  });

  it("detecta contenido incompleto sin inventarlo", () => {
    const project = structuredClone(catalogModernStore);
    const product = project.products[0];
    if (!product) throw new Error("Fixture incompleto");
    product.description = "";
    product.imageIds = [];

    const report = optimizeProject(project, { mode: "draft", publicAiContext: false });
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "content.product.description", severity: "critical" }),
        expect.objectContaining({ code: "content.product.image", severity: "critical" }),
      ]),
    );
    expect(report.aiReadiness.publicContextAvailable).toBe(false);
  });

  it("genera contexto publico sin datos privados ni recursos data URL", () => {
    const context = buildAiContext(catalogModernStore);
    const parsed = JSON.parse(context) as {
      products: unknown[];
      site: { name: string };
      contact: { email?: string };
    };
    expect(parsed.site.name).toBe("Tienda Referencia");
    expect(parsed.products).toHaveLength(50);
    expect(context).not.toContain("data:image");
    expect(parsed.contact.email).toBe("hola@tienda-referencia-modern.example");
  });

  it("puede serializar el contexto AI en modo compacto para producción", () => {
    const pretty = buildAiContext(catalogModernStore);
    const compact = buildAiContext(catalogModernStore, { compact: true });

    expect(compact.length).toBeLessThan(pretty.length);
    expect(JSON.parse(compact)).toEqual(JSON.parse(pretty));
  });

  it("no presenta contexto publico como publicado en modo draft", () => {
    const report = optimizeProject(catalogModernStore, {
      mode: "draft",
      publicAiContext: true,
    });
    expect(report.aiReadiness.publicContextAvailable).toBe(false);
  });

  it("genera llms.txt legible y con enlaces canonicos", () => {
    const text = buildLlmsTxt(catalogModernCleanStore);
    expect(text).toContain("# Nueva tienda");
    expect(text).not.toContain("Modo Sur");
    expect(text).toContain("/#contact-form");
    expect(text).toContain("## Productos");
    expect(text.endsWith("\n")).toBe(true);
  });

  it("mantiene llms.txt resumido, sin duplicados y con datos de contacto", () => {
    const project = structuredClone(catalogModernStore);
    const firstProduct = project.products[0];
    const secondProduct = project.products[1];
    if (!firstProduct || !secondProduct) throw new Error("Fixture sin productos suficientes");
    secondProduct.title = firstProduct.title;

    const text = buildLlmsTxt(project);
    const primaryStart = text.indexOf("## Páginas principales");
    const categoriesStart = text.indexOf("## Categorías");
    const primarySection = text.slice(primaryStart, categoriesStart);
    const urls = [...text.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((match) => match[1]);

    expect(primarySection).not.toContain("/productos/");
    expect(new Set(urls).size).toBe(urls.length);
    expect(text).toContain(`${firstProduct.title} — ${firstProduct.slug}`);
    expect(text).toContain(`${firstProduct.title} — ${secondProduct.slug}`);
    expect(text).toContain("Última actualización:");
    expect(text).toContain("Email:");
  });

  it("no enlaza categorías ocultas en el contexto ni en llms.txt", () => {
    const project = structuredClone(catalogModernStore);
    const hiddenCategory = project.categories[0];
    if (!hiddenCategory) throw new Error("Fixture sin categorías");
    hiddenCategory.status = "hidden";

    const context = JSON.parse(buildAiContext(project)) as {
      pages: Array<{ path: string }>;
      categories: Array<{ id: string }>;
    };
    const hiddenPath = `/categorias/${hiddenCategory.slug}/`;
    const llms = buildLlmsTxt(project);

    expect(context.pages.some((page) => page.path === hiddenPath)).toBe(false);
    expect(context.categories.some((category) => category.id === hiddenCategory.id)).toBe(false);
    expect(llms).not.toContain(hiddenPath);
  });

  it("advierte cuando una seccion de catalogo apunta a un origen inexistente", () => {
    const project = structuredClone(catalogModernStore);
    const section = project.sections.find(
      (item) => item.moduleId === "catalog-product-grid" && item.slot === "catalog",
    );
    if (!section) throw new Error("Fixture sin seccion de catalogo");
    project.sections = [
      ...project.sections,
      {
        ...structuredClone(section),
        id: "section-orphan-collection" as typeof section.id,
        settings: {
          ...section.settings,
          title: "Origen roto",
          source: "collection",
          sourceId: "collection-inexistente",
        },
      },
      {
        ...structuredClone(section),
        id: "section-orphan-category" as typeof section.id,
        settings: {
          ...section.settings,
          title: "Categoria rota",
          source: "category",
          sourceId: "category-inexistente",
        },
      },
    ];
    const report = optimizeProject(project, { mode: "production" });

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "catalog.section.orphan-source",
          severity: "warning",
          entity: { type: "collection", id: "collection-inexistente", label: "Origen roto" },
        }),
        expect.objectContaining({
          code: "catalog.section.orphan-source",
          severity: "warning",
          entity: { type: "category", id: "category-inexistente", label: "Categoria rota" },
        }),
      ]),
    );
  });

  it("advierte un origen huérfano dentro de las secciones de una página", () => {
    const project = structuredClone(catalogModernStore);
    const section = project.sections.find(
      (item) => item.moduleId === "catalog-product-grid" && item.slot === "catalog",
    );
    if (!section) throw new Error("Fixture sin seccion de catalogo");
    project.pages = project.pages.map((page) =>
      page.kind === "home"
        ? {
            ...page,
            sections: [
              {
                ...structuredClone(section),
                id: "page-orphan-collection" as typeof section.id,
                settings: {
                  ...section.settings,
                  title: "Origen roto en página",
                  source: "collection",
                  sourceId: "collection-inexistente",
                },
              },
            ],
          }
        : page,
    );
    const report = optimizeProject(project, { mode: "production" });

    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "catalog.section.orphan-source",
        severity: "warning",
        path: "pages.0.sections.0.settings.sourceId",
        entity: {
          type: "collection",
          id: "collection-inexistente",
          label: "Origen roto en página",
        },
      }),
    );
  });

  it("incluye la paginación de colecciones en rutas, llms.txt y contexto AI", () => {
    const report = optimizeProject(catalogModernStore, { mode: "production" });
    const collectionRoutes = report.routes.filter(
      (route) => route.pageType === "collection" && route.path.includes("/pagina/"),
    );
    const llms = buildLlmsTxt(catalogModernStore);
    const context = JSON.parse(buildAiContext(catalogModernStore)) as {
      pages: Array<{ path: string; canonicalUrl: string }>;
    };

    expect(collectionRoutes).toEqual([
      expect.objectContaining({
        path: "/colecciones/esenciales/pagina/2/",
        canonicalPath: "/colecciones/esenciales/pagina/2/",
        indexable: true,
      }),
    ]);
    expect(llms).toContain("tienda-referencia-modern.example/colecciones/esenciales/pagina/2/");
    expect(context.pages.some((page) => page.path === "/colecciones/esenciales/pagina/2/")).toBe(
      true,
    );
    expect(
      context.pages.some((page) => page.path === "/colecciones/recien-llegados/pagina/2/"),
    ).toBe(false);
  });
});
