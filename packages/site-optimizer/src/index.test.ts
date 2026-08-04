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
    expect(parsed.site.name).toBe("Modo Sur");
    expect(parsed.products).toHaveLength(50);
    expect(context).not.toContain("data:image");
    expect(parsed.contact.email).toBe("hola@modo-sur.example");
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
    expect(text).toContain("/contacto/");
    expect(text).toContain("## Productos");
    expect(text.endsWith("\n")).toBe(true);
  });
});
