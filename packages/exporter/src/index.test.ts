import { referenceStore } from "@solara/project-schema/fixture";
import { describe, expect, it } from "vitest";
import {
  auditProject,
  createProjectArchive,
  exportProject,
  readProjectArchive,
  renderPreviewHtml,
} from "./index";

describe("exporter", () => {
  it("crea páginas estáticas y un feed consistente", () => {
    const result = exportProject(referenceStore, { mode: "production" });
    const productHtml = String(result.files.get("productos/manta-bruma/index.html"));
    const feed = String(result.files.get("google-merchant.xml"));

    expect(productHtml).toContain("Manta Bruma");
    expect(productHtml).toContain("78500.00");
    expect(productHtml).toContain('"@type":"ProductGroup"');
    expect(feed.match(/<item>/g)).toHaveLength(3);
    expect(feed).toContain("<g:price>78500.00 ARS</g:price>");
  });

  it("mantiene contenido y SEO en el HTML inicial", () => {
    const preview = renderPreviewHtml(referenceStore);
    expect(preview).toContain("Una casa con materia y calma.");
    expect(preview).toContain('<meta name="description"');
    expect(preview).toContain('<script type="application/ld+json">');
  });

  it("usa el mismo árbol semántico de módulos en preview y home exportado", () => {
    const preview = renderPreviewHtml(referenceStore);
    const exported = String(
      exportProject(referenceStore, { mode: "draft" }).files.get("index.html"),
    );
    const moduleTree = (html: string) =>
      [...html.matchAll(/data-solara-module="([^"]+)"/g)].map((match) => match[1]);

    expect(moduleTree(preview)).toEqual(moduleTree(exported));
  });

  it("incluye estilos una sola vez y excluye assets de módulos deshabilitados", () => {
    const source = referenceStore.sections.find((section) => section.moduleId === "trust-strip");
    if (!source) throw new Error("Fixture incompleto");
    const project = {
      ...referenceStore,
      sections: [
        ...referenceStore.sections,
        { ...source, id: "section-trust-copy", enabled: true },
        {
          ...source,
          id: "section-disabled-content",
          slot: "content",
          moduleId: "image-text-content",
          enabled: false,
        },
      ],
    };
    const result = exportProject(project as typeof referenceStore, { mode: "draft" });
    const baseline = exportProject(referenceStore, { mode: "draft" });
    const css = String(result.files.get("assets/storefront.css"));
    const html = String(result.files.get("index.html"));

    expect(css).toBe(baseline.files.get("assets/storefront.css"));
    expect(css).not.toContain('[data-solara-module="image-text-content"]');
    expect(html).not.toContain('data-solara-module="image-text-content"');
    expect([...result.files.keys()].filter((path) => path === "assets/storefront.js")).toHaveLength(
      1,
    );
  });

  it("rechaza proyectos inválidos con una ruta accionable en cada límite público", () => {
    const invalid = { ...referenceStore, baseUrl: "no-es-una-url" };

    expect(() => exportProject(invalid as typeof referenceStore, { mode: "draft" })).toThrow(
      /exportar.*baseUrl/i,
    );
    expect(() => renderPreviewHtml(invalid as typeof referenceStore)).toThrow(
      /vista previa.*baseUrl/i,
    );
    expect(() => createProjectArchive(invalid as typeof referenceStore)).toThrow(
      /archivo del proyecto.*baseUrl/i,
    );
  });

  it("excluye feed y agrega noindex en borrador", () => {
    const result = exportProject(referenceStore, { mode: "draft" });
    expect(result.files.has("google-merchant.xml")).toBe(false);
    expect(result.files.get("robots.txt")).toContain("Disallow: /");
    expect(result.files.get("index.html")).toContain("noindex,nofollow");
  });

  it("recupera un archivo de proyecto sin cambios", () => {
    expect(readProjectArchive(createProjectArchive(referenceStore))).toEqual(referenceStore);
  });

  it("produce un ZIP reproducible para el mismo snapshot", () => {
    const first = exportProject(referenceStore, { mode: "production" }).zip;
    const second = exportProject(referenceStore, { mode: "production" }).zip;
    expect(second).toEqual(first);
  });

  it("deduplica y publica variantes responsive procesadas", () => {
    const firstAsset = referenceStore.assets[0];
    if (!firstAsset) throw new Error("Fixture incompleto");
    const project = {
      ...referenceStore,
      assets: [
        {
          ...firstAsset,
          mimeType: "image/webp",
          source: "data:image/webp;base64,AA==",
          fallbackSource: "data:image/jpeg;base64,AQ==",
          responsiveSources: [
            { width: 480, source: "data:image/webp;base64,Ag==" },
            { width: 960, source: "data:image/webp;base64,Aw==" },
          ],
        },
        ...referenceStore.assets.slice(1),
      ],
    };
    const result = exportProject(project, { mode: "draft" });
    const html = String(result.files.get("index.html"));

    expect(result.files.has("assets/fixture-manta.webp")).toBe(true);
    expect(result.files.has("assets/fixture-manta-fallback.jpg")).toBe(true);
    expect(result.files.has("assets/fixture-manta-480.webp")).toBe(true);
    expect(result.files.has("assets/fixture-manta-960.webp")).toBe(true);
    expect(html).toContain("/assets/fixture-manta-480.webp 480w");
  });

  it("usa la extensión del MIME real para fallback y variantes responsive", () => {
    const firstAsset = referenceStore.assets[0];
    if (!firstAsset) throw new Error("Fixture incompleto");
    const project = {
      ...referenceStore,
      assets: [
        {
          ...firstAsset,
          mimeType: "image/webp",
          source: "data:image/webp;base64,AA==",
          fallbackSource: "data:image/png;base64,AQ==",
          responsiveSources: [{ width: 480, source: "data:image/jpeg;base64,Ag==" }],
        },
        ...referenceStore.assets.slice(1),
      ],
    };

    const result = exportProject(project, { mode: "draft" });
    const html = String(result.files.get("index.html"));

    expect(result.files.has("assets/fixture-manta-fallback.png")).toBe(true);
    expect(result.files.has("assets/fixture-manta-480.jpg")).toBe(true);
    expect(result.files.has("assets/fixture-manta-fallback.jpg")).toBe(false);
    expect(html).toContain("/assets/fixture-manta-fallback.png");
    expect(html).toContain("/assets/fixture-manta-480.jpg 480w");
  });

  it("deduplica rutas y binarios de assets con el mismo hash", () => {
    const firstAsset = referenceStore.assets[0];
    if (!firstAsset) throw new Error("Fixture incompleto");
    const duplicate = {
      ...firstAsset,
      id: "asset-duplicate",
      source: "data:image/webp;base64,AA==",
      mimeType: "image/webp",
      hash: "shared-content-hash",
    };
    const project = {
      ...referenceStore,
      assets: [{ ...duplicate, id: firstAsset.id }, duplicate, ...referenceStore.assets.slice(1)],
    };

    const result = exportProject(project as typeof referenceStore, { mode: "draft" });

    expect(
      [...result.files.keys()].filter((path) => path === "assets/shared-content-hash.webp"),
    ).toHaveLength(1);
  });

  it("advierte el riesgo Merchant del checkout por WhatsApp", () => {
    expect(auditProject(referenceStore)).toContainEqual(
      expect.objectContaining({ code: "merchant.whatsapp-checkout", severity: "warning" }),
    );
  });
});
