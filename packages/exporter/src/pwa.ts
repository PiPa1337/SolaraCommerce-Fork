/**
 * Archivos PWA y tecnicos adicionales para el sitio exportado.
 */
import type { StoreProjectV1 } from "@solara/project-schema";
import { imageUrl } from "./assets.js";
import { escapeHtml } from "./html.js";
import { absoluteUrl } from "./urls.js";

export function buildWebManifest(project: StoreProjectV1): string {
  const iconUrl = project.seo.faviconAssetId
    ? imageUrl(project, project.seo.faviconAssetId)
    : undefined;
  return JSON.stringify(
    {
      name: project.identity.brandName,
      short_name: project.identity.brandName,
      start_url: "/",
      display: "standalone",
      background_color: project.theme.colors.background,
      theme_color: project.theme.colors.background,
      lang: project.locale,
      icons: iconUrl ? [{ src: iconUrl, sizes: "192x192 512x512", type: "image/png" }] : [],
    },
    null,
    2,
  );
}

export function buildServiceWorker(): string {
  const lines = [
    "const CACHE_NAME = 'solara-v1';",
    "self.addEventListener('install', (event) => { self.skipWaiting(); });",
    "self.addEventListener('activate', (event) => { event.waitUntil(clients.claim()); });",
    "self.addEventListener('fetch', (event) => {",
    "  if (event.request.method !== 'GET') return;",
    "  const url = new URL(event.request.url);",
    "  if (url.origin !== location.origin) return;",
    "  event.respondWith(",
    "    caches.match(event.request).then((cached) => {",
    "      if (cached && url.pathname.startsWith('/assets/')) return cached;",
    "      return fetch(event.request).then((response) => {",
    "        if (response.ok) {",
    "          const clone = response.clone();",
    "          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));",
    "        }",
    "        return response;",
    "      }).catch(() => cached || caches.match('/'));",
    "    })",
    "  );",
    "});",
  ];
  return lines.join(String.fromCharCode(10));
}

export function buildRssFeed(project: StoreProjectV1): string | undefined {
  const items = project.products
    .filter((p) => p.status === "active")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20)
    .map((p) => {
      const url = absoluteUrl(project, "/productos/" + p.slug + "/");
      const desc = escapeHtml(p.description.slice(0, 300));
      const title = escapeHtml(p.title);
      const date = new Date(p.createdAt).toUTCString();
      return (
        "<item><title>" +
        title +
        "</title><link>" +
        url +
        "</link><guid>" +
        url +
        "</guid><pubDate>" +
        date +
        "</pubDate><description>" +
        desc +
        "</description></item>"
      );
    })
    .join("");
  if (!items) return undefined;
  const brandName = escapeHtml(project.identity.brandName);
  const homeUrl = absoluteUrl(project, "/");
  const seoDesc = escapeHtml(project.seo.description);
  return (
    '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>' +
    brandName +
    "</title><link>" +
    homeUrl +
    "</link><description>" +
    seoDesc +
    "</description>" +
    items +
    "</channel></rss>"
  );
}
