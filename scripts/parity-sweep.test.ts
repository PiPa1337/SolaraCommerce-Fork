import { expect, test } from "vitest";
import { exportProject, renderPreviewHtml } from "../packages/exporter/src/index";
import { catalogModernStore } from "../packages/project-schema/src/catalog-modern-fixture";
import { referenceStore } from "../packages/project-schema/src/fixture";
import { catalogScaleStore } from "../packages/project-schema/src/scale-fixture";

/**
 * C1: paridad diferencial preview/export. Para cada fixture y modo, toda ruta
 * exportada debe poder renderizarse en el preview con el mismo árbol de
 * módulos y el mismo cuerpo normalizado (ignorando el transporte de assets:
 * data URIs en preview vs /assets/ en export).
 */

function normalizeBodyForParity(html: string): string | null {
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  if (!body) return null;
  return body[1]
    .replace(/data:[^"')\s]+/g, "#DATA")
    .replace(/\/assets\/[^"')\s]+/g, "/assets/#")
    .replace(/\/fixtures\/[^"')\s]+/g, "/fixtures/#")
    .replace(/data-solara-preview-(?:src|srcset|poster)="[^"]*"/g, "")
    .replace(/<script type="application\/json" id="solara-preview-assets">[\s\S]*?<\/script>/g, "")
    .replace(/<script[^>]*>[\s\S]*?solara-preview[\s\S]*?<\/script>/g, "")
    .replace(/src="#DATA"/g, 'src="#ASSET"')
    .replace(/src="\/assets\/#"/g, 'src="#ASSET"')
    .replace(/href="#DATA"/g, 'href="#ASSET"')
    .replace(/href="\/assets\/#"/g, 'href="#ASSET"')
    .replace(/\s+/g, " ")
    .trim();
}

function moduleTreeOf(html: string): string[] {
  return [...html.matchAll(/data-solara-module="([^"]+)"/g)].map((match) => match[1]);
}

function canonicalPathForFile(path: string): string | null {
  if (!path.endsWith(".html")) return null;
  if (path === "index.html") return "/";
  if (path === "404.html") return "/404";
  if (!path.endsWith("/index.html")) return null;
  return `/${path.slice(0, -"index.html".length)}`;
}

function collectRouteFiles(project: typeof referenceStore, mode: "draft" | "production") {
  const exported = exportProject(project, { mode });
  const routes: { path: string; canonical: string; html: string }[] = [];
  for (const [path, content] of exported.files) {
    const canonical = canonicalPathForFile(path);
    if (canonical === null) continue;
    routes.push({ path, canonical, html: String(content) });
  }
  return routes;
}

const fixtures = {
  reference: referenceStore,
  catalogModern: catalogModernStore,
  catalogScale: catalogScaleStore,
} as const;

for (const [fixtureName, project] of Object.entries(fixtures)) {
  for (const mode of ["draft", "production"] as const) {
    test(`C1 paridad ${fixtureName} en ${mode}: todas las rutas coinciden preview/export`, () => {
      const routes = collectRouteFiles(project, mode);
      expect(routes.length).toBeGreaterThan(0);
      const mismatches: string[] = [];
      for (const route of routes) {
        const preview = renderPreviewHtml(project, mode, route.canonical, {
          assetTransport: "inline",
        });
        const previewBody = normalizeBodyForParity(preview);
        if (previewBody === null) {
          mismatches.push(`${route.path}: preview no renderiza`);
          continue;
        }
        const exportedBody = normalizeBodyForParity(route.html);
        if (exportedBody === null) {
          mismatches.push(`${route.path}: export sin body`);
          continue;
        }
        const moduleParity =
          JSON.stringify(moduleTreeOf(route.html)) === JSON.stringify(moduleTreeOf(preview));
        if (!moduleParity) {
          mismatches.push(`${route.path}: árbol de módulos distinto`);
        }
        if (exportedBody !== previewBody) {
          mismatches.push(`${route.path}: cuerpo normalizado distinto`);
        }
      }
      expect(mismatches, `Rutas sin paridad (${fixtureName}/${mode}):\n${mismatches.join("\n")}`).toEqual([]);
    });
  }
}
