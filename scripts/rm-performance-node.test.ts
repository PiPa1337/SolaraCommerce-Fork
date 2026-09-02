import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import {
  buildCatalogIndex,
  buildImageSitemap,
  buildMerchantFeed,
  buildSearchIndex,
  buildSitemap,
  buildVideoSitemap,
} from "../packages/exporter/src/feeds";
import {
  auditProject,
  buildCommerceSnapshot,
  buildOptimizationReport,
  exportProject,
  type PageDescriptor,
  renderPreviewHtml,
} from "../packages/exporter/src/index";
import { StoreProjectV2Schema } from "../packages/project-schema/src/index";
import {
  PERFORMANCE_REPORT_DIR,
  type PerformanceHotspot,
  type PerformanceMemory,
  type PerformanceOperation,
  type PerformanceReport,
  type PerformanceResource,
  warmSummary,
  writePerformanceReport,
} from "./rm-performance-report";
import {
  assertRmIntegrityUnchanged,
  captureRmIntegrity,
  loadRmSnapshot,
  type RmSourceSnapshot,
  summarizeProject,
} from "./rm-performance-source";

const DEFAULT_WARM_RUNS = 5;
const MAX_TEST_TIMEOUT_MS = 30 * 60_000;

interface TimedValue<T> {
  value: T;
  elapsedMs: number;
  cpuMs: number;
  memory: PerformanceMemory;
}

interface MeasureOptions<T> {
  bytes?: (value: T) => number;
  observe?: (value: T, phase: "cold" | "warm") => void;
  keepColdValue?: boolean;
  meta?: (value: T) => Record<string, boolean | number | string | null>;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`SOLARA_PERF_WARM_RUNS debe ser un entero positivo (recibido: ${value}).`);
  }
  return parsed;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function memorySnapshot(): PerformanceMemory {
  const memory = process.memoryUsage();
  return {
    heapUsed: memory.heapUsed,
    rss: memory.rss,
    external: memory.external,
    arrayBuffers: memory.arrayBuffers,
  };
}

function maxMemory(left: PerformanceMemory, right: PerformanceMemory): PerformanceMemory {
  return {
    heapUsed: Math.max(left.heapUsed, right.heapUsed),
    rss: Math.max(left.rss, right.rss),
    external: Math.max(left.external, right.external),
    arrayBuffers: Math.max(left.arrayBuffers, right.arrayBuffers),
  };
}

async function time<T>(fn: () => T | Promise<T>): Promise<TimedValue<T>> {
  const beforeMemory = memorySnapshot();
  const beforeCpu = process.resourceUsage();
  const started = performance.now();
  const value = await fn();
  const elapsedMs = performance.now() - started;
  const afterCpu = process.resourceUsage();
  const afterMemory = memorySnapshot();
  return {
    value,
    elapsedMs,
    cpuMs: Math.max(
      0,
      (afterCpu.userCPUTime -
        beforeCpu.userCPUTime +
        afterCpu.systemCPUTime -
        beforeCpu.systemCPUTime) /
        1000,
    ),
    memory: maxMemory(beforeMemory, afterMemory),
  };
}

function bytesOf(value: string | Uint8Array | ReadonlyMap<string, string | Uint8Array>): number {
  if (typeof value === "string") return Buffer.byteLength(value);
  if (value instanceof Uint8Array) return value.byteLength;
  let total = 0;
  for (const file of value.values()) total += bytesOf(file);
  return total;
}

function fileCategory(path: string): string {
  const extension = extname(path).toLowerCase();
  if (path.endsWith(".map")) return "studio-sourcemap";
  if (extension === ".html") return "html";
  if (extension === ".css") return "css";
  if (extension === ".js") return "js";
  if (extension === ".json") return "json";
  if (extension === ".xml") return "feed";
  if (extension === ".woff" || extension === ".woff2") return "font";
  if ([".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"].includes(extension)) {
    return "image";
  }
  if ([".mp4", ".webm", ".mov"].includes(extension)) return "video";
  return "other";
}

function collectDirectoryResources(root: string, categoryPrefix: string): PerformanceResource[] {
  if (!existsSync(root)) return [];
  const resources: PerformanceResource[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(path);
        continue;
      }
      const info = lstatSync(path);
      if (!info.isFile()) continue;
      const relativePath = relative(root, path).replaceAll("\\", "/");
      resources.push({
        path: `${categoryPrefix}/${relativePath}`,
        bytes: info.size,
        category: `${categoryPrefix}:${fileCategory(relativePath)}`,
      });
    }
  };
  visit(root);
  return resources;
}

function addExportResources(
  resources: PerformanceResource[],
  files: ReadonlyMap<string, string | Uint8Array>,
): void {
  for (const [path, value] of files) {
    const resourcePath = `storefront/${path}`;
    if (resources.some((resource) => resource.path === resourcePath)) continue;
    resources.push({ path: resourcePath, bytes: bytesOf(value), category: fileCategory(path) });
  }
}

function resourceTotals(resources: readonly PerformanceResource[]): {
  byCategory: Record<string, { files: number; bytes: number }>;
  byExtension: Record<string, { files: number; bytes: number }>;
  byDirectory: Record<string, { files: number; bytes: number }>;
} {
  const make = (): Record<string, { files: number; bytes: number }> => ({});
  const byCategory = make();
  const byExtension = make();
  const byDirectory = make();
  for (const resource of resources) {
    const add = (target: Record<string, { files: number; bytes: number }>, key: string) => {
      const current = target[key] ?? { files: 0, bytes: 0 };
      current.files += 1;
      current.bytes += resource.bytes;
      target[key] = current;
    };
    add(byCategory, resource.category);
    add(byExtension, extname(resource.path).toLowerCase() || "[sin-extension]");
    add(byDirectory, resource.path.split("/")[0] ?? "[raíz]");
  }
  return { byCategory, byExtension, byDirectory };
}

function buildAssetGraph(project: typeof StoreProjectV2Schema._output): {
  defined: number;
  referenced: number;
  unreferenced: number;
} {
  const known = new Set(project.assets.map((asset) => asset.id));
  const referenced = new Set<string>();
  const visit = (value: unknown): void => {
    if (typeof value === "string") {
      if (known.has(value)) referenced.add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const child of Object.values(value)) visit(child);
  };
  visit(project);
  return {
    defined: known.size,
    referenced: referenced.size,
    unreferenced: Math.max(0, known.size - referenced.size),
  };
}

function routeDescriptors(project: typeof StoreProjectV2Schema._output): PageDescriptor[] {
  const descriptor = (path: string, pageType: PageDescriptor["pageType"]): PageDescriptor => ({
    path: path === "/" ? "index.html" : `${path.replace(/^\//, "")}index.html`,
    title: "",
    description: "",
    canonicalPath: path,
    pageType,
    body: "",
    structuredData: [],
  });
  const pages: PageDescriptor[] = [descriptor("/", "home")];
  for (const category of project.categories.filter((item) => item.status !== "hidden")) {
    pages.push(descriptor(`/categorias/${category.slug}/`, "category"));
  }
  for (const collection of project.collections.filter((item) => item.status !== "hidden")) {
    pages.push(descriptor(`/colecciones/${collection.slug}/`, "collection"));
  }
  for (const product of project.products.filter((item) => item.status === "active")) {
    pages.push(descriptor(`/productos/${product.slug}/`, "product"));
  }
  pages.push(
    descriptor("/buscar/", "search"),
    descriptor("/carrito/", "cart"),
    descriptor("/checkout/", "checkout"),
    descriptor("/contacto/", "contact"),
    descriptor("/nosotros/", "about"),
    descriptor("/privacidad/", "legal"),
    descriptor("/terminos/", "legal"),
  );
  return pages;
}

function previewHtml(value: string | { html: string }): string {
  return typeof value === "string" ? value : value.html;
}

function operationError(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function rankHotspots(
  report: PerformanceReport,
  snapshot: RmSourceSnapshot,
  outputBytes: { draft: number; production: number },
): PerformanceHotspot[] {
  const production = report.operations["export.production"]?.warmMs;
  const preview = report.operations["preview.home"]?.warmMs;
  const schema = report.operations["schema.validate"]?.warmMs;
  const assetGraph = report.operations["normalization.asset-graph"]?.warmMs;
  const candidates: Array<PerformanceHotspot & { score: number }> = [
    {
      score: snapshot.integrity.snapshotBytes,
      rank: 0,
      layer: "snapshot/assets",
      evidence: `[observado] snapshot actual ${snapshot.integrity.snapshotBytes} B; ${summarizeProject(snapshot.project).dataUrlAssets} data URLs y ${summarizeProject(snapshot.project).dataUrlBytes} B decodificables estimados.`,
      hypothesis:
        "El JSON grande y las copias de strings/base64 pueden presionar parseo, heap y postMessage.",
      proposal:
        "Medir metadata separada de blobs, deduplicación y carga diferida con round-trip y paridad de exportación.",
      risk: "Alto: formato persistido, recovery y compatibilidad podrían divergir.",
      guardTests: [
        "StoreProjectV2Schema round-trip",
        "recovery draft",
        "paridad preview/export",
        "hash de assets",
      ],
    },
    {
      score: (production?.p95 ?? 0) + outputBytes.production / 1024,
      rank: 0,
      layer: "exporter",
      evidence: `[observado] export.production warm p95 ${round(production?.p95 ?? 0)} ms y ${outputBytes.production} B generados.`,
      hypothesis:
        "La construcción de páginas, assets, índices y feeds repite recorridos sobre un catálogo con 177 productos.",
      proposal:
        "Reutilizar snapshots/índices normalizados y medir cache por snapshot/ruta antes de cambiar el renderer.",
      risk: "Alto: preview y sitio público deben conservar igualdad semántica y determinismo.",
      guardTests: [
        "determinismo de exportProject",
        "rutas y sitemap",
        "Merchant feed",
        "snapshot fixture RM",
      ],
    },
    {
      score: (preview?.p95 ?? 0) + (assetGraph?.p95 ?? 0),
      rank: 0,
      layer: "preview",
      evidence: `[observado] preview.home warm p95 ${round(preview?.p95 ?? 0)} ms; grafo de assets warm p95 ${round(assetGraph?.p95 ?? 0)} ms.`,
      hypothesis: "El preview puede repetir normalización y preparación de assets al cambiar ruta.",
      proposal:
        "Comparar cache por hash del snapshot y ruta, manteniendo transporte parent y manifest del canvas equivalentes.",
      risk: "Alto: una cache incorrecta puede mostrar una ruta o asset anterior.",
      guardTests: [
        "rutas home/categoría/producto",
        "canvas manifest",
        "asset transport parent",
        "re-render tras edición",
      ],
    },
    {
      score: schema?.p95 ?? 0,
      rank: 0,
      layer: "validación/memoria",
      evidence: `[observado] schema.validate warm p95 ${round(schema?.p95 ?? 0)} ms sobre ${snapshot.integrity.snapshotBytes} B de snapshot.`,
      hypothesis: "Validaciones y clones completos pueden dominar heap/RSS antes de una edición.",
      proposal:
        "Medir structural sharing o patches sólo después de obtener antes/después y proteger undo/redo, recovery e importación.",
      risk: "Alto: cambios de referencia afectan historial y persistencia.",
      guardTests: [
        "StoreProjectV2Schema",
        "undo/redo",
        "importación .solara.json",
        "persistencia atómica",
      ],
    },
    {
      score: outputBytes.draft + outputBytes.production,
      rank: 0,
      layer: "storefront/bytes",
      evidence: `[observado] export draft ${outputBytes.draft} B y production ${outputBytes.production} B; el reporte separa HTML, CSS, JS, fuentes e imágenes.`,
      hypothesis:
        "El costo de red y decodificación se concentra en media y CSS público, no sólo en el runtime JS.",
      proposal:
        "Reducir CSS por familia/módulo y revisar preload, srcset, lazy loading y bytes críticos con no-JS como contrato.",
      risk: "Medio-alto: puede alterar LCP, layout shift y checkout.",
      guardTests: ["runtime JS <= 64 KiB", "CSS <= 8 KiB", "no-JS", "checkout y srcset"],
    },
    {
      score: snapshot.fileInventory.totalBytes,
      rank: 0,
      layer: "portable/I-O",
      evidence: `[observado] la carpeta RM contiene ${snapshot.fileInventory.fileCount} archivos y ${snapshot.fileInventory.totalBytes} B; el loader sólo abre manifest y current.`,
      hypothesis:
        "Escanear históricos o respaldos en el arranque puede explicar latencia e I/O sin aportar al editor actual.",
      proposal:
        "Medir y diferir lecturas pesadas hasta abrir una tienda; conservar la retención y no tocar backups en esta fase.",
      risk: "Alto: cambiar el orden de carga puede afectar recuperación y versiones en disco.",
      guardTests: [
        "manifest/current",
        "recovery",
        "portable aislado",
        "integridad de RM antes/después",
      ],
    },
  ];
  return candidates
    .sort((left, right) => right.score - left.score)
    .slice(0, 10)
    .map((candidate, index) => {
      const { score: _score, ...hotspot } = candidate;
      return { ...hotspot, rank: index + 1 };
    });
}

async function measureOperation<T>(
  report: PerformanceReport,
  errors: string[],
  label: string,
  warmRuns: number,
  fn: () => T | Promise<T>,
  options: MeasureOptions<T> = {},
): Promise<T | undefined> {
  const operation: PerformanceOperation = report.operations[label] ?? {};
  report.operations[label] = operation;
  try {
    const cold = await time(fn);
    operation.coldMs = [round(cold.elapsedMs)];
    operation.cpuMs = [round(cold.cpuMs)];
    operation.memory = cold.memory;
    if (options.bytes) operation.bytes = options.bytes(cold.value);
    if (options.meta) operation.meta = options.meta(cold.value);
    options.observe?.(cold.value, "cold");

    const warmSamples: number[] = [];
    const cpuSamples = operation.cpuMs;
    for (let index = 0; index < warmRuns; index += 1) {
      const warm = await time(fn);
      warmSamples.push(round(warm.elapsedMs));
      cpuSamples.push(round(warm.cpuMs));
      operation.memory = maxMemory(operation.memory, warm.memory);
      options.observe?.(warm.value, "warm");
    }
    operation.warmMs = warmSummary(warmSamples);
    return options.keepColdValue === false ? undefined : cold.value;
  } catch (reason) {
    const message = `${label}: ${operationError(reason)}`;
    operation.error = operationError(reason);
    errors.push(message);
    throw reason;
  }
}

function getCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "desconocido";
  }
}

function outputSummary(
  outputBytes: { draft: number; production: number },
  files: { draft: number; production: number },
): Record<string, number> {
  return {
    draftBytes: outputBytes.draft,
    productionBytes: outputBytes.production,
    draftFiles: files.draft,
    productionFiles: files.production,
  };
}

describe("auditoría de rendimiento read-only de RM Descartables", () => {
  it(
    "mide Node/exporter y conserva la integridad del snapshot",
    async () => {
      const warmRuns = positiveInteger(process.env.SOLARA_PERF_WARM_RUNS, DEFAULT_WARM_RUNS);
      let snapshot: RmSourceSnapshot | undefined;
      let report: PerformanceReport | undefined;
      let failure: unknown;
      const errors: string[] = [];
      try {
        snapshot = loadRmSnapshot();
        const project = snapshot.project;
        const summary = summarizeProject(project);
        report = {
          environment: {
            commit: getCommit(),
            node: process.version,
            browser: "no aplica en Node/exporter",
          },
          source: {
            storeId: project.id,
            version: snapshot.manifest.current.version,
            snapshotBytes: snapshot.integrity.snapshotBytes,
            sha256: snapshot.integrity.snapshotSha256,
          },
          operations: {},
          resources: [
            {
              path: "rm-source/current.solara.json",
              bytes: snapshot.integrity.snapshotBytes,
              category: "snapshot",
            },
            ...collectDirectoryResources(resolve("apps/studio/dist"), "studio-dist"),
          ],
          hotspots: [],
          details: {
            layer: "node/exporter",
            warmRuns,
            project: summary,
            sourceFolder: {
              fileCount: snapshot.fileInventory.fileCount,
              bytes: snapshot.fileInventory.totalBytes,
              inventorySha256: snapshot.fileInventory.fingerprint,
            },
          },
          integrity: { before: snapshot.integrity },
        };

        await measureOperation(
          report,
          errors,
          "manifest.read",
          warmRuns,
          () => {
            const bytes = readFileSync(snapshot.manifestPath);
            const manifest = JSON.parse(bytes.toString("utf8")) as {
              projectId: string;
              current: { version: number };
            };
            return {
              bytes: bytes.byteLength,
              projectId: manifest.projectId,
              version: manifest.current.version,
            };
          },
          { meta: (value) => ({ bytes: value.bytes, version: value.version }) },
        );

        await measureOperation(
          report,
          errors,
          "snapshot.read-hash",
          warmRuns,
          () => {
            const bytes = readFileSync(snapshot.snapshotPath);
            return {
              bytes: bytes.byteLength,
              sha256: createHash("sha256").update(bytes).digest("hex"),
            };
          },
          {
            bytes: (value) => value.bytes,
            meta: (value) => ({ bytes: value.bytes, sha256: value.sha256 }),
          },
        );

        await measureOperation(
          report,
          errors,
          "json.parse",
          warmRuns,
          () => JSON.parse(snapshot.snapshotText) as unknown,
          { keepColdValue: false },
        );

        await measureOperation(
          report,
          errors,
          "schema.validate",
          warmRuns,
          () => {
            const envelope = JSON.parse(snapshot.snapshotText) as { project?: unknown } | unknown;
            return StoreProjectV2Schema.parse(
              typeof envelope === "object" && envelope !== null && "project" in envelope
                ? envelope.project
                : envelope,
            );
          },
          { keepColdValue: false },
        );

        await measureOperation(
          report,
          errors,
          "normalization.asset-graph",
          warmRuns,
          () => {
            const normalized = StoreProjectV2Schema.parse(project);
            return buildAssetGraph(normalized);
          },
          { meta: (value) => value, keepColdValue: false },
        );

        await measureOperation(
          report,
          errors,
          "audit.project",
          warmRuns,
          () => auditProject(project),
          {
            meta: (value) => ({
              issues: value.length,
              critical: value.filter((issue) => issue.severity === "critical").length,
              warning: value.filter((issue) => issue.severity === "warning").length,
            }),
            keepColdValue: false,
          },
        );

        await measureOperation(
          report,
          errors,
          "audit.optimization-report",
          warmRuns,
          () => buildOptimizationReport(project, { mode: "draft", publicAiContext: false }),
          {
            meta: (value) => ({
              findings: value.findings.length,
              imageBytes: value.performance.imageBytes,
            }),
            keepColdValue: false,
          },
        );

        const commerceSnapshot = await measureOperation(
          report,
          errors,
          "feeds.commerce-snapshot",
          warmRuns,
          () => buildCommerceSnapshot(project),
          { meta: (value) => ({ products: value.products.length, offers: value.offers.length }) },
        );
        if (!commerceSnapshot) throw new Error("No se pudo construir el commerce snapshot.");

        const outputBytes = { draft: 0, production: 0 };
        const outputFiles = { draft: 0, production: 0 };
        for (const mode of ["draft", "production"] as const) {
          await measureOperation(
            report,
            errors,
            `export.${mode}`,
            warmRuns,
            () => exportProject(project, { mode }),
            {
              bytes: (value) => bytesOf(value.files),
              meta: (value) => ({ files: value.files.size, auditIssues: value.audit.length }),
              keepColdValue: false,
              observe: (value, phase) => {
                if (phase !== "cold") return;
                outputBytes[mode] = bytesOf(value.files);
                outputFiles[mode] = value.files.size;
                addExportResources(report.resources, value.files);
              },
            },
          );
        }

        const previewRoutes: Array<[string, string]> = [
          ["home", "/"],
          ["category", `/categorias/${project.categories[0]?.slug ?? ""}/`],
          ["product", `/productos/${project.products[0]?.slug ?? ""}/`],
          ["search", "/buscar/"],
          ["cart", "/carrito/"],
          ["checkout", "/checkout/"],
          ["contact", "/contacto/"],
        ];
        for (const [name, path] of previewRoutes) {
          await measureOperation(
            report,
            errors,
            `preview.${name}`,
            warmRuns,
            () => renderPreviewHtml(project, "draft", path, { assetTransport: "parent" }),
            { bytes: (value) => Buffer.byteLength(previewHtml(value)), keepColdValue: false },
          );
        }

        const pages = routeDescriptors(project);
        const feedOperations: Array<[string, () => string]> = [
          ["feeds.search-index", () => buildSearchIndex(project)],
          ["feeds.catalog-index", () => buildCatalogIndex(project)],
          ["feeds.merchant", () => buildMerchantFeed(project, commerceSnapshot)],
          ["feeds.sitemap", () => buildSitemap(project, pages)],
          ["feeds.image-sitemap", () => buildImageSitemap(project, pages)],
          ["feeds.video-sitemap", () => buildVideoSitemap(project)],
        ];
        for (const [label, fn] of feedOperations) {
          await measureOperation(report, errors, label, warmRuns, fn, {
            bytes: (value) => Buffer.byteLength(value),
            keepColdValue: false,
          });
        }

        report.details = {
          ...report.details,
          output: outputSummary(outputBytes, outputFiles),
          resources: resourceTotals(report.resources),
          topResources: [...report.resources]
            .sort((left, right) => right.bytes - left.bytes)
            .slice(0, 20),
          routesMeasured: previewRoutes.map(([name, path]) => ({ name, path })),
          readOnly: true,
          writesPerformed: false,
          reportDirectory: PERFORMANCE_REPORT_DIR,
        };
        report.hotspots = rankHotspots(report, snapshot, outputBytes);
      } catch (reason) {
        failure = reason;
        if (report) errors.push(operationError(reason));
      } finally {
        if (snapshot && report) {
          try {
            const after = captureRmIntegrity(snapshot);
            report.integrity = {
              ...report.integrity,
              before: snapshot.integrity,
              after,
              unchanged: (() => {
                assertRmIntegrityUnchanged(snapshot.integrity, after);
                return true;
              })(),
            };
          } catch (reason) {
            errors.push(`integridad: ${operationError(reason)}`);
            if (!failure) failure = reason;
            report.integrity = {
              ...report.integrity,
              after: captureRmIntegrity(snapshot),
              unchanged: false,
            };
          }
          if (errors.length > 0) report.errors = [...new Set(errors)];
          writePerformanceReport("node", report);
        } else {
          writePerformanceReport("node-aborted", {
            environment: { commit: getCommit(), node: process.version, browser: "no aplica" },
            source: { storeId: "unknown", version: 0, snapshotBytes: 0, sha256: "" },
            operations: {},
            resources: [],
            hotspots: [],
            errors: [operationError(failure ?? "No se pudo cargar RM Descartables.")],
          });
        }
      }

      if (failure) throw failure;
      expect(report).toBeTruthy();
      expect(report?.integrity?.unchanged).toBe(true);
    },
    MAX_TEST_TIMEOUT_MS,
  );
});
