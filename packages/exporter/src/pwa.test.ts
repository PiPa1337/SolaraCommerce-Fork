import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { describe, expect, it } from "vitest";
import { exportProject } from "./index";
import { buildServiceWorker } from "./pwa";

function extractRuntimeCacheable(sw: string): RegExp {
  const source = /const RUNTIME_CACHEABLE = new RegExp\('(.*)'\);/.exec(sw)?.[1];
  if (!source) throw new Error("Falta RUNTIME_CACHEABLE en el service worker generado");
  return new RegExp(source);
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
    const homeCssHref = /<link rel="stylesheet" href="([^"]+)"/.exec(home)?.[1];
    if (!homeCssHref) throw new Error("La home no enlaza una hoja de estilos");
    const sw = String(result.files.get("sw.js"));
    const precacheMatch = /const PRECACHE_URLS = (\[[^\]]*\]);/.exec(sw);
    if (!precacheMatch) throw new Error("Falta PRECACHE_URLS en el service worker generado");
    const precacheUrls = JSON.parse(precacheMatch[1] as string) as string[];
    expect(precacheUrls).toContain(homeCssHref);
    expect(result.files.has(homeCssHref.slice(1))).toBe(true);
  });
});
