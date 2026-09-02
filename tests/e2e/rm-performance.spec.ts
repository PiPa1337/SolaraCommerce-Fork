import { createServer, type Server } from "node:http";
import { performance } from "node:perf_hooks";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { type ExportResult, exportProject } from "../../packages/exporter/src/index";
import {
  type PerformanceOperation,
  type PerformanceReport,
  warmSummary,
  writePerformanceReport,
} from "../../scripts/rm-performance-report";
import { loadRmSnapshot, type RmSourceSnapshot } from "../../scripts/rm-performance-source";
import { type ReadOnlyManagedProject, startStudioServer, stopStudioServer } from "./studio-server";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const;
const ROUTES = [
  ["home", "/"],
  ["category", ""],
  ["product", ""],
  ["search", "/buscar/?q=a"],
  ["cart", "/carrito/"],
  ["checkout", "/checkout/"],
  ["contact", "/contacto/"],
] as const;
function positiveIntegerEnv(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

const COLD_CONTEXTS = positiveIntegerEnv("SOLARA_PERF_BROWSER_COLD_CONTEXTS", 3);
const WARM_RELOADS = positiveIntegerEnv("SOLARA_PERF_BROWSER_WARM_RELOADS", 3);
const IDLE_SAMPLE_MS = 2_000;
const STUDIO_TABS = [
  ["Preparar", "Preparar"],
  ["Resumen", "Resumen"],
  ["Catálogo", "Catálogo"],
  ["Constructor", "Constructor"],
  ["Tema de la tienda", "Tema de la tienda"],
  ["Recursos", "Recursos"],
  ["SEO", "SEO"],
  ["Exportar", "Exportar"],
] as const;

interface BrowserProbe {
  lcp: number | null;
  fcp: number | null;
  cls: number;
  longTaskMs: number[];
  firstInteraction: number | null;
}

interface BrowserMetrics {
  elapsedMs: number;
  navigation: {
    responseStart: number;
    domContentLoaded: number;
    loadEvent: number;
    domInteractive: number;
  };
  probe: BrowserProbe;
  cdp: {
    taskDurationMs: number;
    scriptDurationMs: number;
    layoutDurationMs: number;
    heapUsed: number;
    heapTotal: number;
  };
  requests: {
    count: number;
    transferBytes: number;
    responseBytes: number;
    duplicateUrls: number;
    imageBytes: number;
    catalogIndexRequests: number;
  };
  images: {
    count: number;
    lazy: number;
    srcset: number;
    selected: number;
    criticalBytes: number;
  };
  bodyTextLength: number;
}

interface RequestRecord {
  url: string;
  resourceType: string;
  transferBytes: number;
  responseBytes: number;
}

interface RequestTracker {
  take(): Promise<BrowserMetrics["requests"]>;
}

declare global {
  interface Window {
    __rmPerformanceProbe?: { read: () => BrowserProbe };
    __rmSetHidden?: (hidden: boolean) => void;
  }
}

let snapshot: RmSourceSnapshot;
let studioServer: Server;
let studioWriteAttempts: Array<{ method: string; path: string }> = [];
let studioUrl = "";
let storefrontServer: Server;
let storefrontUrl = "";
let exported: ExportResult;
let studioReport: PerformanceReport;
let storefrontReport: PerformanceReport;

function projectRoute(slug: string | undefined, prefix: string): string {
  return slug ? `/${prefix}/${slug}/` : `/${prefix}/`;
}

function routeList(): Array<[string, string]> {
  const category = projectRoute(snapshot.project.categories[0]?.slug, "categorias");
  const product = projectRoute(snapshot.project.products[0]?.slug, "productos");
  return ROUTES.map(([name, path]) => {
    if (name === "category") return [name, category];
    if (name === "product") return [name, product];
    return [name, path];
  });
}

function installPerformanceProbe(page: Page): Promise<void> {
  return page.addInitScript(() => {
    const longTaskMs: number[] = [];
    let cls = 0;
    let firstInteraction: number | null = null;
    const observe = (type: string, callback: (entry: PerformanceEntry) => void): void => {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) callback(entry);
        });
        observer.observe({ type, buffered: true });
      } catch {
        // El browser puede no soportar un tipo de PerformanceObserver.
      }
    };
    observe("longtask", (entry) => longTaskMs.push(entry.duration));
    observe("layout-shift", (entry) => {
      const value = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
      if (!value.hadRecentInput) cls += value.value ?? 0;
    });
    document.addEventListener(
      "pointerdown",
      () => {
        firstInteraction ??= performance.now();
      },
      { once: true, capture: true },
    );
    window.__rmPerformanceProbe = {
      read: () => {
        const paints = window.performance.getEntriesByType("paint");
        const fcp =
          paints.find((entry) => entry.name === "first-contentful-paint")?.startTime ?? null;
        const lcp =
          window.performance.getEntriesByType("largest-contentful-paint").at(-1)?.startTime ?? null;
        return { lcp, fcp, cls, longTaskMs: [...longTaskMs], firstInteraction };
      },
    };
    let hidden = false;
    try {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => (hidden ? "hidden" : "visible"),
      });
      window.__rmSetHidden = (value: boolean) => {
        if (hidden === value) return;
        hidden = value;
        document.dispatchEvent(new Event("visibilitychange"));
      };
    } catch {
      // Sólo se pierde la emulación de visibilidad; el resto del probe sigue activo.
    }
  });
}

function createRequestTracker(page: Page): RequestTracker {
  const records: RequestRecord[] = [];
  const pendingSizes: Array<Promise<void>> = [];
  const onRequest = (request: import("@playwright/test").Request): void => {
    if (request.url().startsWith("data:")) return;
    const record: RequestRecord = {
      url: request.url(),
      resourceType: request.resourceType(),
      transferBytes: 0,
      responseBytes: 0,
    };
    records.push(record);
    const pending = request
      .sizes()
      .then((sizes) => {
        record.transferBytes =
          sizes.requestHeadersSize +
          sizes.requestBodySize +
          sizes.responseHeadersSize +
          sizes.responseBodySize;
        record.responseBytes = sizes.responseBodySize;
      })
      .catch(() => undefined);
    pendingSizes.push(pending);
  };
  page.on("request", onRequest);
  return {
    async take() {
      await Promise.all(pendingSizes.splice(0));
      const byUrl = new Map<string, number>();
      for (const record of records) byUrl.set(record.url, (byUrl.get(record.url) ?? 0) + 1);
      const duplicateUrls = [...byUrl.values()].filter((count) => count > 1).length;
      const result = {
        count: records.length,
        transferBytes: records.reduce((total, record) => total + record.transferBytes, 0),
        responseBytes: records.reduce((total, record) => total + record.responseBytes, 0),
        duplicateUrls,
        imageBytes: records
          .filter((record) => record.resourceType === "image")
          .reduce((total, record) => total + record.responseBytes, 0),
        catalogIndexRequests: records.filter((record) => record.url.includes("catalog-index.json"))
          .length,
      };
      records.splice(0);
      return result;
    },
  };
}

async function cdpSnapshot(page: Page): Promise<BrowserMetrics["cdp"]> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const metrics = (await cdp.send("Performance.getMetrics")).metrics as Array<{
    name: string;
    value: number;
  }>;
  const heap = (await cdp
    .send("Runtime.getHeapUsage")
    .catch(() => ({ usedSize: 0, totalSize: 0 }))) as {
    usedSize: number;
    totalSize: number;
  };
  const get = (name: string): number =>
    (metrics.find((metric) => metric.name === name)?.value ?? 0) * 1000;
  return {
    taskDurationMs: get("TaskDuration"),
    scriptDurationMs: get("ScriptDuration"),
    layoutDurationMs: get("LayoutDuration"),
    heapUsed: heap.usedSize,
    heapTotal: heap.totalSize,
  };
}

async function pageImages(page: Page): Promise<BrowserMetrics["images"]> {
  return page.evaluate(() => {
    const images = [...document.images];
    const criticalNames = new Set(
      images
        .filter((image) => image.loading !== "lazy")
        .filter((image) => image.getBoundingClientRect().top < window.innerHeight)
        .map((image) => image.currentSrc)
        .filter(Boolean),
    );
    const criticalBytes = window.performance
      .getEntriesByType("resource")
      .filter((entry) => criticalNames.has(entry.name) && entry.name !== window.location.href)
      .reduce(
        (total, entry) => total + ((entry as PerformanceResourceTiming).transferSize || 0),
        0,
      );
    return {
      count: images.length,
      lazy: images.filter((image) => image.loading === "lazy").length,
      srcset: images.filter((image) => image.hasAttribute("srcset")).length,
      selected: images.filter((image) => Boolean(image.currentSrc)).length,
      criticalBytes,
    };
  });
}

async function browserMetrics(
  page: Page,
  started: number,
  tracker: RequestTracker,
): Promise<BrowserMetrics> {
  const [navigation, probe, cdp, requests, images, bodyTextLength] = await Promise.all([
    page.evaluate(() => {
      const entry = window.performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      return {
        responseStart: entry?.responseStart ?? 0,
        domContentLoaded: entry?.domContentLoadedEventEnd ?? 0,
        loadEvent: entry?.loadEventEnd ?? 0,
        domInteractive: entry?.domInteractive ?? 0,
      };
    }),
    page.evaluate(
      () =>
        window.__rmPerformanceProbe?.read() ?? {
          lcp: null,
          fcp: null,
          cls: 0,
          longTaskMs: [],
          firstInteraction: null,
        },
    ),
    cdpSnapshot(page),
    tracker.take(),
    pageImages(page),
    page
      .locator("body")
      .textContent()
      .then((value) => value?.length ?? 0),
  ]);
  return {
    elapsedMs: performance.now() - started,
    navigation,
    probe,
    cdp,
    requests,
    images,
    bodyTextLength,
  };
}

function addSample(
  report: PerformanceReport,
  label: string,
  elapsedMs: number,
  phase: "cold" | "warm",
  meta: Record<string, boolean | number | string | null> = {},
): void {
  const operation: PerformanceOperation = report.operations[label] ?? {};
  report.operations[label] = operation;
  const samples = phase === "cold" ? (operation.coldMs ?? []) : (operation.warmMs?.samples ?? []);
  samples.push(Math.round(elapsedMs * 1000) / 1000);
  if (phase === "cold") operation.coldMs = samples;
  else operation.warmMs = warmSummary(samples);
  operation.meta = { ...(operation.meta ?? {}), ...meta };
}

function addMetric(
  report: PerformanceReport,
  label: string,
  metric: BrowserMetrics,
  phase: "cold" | "warm",
): void {
  addSample(report, label, metric.elapsedMs, phase, {
    fcpMs: metric.probe.fcp === null ? null : Math.round(metric.probe.fcp * 1000) / 1000,
    lcpMs: metric.probe.lcp === null ? null : Math.round(metric.probe.lcp * 1000) / 1000,
    cls: Math.round(metric.probe.cls * 100_000) / 100_000,
    longTaskCount: metric.probe.longTaskMs.length,
    longTaskMs:
      Math.round(metric.probe.longTaskMs.reduce((total, value) => total + value, 0) * 1000) / 1000,
    longTaskMaxMs: metric.probe.longTaskMs.length > 0 ? Math.max(...metric.probe.longTaskMs) : 0,
    firstInteractionMs:
      metric.probe.firstInteraction === null
        ? null
        : Math.round(metric.probe.firstInteraction * 1000) / 1000,
    responseStartMs: Math.round(metric.navigation.responseStart * 1000) / 1000,
    domInteractiveMs: Math.round(metric.navigation.domInteractive * 1000) / 1000,
    domContentLoadedMs: Math.round(metric.navigation.domContentLoaded * 1000) / 1000,
    loadEventMs: Math.round(metric.navigation.loadEvent * 1000) / 1000,
    taskDurationMs: Math.round(metric.cdp.taskDurationMs * 1000) / 1000,
    scriptDurationMs: Math.round(metric.cdp.scriptDurationMs * 1000) / 1000,
    layoutDurationMs: Math.round(metric.cdp.layoutDurationMs * 1000) / 1000,
    heapUsed: metric.cdp.heapUsed,
    rss: null,
    requests: metric.requests.count,
    responseBytes: metric.requests.responseBytes,
    transferBytes: metric.requests.transferBytes,
    duplicateUrls: metric.requests.duplicateUrls,
    imageBytes: metric.requests.imageBytes,
    catalogIndexRequests: metric.requests.catalogIndexRequests,
    images: metric.images.count,
    lazyImages: metric.images.lazy,
    srcsetImages: metric.images.srcset,
    selectedImages: metric.images.selected,
    criticalImageBytes: metric.images.criticalBytes,
    bodyTextLength: metric.bodyTextLength,
  });
  const operation = report.operations[label] ?? {};
  report.operations[label] = operation;
  operation.memory = {
    heapUsed: metric.cdp.heapUsed,
    rss: 0,
    external: 0,
    arrayBuffers: 0,
  };
}

async function navigateAndMeasure(
  page: Page,
  tracker: RequestTracker,
  url: string,
): Promise<BrowserMetrics> {
  const started = performance.now();
  await page.goto(url, { waitUntil: "load", timeout: 120_000 });
  await page.locator("body").waitFor({ state: "visible", timeout: 30_000 });
  return browserMetrics(page, started, tracker);
}

async function waitForStudioDashboard(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Tus tiendas" })).toBeVisible({
    timeout: 120_000,
  });
  await page.locator(`[data-store-card-id="${snapshot.project.id}"]`).waitFor({
    state: "visible",
    timeout: 120_000,
  });
}

async function readBrowserStorage(page: Page): Promise<{
  elapsedMs: number;
  indexedDbDatabases: number;
  indexedDbSupported: boolean;
  localStorageKeys: number;
}> {
  return page.evaluate(async () => {
    const started = window.performance.now();
    let indexedDbDatabases = 0;
    const indexedDbSupported = typeof indexedDB.databases === "function";
    if (indexedDbSupported) {
      try {
        indexedDbDatabases = (await indexedDB.databases()).length;
      } catch {
        indexedDbDatabases = -1;
      }
    }
    return {
      elapsedMs: window.performance.now() - started,
      indexedDbDatabases,
      indexedDbSupported,
      localStorageKeys: Object.keys(localStorage).length,
    };
  });
}

async function openRmStudio(page: Page): Promise<boolean> {
  const card = page.locator(`[data-store-card-id="${snapshot.project.id}"]`);
  const openButton = page.getByRole("button", { name: "Abrir tienda", exact: true });
  if (!(await openButton.isVisible().catch(() => false))) await card.click();
  await openButton.click();
  await page.getByRole("navigation", { name: "Áreas de la tienda" }).waitFor({ timeout: 120_000 });
  const frame = page.locator('iframe[title="Vista previa desktop"]');
  const previewVisible = await frame
    .waitFor({ state: "visible", timeout: 60_000 })
    .then(() => true)
    .catch(() => false);
  if (!previewVisible) return false;
  await frame.contentFrame().locator("html").waitFor({ state: "attached", timeout: 60_000 });
  return true;
}

async function measureStudioCold(
  page: Page,
  viewportName: string,
  tracker: RequestTracker,
): Promise<void> {
  const dashboardStart = performance.now();
  await page.goto(studioUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await waitForStudioDashboard(page);
  addSample(
    studioReport,
    `studio.${viewportName}.dashboard`,
    performance.now() - dashboardStart,
    "cold",
  );
  const coldStorage = await readBrowserStorage(page);
  addSample(studioReport, `studio.${viewportName}.storage.read`, coldStorage.elapsedMs, "cold", {
    indexedDbDatabases: coldStorage.indexedDbDatabases,
    indexedDbSupported: coldStorage.indexedDbSupported,
    localStorageKeys: coldStorage.localStorageKeys,
  });

  const openStart = performance.now();
  const previewReady = await openRmStudio(page);
  addSample(studioReport, `studio.${viewportName}.open-rm`, performance.now() - openStart, "cold", {
    previewReady,
  });

  for (const [label, operation] of STUDIO_TABS) {
    const started = performance.now();
    await page.getByRole("tab", { name: label, exact: true }).click();
    await expect(page.getByRole("tab", { name: label, exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    addSample(
      studioReport,
      `studio.${viewportName}.tab.${operation}`,
      performance.now() - started,
      "cold",
    );
  }

  await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
  const catalogRows = await page.locator("tbody tr, [data-testid='ui-catalog-card']").count();
  const search = page.getByPlaceholder("Buscar por producto, marca o estado");
  const catalogSearchStart = performance.now();
  await search.fill("vaso");
  await expect(search).toHaveValue("vaso");
  addSample(
    studioReport,
    `studio.${viewportName}.catalog.search`,
    performance.now() - catalogSearchStart,
    "cold",
    {
      visibleRows: await page.locator("tbody tr, [data-testid='ui-catalog-card']").count(),
      initialRows: catalogRows,
    },
  );
  await search.fill("");
  const category = page.locator(".catalog-category-filter select");
  if ((await category.count()) > 0) {
    const values = await category
      .locator("option")
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
      );
    if (values[0]) {
      const filterStart = performance.now();
      await category.selectOption(values[0]);
      addSample(
        studioReport,
        `studio.${viewportName}.catalog.filter`,
        performance.now() - filterStart,
        "cold",
        {
          valueLength: values[0].length,
        },
      );
    }
  }

  await page.getByRole("tab", { name: "Exportar", exact: true }).click();
  await page.getByTestId("ui-export-audit-status").waitFor({ state: "visible", timeout: 120_000 });
  const exportButton = page.getByTestId("ui-export-draft");
  if (await exportButton.isEnabled()) {
    const workerStart = performance.now();
    await exportButton.click();
    await page.getByTestId("ui-export-result").waitFor({ state: "visible", timeout: 180_000 });
    addSample(
      studioReport,
      `studio.${viewportName}.export-worker.cold`,
      performance.now() - workerStart,
      "cold",
    );
    const warmWorkerStart = performance.now();
    await exportButton.click();
    await page.getByTestId("ui-export-result").waitFor({ state: "visible", timeout: 180_000 });
    addSample(
      studioReport,
      `studio.${viewportName}.export-worker.warm`,
      performance.now() - warmWorkerStart,
      "warm",
    );
  }

  const idleCdp = await page.context().newCDPSession(page);
  await idleCdp.send("Performance.enable");
  const before = (await idleCdp.send("Performance.getMetrics")).metrics as Array<{
    name: string;
    value: number;
  }>;
  await page.waitForTimeout(IDLE_SAMPLE_MS);
  const after = (await idleCdp.send("Performance.getMetrics")).metrics as Array<{
    name: string;
    value: number;
  }>;
  const delta = (name: string): number => {
    const first = before.find((metric) => metric.name === name)?.value ?? 0;
    const last = after.find((metric) => metric.name === name)?.value ?? 0;
    return Math.max(0, (last - first) * 1000);
  };
  addSample(studioReport, `studio.${viewportName}.idle.visible`, IDLE_SAMPLE_MS, "cold", {
    taskDurationMs: delta("TaskDuration"),
    scriptDurationMs: delta("ScriptDuration"),
    layoutDurationMs: delta("LayoutDuration"),
  });
  for (const frame of page.frames()) {
    await frame.evaluate(() => window.__rmSetHidden?.(true)).catch(() => undefined);
  }
  const hiddenBefore = (await idleCdp.send("Performance.getMetrics")).metrics as Array<{
    name: string;
    value: number;
  }>;
  await page.waitForTimeout(IDLE_SAMPLE_MS);
  const hiddenAfter = (await idleCdp.send("Performance.getMetrics")).metrics as Array<{
    name: string;
    value: number;
  }>;
  const hiddenDelta = (name: string): number => {
    const first = hiddenBefore.find((metric) => metric.name === name)?.value ?? 0;
    const last = hiddenAfter.find((metric) => metric.name === name)?.value ?? 0;
    return Math.max(0, (last - first) * 1000);
  };
  addSample(studioReport, `studio.${viewportName}.idle.hidden`, IDLE_SAMPLE_MS, "cold", {
    taskDurationMs: hiddenDelta("TaskDuration"),
    scriptDurationMs: hiddenDelta("ScriptDuration"),
    layoutDurationMs: hiddenDelta("LayoutDuration"),
  });
  const coldRequests = await tracker.take();
  const dashboardOperation = studioReport.operations[`studio.${viewportName}.dashboard`] ?? {};
  dashboardOperation.meta = {
    ...(dashboardOperation.meta ?? {}),
    requestCount: coldRequests.count,
    transferBytes: coldRequests.transferBytes,
    responseBytes: coldRequests.responseBytes,
    imageBytes: coldRequests.imageBytes,
    duplicateUrls: coldRequests.duplicateUrls,
  };
  studioReport.operations[`studio.${viewportName}.dashboard`] = dashboardOperation;
}

async function measureStudio(): Promise<void> {
  for (let index = 0; index < COLD_CONTEXTS; index += 1) {
    const viewport = VIEWPORTS[index % VIEWPORTS.length];
    const context = await browserForTest.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    await installPerformanceProbe(page);
    const tracker = createRequestTracker(page);
    await measureStudioCold(page, viewport.name, tracker);
    for (let reload = 0; reload < WARM_RELOADS; reload += 1) {
      const started = performance.now();
      await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
      await waitForStudioDashboard(page);
      addSample(
        studioReport,
        `studio.${viewport.name}.reload`,
        performance.now() - started,
        "warm",
      );
      const warmStorage = await readBrowserStorage(page);
      addSample(
        studioReport,
        `studio.${viewport.name}.storage.read`,
        warmStorage.elapsedMs,
        "warm",
        {
          indexedDbDatabases: warmStorage.indexedDbDatabases,
          indexedDbSupported: warmStorage.indexedDbSupported,
          localStorageKeys: warmStorage.localStorageKeys,
        },
      );
      const openStart = performance.now();
      const previewReady = await openRmStudio(page);
      addSample(
        studioReport,
        `studio.${viewport.name}.open-rm`,
        performance.now() - openStart,
        "warm",
        { previewReady },
      );
      for (const [label, operation] of STUDIO_TABS) {
        const tabStart = performance.now();
        await page.getByRole("tab", { name: label, exact: true }).click();
        await expect(page.getByRole("tab", { name: label, exact: true })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        addSample(
          studioReport,
          `studio.${viewport.name}.tab.${operation}`,
          performance.now() - tabStart,
          "warm",
        );
      }
      const metric = await browserMetrics(page, started, tracker);
      addMetric(studioReport, `studio.${viewport.name}.runtime`, metric, "warm");
      await page.getByRole("button", { name: "Volver a tiendas" }).click();
      await waitForStudioDashboard(page);
    }
    await context.close().catch(() => undefined);
  }
  expect(studioWriteAttempts).toEqual([]);
  studioReport.details = {
    layer: "studio",
    coldContexts: COLD_CONTEXTS,
    warmReloads: WARM_RELOADS,
    viewports: VIEWPORTS,
    managedWritable: false,
    writeAttempts: studioWriteAttempts,
    readOnly: true,
  };
}

function contentType(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();
  return (
    {
      avif: "image/avif",
      css: "text/css; charset=utf-8",
      gif: "image/gif",
      html: "text/html; charset=utf-8",
      jpeg: "image/jpeg",
      jpg: "image/jpeg",
      js: "text/javascript; charset=utf-8",
      json: "application/json; charset=utf-8",
      mp4: "video/mp4",
      png: "image/png",
      svg: "image/svg+xml",
      webp: "image/webp",
      woff: "font/woff",
      woff2: "font/woff2",
      xml: "application/xml; charset=utf-8",
    }[extension ?? ""] ?? "application/octet-stream"
  );
}

function startInMemoryStorefront(
  files: ReadonlyMap<string, string | Uint8Array>,
): Promise<{ server: Server; url: string }> {
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const requested = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "");
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
    response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": contentType(path) });
    response.end(file);
  });
  return new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("No se pudo abrir el storefront en memoria."));
        return;
      }
      resolveListen({ server, url: `http://127.0.0.1:${address.port}` });
    });
  });
}

function catalogIndexReconciliation(): { entries: number; matchesProject: boolean } {
  const catalogIndexFile = exported.files.get("catalog-index.json");
  if (typeof catalogIndexFile !== "string") return { entries: 0, matchesProject: false };
  try {
    const entries = JSON.parse(catalogIndexFile) as Array<{
      productId?: string;
      variantId?: string;
    }>;
    const expected = snapshot.project.products
      .filter((product) => product.status === "active")
      .flatMap((product) => product.variants.map((variant) => `${product.id}:${variant.id}`))
      .sort();
    const actual = entries
      .map((entry) => `${entry.productId ?? ""}:${entry.variantId ?? ""}`)
      .sort();
    return {
      entries: entries.length,
      matchesProject:
        expected.length === actual.length && expected.every((id, index) => id === actual[index]),
    };
  } catch {
    return { entries: 0, matchesProject: false };
  }
}

async function measureStorefrontRoutes(browser: Browser): Promise<void> {
  const routes = routeList();
  for (let pass = 0; pass < COLD_CONTEXTS; pass += 1) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    await installPerformanceProbe(page);
    const tracker = createRequestTracker(page);
    for (const [name, path] of routes) {
      const metric = await navigateAndMeasure(page, tracker, `${storefrontUrl}${path}`);
      addMetric(storefrontReport, `storefront.js.${name}`, metric, "cold");
    }
    await context.close().catch(() => undefined);
  }

  const warmContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: "block",
  });
  const warmPage = await warmContext.newPage();
  await installPerformanceProbe(warmPage);
  const warmTracker = createRequestTracker(warmPage);
  for (const [name, path] of routes) {
    await navigateAndMeasure(warmPage, warmTracker, `${storefrontUrl}${path}`);
    for (let reload = 0; reload < WARM_RELOADS; reload += 1) {
      const metric = await navigateAndMeasure(warmPage, warmTracker, `${storefrontUrl}${path}`);
      addMetric(storefrontReport, `storefront.js.${name}`, metric, "warm");
    }
  }

  await warmPage.goto(
    `${storefrontUrl}${projectRoute(snapshot.project.products[0]?.slug, "productos")}`,
    {
      waitUntil: "load",
      timeout: 120_000,
    },
  );
  const addToCart = warmPage.locator("[data-add-to-cart]").first();
  if ((await addToCart.count()) > 0) {
    const addStart = performance.now();
    await addToCart.click();
    await expect(warmPage.locator("[data-cart-count]").first()).not.toHaveText("0", {
      timeout: 30_000,
    });
    addSample(
      storefrontReport,
      "storefront.interaction.add-to-cart",
      performance.now() - addStart,
      "cold",
    );
  }
  const drawerTrigger = warmPage.locator("[data-solara-cart-open], [data-open-cart]").first();
  if ((await drawerTrigger.count()) > 0) {
    const drawerStart = performance.now();
    const drawer = warmPage.locator("[data-cart-drawer]");
    const drawerAlreadyOpen = await drawer.isVisible();
    if (!drawerAlreadyOpen) {
      await drawerTrigger.click();
      await drawer.waitFor({ state: "visible", timeout: 30_000 });
    }
    addSample(
      storefrontReport,
      "storefront.interaction.cart-drawer",
      performance.now() - drawerStart,
      "cold",
      { alreadyOpen: drawerAlreadyOpen },
    );
    const checkoutNext = warmPage.locator("[data-cart-checkout-next]").first();
    if ((await checkoutNext.count()) > 0 && (await checkoutNext.isVisible())) {
      const checkoutStart = performance.now();
      await checkoutNext.click();
      await warmPage
        .locator("[data-cart-checkout-panel]")
        .waitFor({ state: "visible", timeout: 30_000 });
      addSample(
        storefrontReport,
        "storefront.interaction.checkout-drawer",
        performance.now() - checkoutStart,
        "cold",
      );
    }
  }
  await warmPage.goto(`${storefrontUrl}/buscar/?q=a`, { waitUntil: "load", timeout: 120_000 });
  const searchInput = warmPage
    .locator(".solara-search-form input:visible, input[type='search']:visible, input:visible")
    .first();
  if ((await searchInput.count()) > 0) {
    const searchStart = performance.now();
    await searchInput.fill("vaso");
    await warmPage
      .locator("[data-search-results], [data-category-grid]")
      .first()
      .waitFor({ state: "attached", timeout: 30_000 });
    addSample(
      storefrontReport,
      "storefront.interaction.search",
      performance.now() - searchStart,
      "cold",
    );
  }
  const idleCdp = await warmContext.newCDPSession(warmPage);
  await idleCdp.send("Performance.enable");
  const idleBefore = (await idleCdp.send("Performance.getMetrics")).metrics as Array<{
    name: string;
    value: number;
  }>;
  await warmPage.waitForTimeout(IDLE_SAMPLE_MS);
  const idleAfter = (await idleCdp.send("Performance.getMetrics")).metrics as Array<{
    name: string;
    value: number;
  }>;
  const idleDelta = (name: string, before: typeof idleBefore, after: typeof idleAfter): number =>
    Math.max(
      0,
      ((after.find((metric) => metric.name === name)?.value ?? 0) -
        (before.find((metric) => metric.name === name)?.value ?? 0)) *
        1000,
    );
  addSample(storefrontReport, "storefront.idle.visible", IDLE_SAMPLE_MS, "cold", {
    taskDurationMs: idleDelta("TaskDuration", idleBefore, idleAfter),
    scriptDurationMs: idleDelta("ScriptDuration", idleBefore, idleAfter),
  });
  await warmPage.evaluate(() => window.__rmSetHidden?.(true));
  const hiddenBefore = (await idleCdp.send("Performance.getMetrics")).metrics as Array<{
    name: string;
    value: number;
  }>;
  await warmPage.waitForTimeout(IDLE_SAMPLE_MS);
  const hiddenAfter = (await idleCdp.send("Performance.getMetrics")).metrics as Array<{
    name: string;
    value: number;
  }>;
  addSample(storefrontReport, "storefront.idle.hidden", IDLE_SAMPLE_MS, "cold", {
    taskDurationMs: idleDelta("TaskDuration", hiddenBefore, hiddenAfter),
    scriptDurationMs: idleDelta("ScriptDuration", hiddenBefore, hiddenAfter),
  });
  await warmContext.close().catch(() => undefined);

  const noJsContext = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 900 },
    serviceWorkers: "block",
  });
  const noJsPage = await noJsContext.newPage();
  await installPerformanceProbe(noJsPage);
  const noJsTracker = createRequestTracker(noJsPage);
  for (const [name, path] of routes) {
    const metric = await navigateAndMeasure(noJsPage, noJsTracker, `${storefrontUrl}${path}`);
    addMetric(storefrontReport, `storefront.nojs.${name}`, metric, "cold");
  }
  await noJsContext.close().catch(() => undefined);
}

let browserForTest: Browser;

test.beforeAll(async ({ browser }) => {
  browserForTest = browser;
  snapshot = loadRmSnapshot();
  const managedProject: ReadOnlyManagedProject = {
    projectId: snapshot.project.id,
    name: snapshot.project.name,
    slug: snapshot.project.slug,
    version: snapshot.manifest.current.version,
    updatedAt: snapshot.project.updatedAt,
    savedAt: snapshot.manifest.current.savedAt,
    folder: "rm-descartables--704e2877",
    currentBytes: snapshot.snapshotBytes,
  };
  const runningStudio = await startStudioServer({ managedProject });
  studioServer = runningStudio.server;
  studioWriteAttempts = runningStudio.writeAttempts;
  studioUrl = runningStudio.url;
  exported = exportProject(snapshot.project, { mode: "production" });
  const runningStorefront = await startInMemoryStorefront(exported.files);
  storefrontServer = runningStorefront.server;
  storefrontUrl = runningStorefront.url;
  const environment = {
    commit: "see-node-report",
    node: process.version,
    browser: `${browser.browserType().name()} ${browser.version()}`,
  };
  studioReport = {
    environment,
    source: {
      storeId: snapshot.project.id,
      version: snapshot.manifest.current.version,
      snapshotBytes: snapshot.integrity.snapshotBytes,
      sha256: snapshot.integrity.snapshotSha256,
    },
    operations: {},
    resources: [],
    hotspots: [],
  };
  storefrontReport = { ...studioReport, operations: {}, resources: [], hotspots: [] };
});

test.afterAll(async () => {
  if (studioReport && Object.keys(studioReport.operations).length > 0)
    writePerformanceReport("studio", studioReport);
  if (storefrontReport && Object.keys(storefrontReport.operations).length > 0)
    writePerformanceReport("storefront", storefrontReport);
  if (studioServer) await stopStudioServer(studioServer);
  if (storefrontServer)
    await new Promise<void>((resolveClose) => {
      storefrontServer.close(() => resolveClose());
      storefrontServer.closeAllConnections?.();
    });
});

test.describe.configure({ mode: "serial" });
test.setTimeout(30 * 60_000);

test("mide Studio con RM por transporte administrado read-only", async () => {
  await measureStudio();
});

test("mide storefront exportado desde Map en memoria", async () => {
  await measureStorefrontRoutes(browserForTest);
  const catalogIndex = catalogIndexReconciliation();
  storefrontReport.details = {
    layer: "storefront",
    source: "Map en memoria",
    routes: routeList(),
    jsColdContexts: COLD_CONTEXTS,
    warmReloads: WARM_RELOADS,
    javascriptDisabled: true,
    exportFiles: exported.files.size,
    exportBytes: [...exported.files.values()].reduce(
      (total, value) =>
        total + (typeof value === "string" ? Buffer.byteLength(value) : value.byteLength),
      0,
    ),
    catalogIndexEntries: catalogIndex.entries,
    catalogIndexMatches: catalogIndex.matchesProject,
  };
});
