import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { referenceStore } from "@solara/project-schema/fixture";
import { describe, expect, it } from "vitest";
import { exportProject } from "./index";
import { buildServiceWorker } from "./pwa";

function extractRuntimeCacheable(sw: string): RegExp {
  const source = /const RUNTIME_CACHEABLE = new RegExp\('(.*)'\);/.exec(sw)?.[1];
  if (!source) throw new Error("Falta RUNTIME_CACHEABLE en el service worker generado");
  return new RegExp(source);
}

function extractPrecacheUrls(sw: string): string[] {
  const match = /const PRECACHE_URLS = (\[[^\]]*\]);/.exec(sw);
  if (!match) throw new Error("Falta PRECACHE_URLS en el service worker generado");
  return JSON.parse(match[1] as string) as string[];
}

function stylesheetHrefs(html: string): string[] {
  return [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(
    (match) => match[1] as string,
  );
}

describe("service worker", () => {
  it("deriva el CACHE_NAME del revision del deployment-manifest cuando viene", () => {
    const sw = buildServiceWorker(catalogModernStore, { revision: "73bceb2667d42713" });
    expect(sw).toContain("const CACHE_NAME = 'solara-73bceb2667d42713-");
  });

  it("mantiene el formato solara-<hash16> cuando no hay revision", () => {
    const sw = buildServiceWorker(catalogModernStore);
    expect(sw).toMatch(/const CACHE_NAME = 'solara-[0-9a-f]{16}';/);
  });

  it("acota el runtime cache a la allowlist de assets, índices y offline", () => {
    const sw = buildServiceWorker(catalogModernStore);
    expect(sw).toContain("const RUNTIME_CACHEABLE = new RegExp(");
    expect(sw).toContain("RUNTIME_CACHEABLE.test(pathname)");
    const guardIndex = sw.indexOf("RUNTIME_CACHEABLE.test(pathname)");
    const putIndex = sw.indexOf("cache.put(event.request, clone)");
    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(putIndex).toBeGreaterThan(guardIndex);
    expect(sw).not.toContain("if (response.ok) {");
    const runtimeCacheable = extractRuntimeCacheable(sw);
    expect(runtimeCacheable.test("/assets/storefront.abc123.css")).toBe(true);
    expect(runtimeCacheable.test("/assets/storefront.def456.js")).toBe(true);
    expect(runtimeCacheable.test("/assets/copy.0123abcd.json")).toBe(true);
    expect(runtimeCacheable.test("/search-index.json")).toBe(true);
    expect(runtimeCacheable.test("/catalog-index.json")).toBe(true);
    expect(runtimeCacheable.test("/offline/")).toBe(true);
    expect(runtimeCacheable.test("/offline/index.html")).toBe(true);
    expect(runtimeCacheable.test("/index.html")).toBe(false);
    expect(runtimeCacheable.test("/productos/manta-bruma/")).toBe(false);
    expect(runtimeCacheable.test("/ai-context.json")).toBe(false);
    expect(runtimeCacheable.test("/llms.txt")).toBe(false);
    expect(runtimeCacheable.test("/feed.xml")).toBe(false);
    expect(runtimeCacheable.test("/sitemap.xml")).toBe(false);
    expect(runtimeCacheable.test("/google-merchant.xml")).toBe(false);
  });

  it("respeta la subcarpeta de baseUrl en la allowlist del runtime cache", () => {
    const project = { ...catalogModernStore, baseUrl: "https://example.test/tienda/" };
    const sw = buildServiceWorker(project);
    const runtimeCacheable = extractRuntimeCacheable(sw);
    expect(runtimeCacheable.test("/tienda/assets/storefront.abc123.css")).toBe(true);
    expect(runtimeCacheable.test("/tienda/assets/copy.0123abcd.json")).toBe(true);
    expect(runtimeCacheable.test("/tienda/search-index.json")).toBe(true);
    expect(runtimeCacheable.test("/tienda/catalog-index.json")).toBe(true);
    expect(runtimeCacheable.test("/tienda/offline/index.html")).toBe(true);
    expect(runtimeCacheable.test("/assets/storefront.abc123.css")).toBe(false);
    expect(runtimeCacheable.test("/search-index.json")).toBe(false);
  });

  it("embebe el revision del deployment-manifest en el CACHE_NAME del sw exportado", () => {
    const result = exportProject(catalogModernStore, { mode: "production" });
    const manifest = JSON.parse(String(result.files.get("deployment-manifest.json"))) as {
      revision: string;
    };
    expect(manifest.revision).toMatch(/^[0-9a-f]{16}$/);
    const sw = String(result.files.get("sw.js"));
    expect(sw).toContain(`const CACHE_NAME = 'solara-${manifest.revision}-`);
  });

  it("precachea exactamente la CSS que enlaza la home (coherencia export↔precache)", () => {
    const result = exportProject(catalogModernStore, { mode: "production" });
    const home = String(result.files.get("index.html"));
    const homeHrefs = stylesheetHrefs(home);
    expect(homeHrefs.length).toBeGreaterThan(0);
    const sw = String(result.files.get("sw.js"));
    const precacheUrls = extractPrecacheUrls(sw);
    for (const href of homeHrefs) {
      expect(precacheUrls).toContain(href);
      expect(result.files.has(href.slice(1))).toBe(true);
    }
    expect(new Set(precacheUrls).size).toBe(precacheUrls.length);
    void new Function(sw);
  });

  it("precachea también la CSS de home cuando diverge de la CSS del resto del sitio", () => {
    const project = structuredClone(catalogModernStore);
    const aboutPage = project.pages.find((page) => page.kind === "about");
    if (!aboutPage) throw new Error("Fixture sin página nosotros");
    const trustSection = referenceStore.sections.find(
      (section) => section.moduleId === "trust-strip",
    );
    if (!trustSection) throw new Error("Fixture sin sección trust-strip");
    aboutPage.sections = [structuredClone(trustSection)];

    const result = exportProject(project, { mode: "production" });
    const cssPaths = [...result.files.keys()].filter((path) =>
      /^assets\/storefront[^/]*\.css$/.test(path),
    );
    expect(cssPaths).toHaveLength(2);

    const home = String(result.files.get("index.html"));
    const homeHrefs = stylesheetHrefs(home);
    expect(homeHrefs.length).toBeGreaterThan(0);
    const sw = String(result.files.get("sw.js"));
    const precacheUrls = extractPrecacheUrls(sw);

    for (const href of homeHrefs) {
      expect(precacheUrls).toContain(href);
      expect(result.files.has(href.slice(1))).toBe(true);
    }
    for (const path of cssPaths) {
      expect(precacheUrls).toContain(`/${path}`);
    }
    expect(new Set(precacheUrls).size).toBe(precacheUrls.length);
    void new Function(sw);
  });
});
