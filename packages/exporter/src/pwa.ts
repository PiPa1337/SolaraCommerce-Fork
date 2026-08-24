/**
 * Archivos PWA y tecnicos adicionales para el sitio exportado.
 */

import type { StoreProjectV1 } from "@solara/project-schema";
import { escapeHtml } from "./html.js";
import { absoluteUrl, baseUrlPathname } from "./urls.js";

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function hashInput(value: string | Uint8Array): Uint8Array {
  return typeof value === "string" ? new TextEncoder().encode(value) : value;
}

export function sha256Bytes(value: string | Uint8Array): Uint8Array {
  const input = hashInput(value);
  const bitLength = input.length * 8;
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.length] = 0x80;
  const lengthView = new DataView(padded.buffer);
  lengthView.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  lengthView.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);
  const rotr = (value: number, amount: number): number =>
    (value >>> amount) | (value << (32 - amount));
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = lengthView.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 =
        rotr(words[index - 15] ?? 0, 7) ^
        rotr(words[index - 15] ?? 0, 18) ^
        ((words[index - 15] ?? 0) >>> 3);
      const s1 =
        rotr(words[index - 2] ?? 0, 17) ^
        rotr(words[index - 2] ?? 0, 19) ^
        ((words[index - 2] ?? 0) >>> 10);
      words[index] = ((words[index - 16] ?? 0) + s0 + (words[index - 7] ?? 0) + s1) >>> 0;
    }
    let a = state[0] ?? 0;
    let b = state[1] ?? 0;
    let c = state[2] ?? 0;
    let d = state[3] ?? 0;
    let e = state[4] ?? 0;
    let f = state[5] ?? 0;
    let g = state[6] ?? 0;
    let h = state[7] ?? 0;
    for (let index = 0; index < 64; index += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + choose + (SHA256_K[index] ?? 0) + (words[index] ?? 0)) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    state[0] = ((state[0] ?? 0) + a) >>> 0;
    state[1] = ((state[1] ?? 0) + b) >>> 0;
    state[2] = ((state[2] ?? 0) + c) >>> 0;
    state[3] = ((state[3] ?? 0) + d) >>> 0;
    state[4] = ((state[4] ?? 0) + e) >>> 0;
    state[5] = ((state[5] ?? 0) + f) >>> 0;
    state[6] = ((state[6] ?? 0) + g) >>> 0;
    state[7] = ((state[7] ?? 0) + h) >>> 0;
  }
  const digest = new Uint8Array(32);
  const digestView = new DataView(digest.buffer);
  for (let index = 0; index < state.length; index += 1) {
    digestView.setUint32(index * 4, state[index] ?? 0, false);
  }
  return digest;
}

export function sha256Hex(value: string | Uint8Array): string {
  return [...sha256Bytes(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function concatBytes(...parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

export function buildWebManifest(project: StoreProjectV1): string {
  const prefix = baseUrlPathname(project.baseUrl);
  const route = (path: string): string => `${prefix}${path}` || path;
  return JSON.stringify(
    {
      name: project.identity.brandName,
      short_name: project.identity.brandName,
      start_url: route("/"),
      display: "standalone",
      background_color: project.theme.colors.background,
      theme_color: project.theme.colors.background,
      lang: project.locale,
      icons: [
        { src: route("/icons/icon-192.png"), sizes: "192x192", type: "image/png" },
        { src: route("/icons/icon-512.png"), sizes: "512x512", type: "image/png" },
      ],
    },
    null,
    2,
  );
}

export interface ServiceWorkerOptions {
  runtimeCssPath?: string;
  runtimeJsPath?: string;
  /** Contenido real de cada entrada para invalidar el caché aunque conserve la URL. */
  precacheContent?: ReadonlyMap<string, string | Uint8Array>;
}

export function buildServiceWorker(
  project: StoreProjectV1,
  options: ServiceWorkerOptions = {},
): string {
  const prefix = baseUrlPathname(project.baseUrl);
  const route = (path: string): string => `${prefix}${path}` || path;
  const precacheUrls = [
    route("/"),
    route("/offline/index.html"),
    route("/manifest.webmanifest"),
    route(options.runtimeCssPath ?? "/assets/storefront.css"),
    route(options.runtimeJsPath ?? "/assets/storefront.js"),
  ];
  const precacheFingerprint = precacheUrls.map((url) => [
    url,
    options.precacheContent?.get(url) === undefined
      ? ""
      : sha256Hex(options.precacheContent.get(url) as string | Uint8Array),
  ]);
  const version = sha256Hex(JSON.stringify(precacheFingerprint)).slice(0, 16);
  const precacheJson = JSON.stringify(precacheUrls);
  const offlinePath = route("/offline/index.html");
  const assetsPrefix = route("/assets/");
  const lines = [
    `const CACHE_NAME = 'solara-${version}';`,
    `const PRECACHE_URLS = ${precacheJson};`,
    "self.addEventListener('install', (event) => {",
    "  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));",
    "  self.skipWaiting();",
    "});",
    "self.addEventListener('activate', (event) => {",
    "  event.waitUntil(",
    "    caches.keys().then((names) =>",
    "      Promise.all(names.filter((n) => n.startsWith('solara-') && n !== CACHE_NAME).map((n) => caches.delete(n)))",
    "    ).then(() => clients.claim())",
    "  );",
    "});",
    "self.addEventListener('fetch', (event) => {",
    "  if (event.request.method !== 'GET') return;",
    "  const url = new URL(event.request.url);",
    "  if (url.origin !== location.origin) return;",
    "  event.respondWith(",
    "    caches.open(CACHE_NAME).then((cache) => cache.match(event.request)).then((cached) => {",
    `      if (cached && url.pathname.startsWith('${assetsPrefix}')) return cached;`,
    "      return fetch(event.request).then((response) => {",
    "        if (response.ok) {",
    "          const clone = response.clone();",
    "          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));",
    "        }",
    "        return response;",
    "      }).catch(() => {",
    "        if (event.request.headers.get('accept')?.includes('text/html')) {",
    `          return caches.open(CACHE_NAME).then((cache) => cache.match('${offlinePath}'));`,
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
  return concatBytes(header, entry, png);
}

export function buildRssFeed(project: StoreProjectV1): string | undefined {
  const items = project.products
    .filter((p) => p.status === "active")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20)
    .map((p) => {
      const url = absoluteUrl(project, `/productos/${p.slug}/`);
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
  const hash = sha256Bytes(seed);
  const r = hash[0] ?? 0,
    g = hash[1] ?? 0,
    b = hash[2] ?? 0;
  const bytesPerRow = size * 3 + 1;
  const rawData = new Uint8Array(bytesPerRow * size);
  for (let y = 0; y < size; y++) {
    rawData[y * bytesPerRow] = 0;
    for (let x = 0; x < size; x++) {
      const offset = y * bytesPerRow + 1 + x * 3;
      rawData[offset] = r;
      rawData[offset + 1] = g;
      rawData[offset + 2] = b;
    }
  }
  const compressed = deflateStored(rawData);
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
  function chunk(type: string, data: Uint8Array): Uint8Array {
    const typeBytes = new TextEncoder().encode(type);
    const payload = concatBytes(typeBytes, data);
    const result = new Uint8Array(data.length + 12);
    const view = new DataView(result.buffer);
    view.setUint32(0, data.length, false);
    result.set(typeBytes, 4);
    result.set(data, 8);
    view.setUint32(data.length + 8, crc32(payload), false);
    return result;
  }
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, size, false);
  ihdrView.setUint32(4, size, false);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return concatBytes(
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", new Uint8Array()),
  );
}

/** Empaqueta bloques DEFLATE sin compresión dentro del contenedor zlib. */
function deflateStored(data: Uint8Array): Uint8Array {
  const blockCount = Math.max(1, Math.ceil(data.length / 65535));
  const result = new Uint8Array(2 + blockCount * 5 + data.length + 4);
  result[0] = 0x78;
  result[1] = 0x01;
  let offset = 2;
  let sourceOffset = 0;
  for (let block = 0; block < blockCount; block += 1) {
    const length = Math.min(65535, data.length - sourceOffset);
    result[offset] = block === blockCount - 1 ? 1 : 0;
    result[offset + 1] = length & 0xff;
    result[offset + 2] = length >>> 8;
    const inverse = ~length & 0xffff;
    result[offset + 3] = inverse & 0xff;
    result[offset + 4] = inverse >>> 8;
    result.set(data.subarray(sourceOffset, sourceOffset + length), offset + 5);
    offset += 5 + length;
    sourceOffset += length;
  }
  let adlerA = 1;
  let adlerB = 0;
  for (const byte of data) {
    adlerA = (adlerA + byte) % 65521;
    adlerB = (adlerB + adlerA) % 65521;
  }
  new DataView(result.buffer).setUint32(offset, (adlerB << 16) | adlerA, false);
  return result;
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
  return `${lines.join("\n")}\n`;
}
