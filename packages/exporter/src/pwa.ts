/**
 * Archivos PWA y tecnicos adicionales para el sitio exportado.
 */

import { createHash } from "node:crypto";
import type { StoreProjectV1 } from "@solara/project-schema";
import { imageUrl } from "./assets.js";
import { escapeHtml } from "./html.js";
import { absoluteUrl } from "./urls.js";

export function buildWebManifest(project: StoreProjectV1): string {
  return JSON.stringify(
    {
      name: project.identity.brandName,
      short_name: project.identity.brandName,
      start_url: "/",
      display: "standalone",
      background_color: project.theme.colors.background,
      theme_color: project.theme.colors.background,
      lang: project.locale,
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    null,
    2,
  );
}

export function buildServiceWorker(project: StoreProjectV1): string {
  const version = createHash("sha256").update(project.updatedAt).digest("hex").slice(0, 12);
  const lines = [
    `const CACHE_NAME = 'solara-${version}';`,
    "const PRECACHE_URLS = ['/', '/offline/index.html', '/manifest.webmanifest', '/assets/storefront.css', '/assets/storefront.js'];",
    "self.addEventListener('install', (event) => {",
    "  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));",
    "  self.skipWaiting();",
    "});",
    "self.addEventListener('activate', (event) => {",
    "  event.waitUntil(",
    "    caches.keys().then((names) =>",
    "      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))",
    "    ).then(() => clients.claim())",
    "  );",
    "});",
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
    "      }).catch(() => {",
    "        if (event.request.headers.get('accept')?.includes('text/html')) {",
    "          return caches.match('/offline/index.html');",
    "        }",
    "        return cached || Response.error();",
    "      });",
    "    })",
    "  );",
    "});",
  ];
  return lines.join(String.fromCharCode(10));
}

/**
 * Genera un archivo .ico binario valido que embebe un PNG de 64x64.
 * El formato ICO soporta PNG embebido desde Windows Vista.
 */
export function buildFaviconIco(seed: string): Uint8Array {
  const png = generateIconPng(seed, 64);
  const header = new Uint8Array(6);
  const view = new DataView(header.buffer);
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, 1, true); // count: 1 image
  const entry = new Uint8Array(16);
  const entryView = new DataView(entry.buffer);
  entry[0] = 64; // width 64
  entry[1] = 64; // height 64
  entry[2] = 0; // palette
  entry[3] = 0; // reserved
  entryView.setUint16(4, 1, true); // color planes
  entryView.setUint16(6, 32, true); // bits per pixel
  entryView.setUint32(8, png.byteLength, true); // data size
  entryView.setUint32(12, 22, true); // data offset (6 + 16)
  return new Uint8Array(Buffer.concat([header, entry, Buffer.from(png)]));
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
  const language = escapeHtml(project.locale);
  const lastBuild = new Date(project.updatedAt).toUTCString();
  return (
    '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>' +
    brandName +
    "</title><link>" +
    homeUrl +
    "</link><description>" +
    seoDesc +
    "</description>" +
    "<language>" +
    language +
    "</language><lastBuildDate>" +
    lastBuild +
    "</lastBuildDate>" +
    items +
    "</channel></rss>"
  );
}

/**
 * Genera un PNG solido deterministico a partir del nombre de la tienda.
 */
export function generateIconPng(seed: string, size: number): Uint8Array {
  const hash = createHash("sha256").update(seed).digest();
  const r = hash[0] ?? 0,
    g = hash[1] ?? 0,
    b = hash[2] ?? 0;
  const { deflateSync } = require("node:zlib") as typeof import("node:zlib");
  const bytesPerRow = size * 3 + 1;
  const rawData = Buffer.alloc(bytesPerRow * size);
  for (let y = 0; y < size; y++) {
    rawData[y * bytesPerRow] = 0;
    for (let x = 0; x < size; x++) {
      const offset = y * bytesPerRow + 1 + x * 3;
      rawData[offset] = r;
      rawData[offset + 1] = g;
      rawData[offset + 2] = b;
    }
  }
  const compressed = deflateSync(rawData);
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c;
  }
  function crc32(buf: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of buf) {
      const entry = crcTable[(crc ^ byte) & 0xff];
      if (entry !== undefined) crc = entry ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", compressed),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

/**
 * Pagina HTML que el service worker sirve cuando no hay conexion.
 */
export function buildOfflinePage(project: StoreProjectV1): string {
  const brandName = escapeHtml(project.identity.brandName);
  const homeUrl = absoluteUrl(project, "/");
  return (
    "<!doctype html>" +
    "<html lang=" +
    JSON.stringify(project.locale) +
    ">" +
    "<head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>" +
    "<title>Sin conexi\u00f3n | " +
    brandName +
    "</title>" +
    "<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:" +
    project.theme.colors.background +
    ";color:" +
    project.theme.colors.text +
    ";text-align:center;padding:2rem}a{color:inherit}</style></head>" +
    "<body><div><h1>Sin conexi\u00f3n</h1><p>No se pudo cargar la p\u00e1gina. Verific\u00e1 tu conexi\u00f3n e intent\u00e1 de nuevo.</p><p><a href=" +
    JSON.stringify(homeUrl) +
    ">Volver al inicio</a></p></div></body></html>"
  );
}
/**
 * Version extendida de llms.txt con precio, stock y categoria por producto.
 * Parte del modulo PWA/SEO del exporter.
 */

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function buildLlmsFullTxt(project: StoreProjectV1): string {
  const lines: string[] = [];
  lines.push(`# ${project.identity.brandName} (version completa)`);
  lines.push("");
  lines.push(clean(project.identity.description));
  lines.push("");
  lines.push(`Moneda: ${project.currency}.`);
  lines.push("");
  lines.push("## Productos");
  for (const product of project.products) {
    if (product.status !== "active") continue;
    const price = product.variants[0]?.price ?? 0;
    const hasStock = product.variants.some((v) => v.stockStatus === "in_stock");
    const categoryName =
      project.categories.find((c) => c.id === product.categoryIds[0])?.title ?? "general";
    lines.push(`### ${clean(product.title)}`);
    lines.push(`- URL: ${project.baseUrl}/productos/${product.slug}/`);
    lines.push(`- Precio: ${(price / 100).toFixed(2)} ${project.currency}`);
    lines.push(`- Disponibilidad: ${hasStock ? "disponible" : "consultar"}`);
    lines.push(`- Categoria: ${categoryName}`);
    lines.push(`- Descripcion: ${clean(product.description)}`);
    lines.push("");
  }
  lines.push("## Politicas");
  lines.push(`Envios: ${clean(project.policies.shipping.details)}`);
  lines.push(`Cambios: ${clean(project.policies.returns.details)}`);
  return lines.join("\n") + "\n";
}
