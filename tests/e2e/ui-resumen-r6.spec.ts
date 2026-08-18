/**
 * Auditoría Resumen R6 — contrato de páginas públicas por familia visual.
 *
 * En V2 las páginas editoriales independientes se conservan sólo como datos
 * archivados para compatibilidad. El contenido de contacto publicado vive al
 * final de Home; la V1 mantiene su contrato histórico.
 */
import { expect, test } from "@playwright/test";
import { exportProject, renderPreviewHtml } from "@solara/exporter";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";

test("V2 concentra Contacto en Home y no publica rutas editoriales independientes", () => {
  const project = structuredClone(catalogModernV2Store);
  const exported = exportProject(project, { mode: "production" });
  const home = String(exported.files.get("index.html"));

  expect(project.pages.some((page) => page.kind === "about")).toBe(true);
  expect(project.pages.some((page) => page.kind === "contact")).toBe(true);
  expect(home).toContain('data-solara-module="contact-form"');
  expect(home).toContain('data-solara-module="contact-channels"');
  expect(home).not.toContain('href="/contacto/"');
  expect(home).not.toContain('href="/nosotros/"');
  expect(exported.files.has("contacto/index.html")).toBe(false);
  expect(exported.files.has("nosotros/index.html")).toBe(false);

  expect(renderPreviewHtml(project, "draft", "/contacto/")).toContain("No encontramos esa página");
  expect(renderPreviewHtml(project, "draft", "/nosotros/")).toContain("No encontramos esa página");
});

test("V1 conserva las páginas Contacto y Nosotros", () => {
  const exported = exportProject(structuredClone(catalogModernStore), { mode: "production" });

  expect(exported.files.has("contacto/index.html")).toBe(true);
  expect(exported.files.has("nosotros/index.html")).toBe(true);
});
