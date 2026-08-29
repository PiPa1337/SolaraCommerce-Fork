/**
 * Carga tiendas reales del disco portable y sirve su export production en
 * memoria. Compartido por los barridos visuales de diagnóstico manual.
 */

import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { exportProject } from "@solara/exporter";
import { StoreProjectV2Schema } from "@solara/project-schema";

export const PROJECTS_ROOT = ".release/portable/SolaraCommerce-Portable/proyectos";

export const REAL_STORES = [
  { label: "predeterminada", dir: "demo-catalogo-jerarquico--ecb19169" },
  { label: "rm-descartables", dir: "rm-descartables--704e2877" },
] as const;

export const SWEEP_VIEWPORTS = [
  { name: "320", width: 320, height: 800 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 900 },
] as const;

export interface LoadedStore {
  label: string;
  files: Map<string, Uint8Array>;
  routes: { name: string; path: string }[];
}

export function loadStore(label: string, dir: string): LoadedStore {
  const projectDir = join(PROJECTS_ROOT, dir);
  const manifest = JSON.parse(readFileSync(join(projectDir, "manifest.json"), "utf8"));
  const envelope = JSON.parse(readFileSync(join(projectDir, manifest.current.projectPath), "utf8"));
  const project = StoreProjectV2Schema.parse(envelope.project ?? envelope);
  const exported = exportProject(project, { mode: "production" });
  const files = exported.files;

  const sub = (prefix: string): string | undefined => {
    for (const key of Array.from(files.keys()).sort()) {
      const match = /^([^/]+)\/(.+)\/index\.html$/.exec(key);
      if (match && match[1] === prefix) return `/${prefix}/${match[2]}/`;
    }
    return undefined;
  };
  const routes: { name: string; path: string }[] = [{ name: "home", path: "/" }];
  const categoria = sub("categorias");
  if (categoria) routes.push({ name: "categoria", path: categoria });
  const coleccion = sub("colecciones");
  if (coleccion) routes.push({ name: "coleccion", path: coleccion });
  const producto = sub("productos");
  if (producto) routes.push({ name: "producto", path: producto });
  for (const [name, path] of [
    ["busqueda", "/buscar/?q=a"],
    ["carrito-vacio", "/carrito/"],
    ["checkout-vacio", "/checkout/"],
    ["contacto", "/contacto/"],
    ["nosotros", "/nosotros/"],
    ["privacidad", "/privacidad/"],
    ["terminos", "/terminos/"],
    ["404", "/ruta-inexistente-de-vision/"],
  ] as const) {
    const key = path.split("?")[0].replace(/^\/+/, "");
    if (files.has(`${key}index.html`) || name === "404") routes.push({ name, path });
  }
  return { label, files, routes };
}

export function serve(files: Map<string, Uint8Array>): Promise<{ url: string; server: Server }> {
  const types: Record<string, string> = {
    avif: "image/avif",
    css: "text/css; charset=utf-8",
    gif: "image/gif",
    ico: "image/x-icon",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    js: "text/javascript; charset=utf-8",
    png: "image/png",
    svg: "image/svg+xml",
    webp: "image/webp",
  };
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const path =
      requested === ""
        ? "index.html"
        : requested.endsWith("/")
          ? `${requested}index.html`
          : requested;
    const file = files.get(path);
    if (file === undefined) {
      response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      response.end(files.get("404.html") ?? "<h1>Not found</h1>");
      return;
    }
    const extension = path.split(".").pop() ?? "";
    response.writeHead(200, {
      "Content-Type":
        types[extension] ??
        (path.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream"),
      "Cache-Control": "no-store",
    });
    response.end(file);
  });
  return new Promise((resolveListen) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("sin puerto");
      resolveListen({ url: `http://127.0.0.1:${address.port}`, server });
    });
  });
}

export async function revealPage(page: import("@playwright/test").Page): Promise<void> {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 640) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
    await page.waitForTimeout(45);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(300);
}
