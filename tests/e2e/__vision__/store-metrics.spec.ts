/**
 * Sonda métrica DOM sobre las tiendas reales exportadas: mide overflow
 * horizontal, mailtos cortados, títulos recortados, radios de buscador y
 * paginación, interlineado de hero, imágenes upscaladas y secciones sin
 * revelar. Diagnóstico manual, escribe _qa/vision-stores-<fecha>/metrics.json.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";
import {
  type LoadedStore,
  loadStore,
  REAL_STORES,
  revealPage,
  SWEEP_VIEWPORTS,
  serve,
} from "./real-store-loader";

const DPR = Number(process.env.SOLARA_VISION_DPR ?? 1);
const OUT = join(
  "_qa",
  "vision-stores-2026-08-29",
  DPR > 1 ? `metrics-dpr${DPR}.json` : "metrics.json",
);

interface RouteMetrics {
  overflowX: number;
  mailtoCortados: string[];
  titulosRecortados: string[];
  radioBuscador: { borderRadius: string; themeRadius: string } | null;
  radiosPaginacion: string[];
  heroLineHeight: string | null;
  imgsUpscaladas: string[];
  srcSeleccionados: string[];
  seccionesSinRevelar: number;
}

const metrics: Record<string, Record<string, Record<string, RouteMetrics>>> = {};

function inPageProbe(): RouteMetrics {
  const dpr = window.devicePixelRatio || 1;
  const mailtoCortados: string[] = [];
  for (const a of Array.from(document.querySelectorAll('a[href^="mailto:"]'))) {
    const range = document.createRange();
    range.selectNodeContents(a);
    if (range.getClientRects().length > 1) mailtoCortados.push(a.textContent?.trim() ?? "mailto");
  }
  const titulosRecortados: string[] = [];
  for (const e of Array.from(document.querySelectorAll("h1,h2,h3"))) {
    const clippedH = e.scrollHeight > e.clientHeight + 1;
    const clippedW = e.scrollWidth > e.clientWidth + 1;
    if (clippedH || clippedW)
      titulosRecortados.push(`${e.tagName}:${(e.textContent ?? "").trim().slice(0, 40)}`);
  }
  const searchInput = document.querySelector(
    '.catalog-search input, [data-solara-search] input, form[action*="buscar"] input[type="search"], form[action*="buscar"] input[type="text"], input[name="q"]',
  );
  const themeRadius = getComputedStyle(document.documentElement)
    .getPropertyValue("--solara-radius")
    .trim();
  const radioBuscador = searchInput
    ? { borderRadius: getComputedStyle(searchInput).borderRadius, themeRadius }
    : null;
  const pag = Array.from(
    document.querySelectorAll(
      '.catalog-pagination a, .catalog-pagination button, [data-pagination] a, nav[aria-label*="agi" i] a, nav[aria-label*="agi" i] button',
    ),
  );
  const radiosPaginacion = Array.from(new Set(pag.map((e) => getComputedStyle(e).borderRadius)));
  const h1 = document.querySelector("main h1, header h1, h1");
  const heroLineHeight = h1
    ? `${getComputedStyle(h1).lineHeight} / fs ${getComputedStyle(h1).fontSize} / lh-razon ${(parseFloat(getComputedStyle(h1).lineHeight) / parseFloat(getComputedStyle(h1).fontSize)).toFixed(2)}`
    : null;
  const imgsUpscaladas: string[] = [];
  const srcSeleccionados: string[] = [];
  for (const i of Array.from(document.images)) {
    const w = i.getBoundingClientRect().width;
    if (i.currentSrc) srcSeleccionados.push(new URL(i.currentSrc).pathname);
    if (!i.complete || i.naturalWidth <= 0 || w <= 0) continue;
    // Chrome reporta naturalWidth según el decode (hint de sizes), no el
    // intrínseco. Usar el descriptor real del recurso seleccionado.
    let disponible = Number.parseInt(i.getAttribute("width") ?? "0", 10) || 0;
    const candidatos: string[] = [];
    if (i.srcset) candidatos.push(i.srcset);
    const parent = i.closest("picture");
    if (parent) {
      for (const s of Array.from(parent.querySelectorAll("source"))) {
        if (s.srcset) candidatos.push(s.srcset);
      }
    }
    for (const set of candidatos) {
      for (const entry of set.split(",")) {
        const [u, d] = entry.trim().split(/\s+/);
        if (!u || !d || !/^(\d+)w$/.test(d)) continue;
        const base = new URL(u, document.baseURI).pathname;
        if (i.currentSrc && base === new URL(i.currentSrc).pathname) {
          disponible = Math.max(disponible, Number.parseInt(d, 10));
        }
      }
    }
    const necesario = w * dpr;
    if (disponible > 0 && disponible < necesario * 0.9) {
      imgsUpscaladas.push(
        `${new URL(i.currentSrc || i.src).pathname} disp ${disponible}px vs ${Math.round(necesario)}px req (css ${Math.round(w)} dpr ${dpr}) alt="${(i.getAttribute("alt") ?? "").slice(0, 40)}"`,
      );
    }
  }
  const seccionesSinRevelar = Array.from(document.querySelectorAll("section")).filter(
    (s) => parseFloat(getComputedStyle(s).opacity) < 0.9 && s.offsetHeight > 200,
  ).length;
  return {
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    mailtoCortados,
    titulosRecortados,
    radioBuscador,
    radiosPaginacion,
    heroLineHeight,
    imgsUpscaladas,
    srcSeleccionados: Array.from(new Set(srcSeleccionados)),
    seccionesSinRevelar,
  };
}

test.use({ trace: "off" });

for (const store of REAL_STORES) {
  test.describe(`métricas ${store.label}`, () => {
    let loaded: LoadedStore;
    let url = "";
    let server: import("node:http").Server;

    test.beforeAll(async () => {
      test.setTimeout(420_000);
      loaded = loadStore(store.label, store.dir);
      const served = await serve(loaded.files);
      url = served.url;
      server = served.server;
    });

    test.afterAll(() => {
      server?.close();
      mkdirSync(join("_qa", "vision-stores-2026-08-29"), { recursive: true });
      writeFileSync(OUT, JSON.stringify(metrics, null, 2));
    });

    for (const viewport of SWEEP_VIEWPORTS) {
      test(`${viewport.name}px`, async ({ browser }) => {
        test.info().setTimeout(240_000);
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: DPR,
        });
        const page = await context.newPage();
        metrics[store.label] ??= {};
        metrics[store.label][viewport.name] = {};
        for (const route of loaded.routes) {
          await page.goto(new URL(route.path, url).toString());
          await revealPage(page);
          metrics[store.label][viewport.name][route.name] = await page.evaluate(inPageProbe);
        }
        await context.close();
      });
    }
  });
}
