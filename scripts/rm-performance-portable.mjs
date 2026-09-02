import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "@playwright/test";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = resolve(
  process.env.SOLARA_PORTABLE_SOURCE ??
    join(root, ".release", "portable", "SolaraCommerce-Portable"),
);
const sourceProjectFolder = "rm-descartables--704e2877";
const expectedVersion = Number(process.env.SOLARA_RM_EXPECTED_VERSION ?? 31);
const coldRuns = Number(process.env.SOLARA_PERF_PORTABLE_COLD_RUNS ?? 3);
const warmRuns = Number(process.env.SOLARA_PERF_PORTABLE_WARM_RUNS ?? 3);
let detectedElectronVersion = "unknown";
const reportDir = resolve(
  process.env.SOLARA_PERF_REPORT_DIR ?? "test-results/performance/rm-descartables",
);
const reportPath = join(reportDir, "portable.json");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function median(samples) {
  if (samples.length === 0) return 0;
  const ordered = [...samples].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? ((ordered[middle - 1] ?? 0) + (ordered[middle] ?? 0)) / 2
    : (ordered[middle] ?? 0);
}

function p95(samples) {
  if (samples.length === 0) return 0;
  const ordered = [...samples].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * 0.95) - 1)] ?? 0;
}

function addSample(operations, label, phase, elapsedMs, meta = {}) {
  const operation = operations[label] ?? {};
  operations[label] = operation;
  const samples = phase === "cold" ? (operation.coldMs ?? []) : (operation.warmMs?.samples ?? []);
  samples.push(Math.round(elapsedMs * 1000) / 1000);
  if (phase === "cold") operation.coldMs = samples;
  else operation.warmMs = { samples, median: median(samples), p95: p95(samples) };
  operation.meta = { ...(operation.meta ?? {}), ...meta };
}

async function inventory(rootPath) {
  const rows = [];
  let totalBytes = 0;
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
        continue;
      }
      const info = await stat(path);
      const relativePath = relative(rootPath, path).replaceAll("\\", "/");
      rows.push(`${relativePath}\t${info.size}\t${info.mtimeMs}`);
      totalBytes += info.size;
    }
  };
  await visit(rootPath);
  rows.sort();
  return {
    fileCount: rows.length,
    totalBytes,
    sha256: sha256(new TextEncoder().encode(rows.join("\n"))),
  };
}

async function sourceIntegrity(projectDir) {
  const manifestPath = join(projectDir, "manifest.json");
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const currentPath = resolve(projectDir, manifest.current.projectPath);
  const rootPath = resolve(projectDir);
  const normalizedRoot = process.platform === "win32" ? rootPath.toLowerCase() : rootPath;
  const normalizedCurrent = process.platform === "win32" ? currentPath.toLowerCase() : currentPath;
  if (
    !normalizedCurrent.startsWith(`${normalizedRoot}${sep}`) ||
    basename(currentPath) !== basename(manifest.current.projectPath)
  ) {
    throw new Error("El current.projectPath del portable queda fuera de la tienda RM.");
  }
  const currentBytes = await readFile(currentPath);
  const fileInventory = await inventory(projectDir);
  return {
    manifestBytes: manifestBytes.byteLength,
    manifestSha256: sha256(manifestBytes),
    manifestVersion: manifest.manifestVersion,
    currentVersion: manifest.current.version,
    currentProjectPath: manifest.current.projectPath,
    currentSavedAt: manifest.current.savedAt,
    projectUpdatedAt: manifest.current.projectUpdatedAt,
    snapshotBytes: currentBytes.byteLength,
    snapshotSha256: sha256(currentBytes),
    fileCount: fileInventory.fileCount,
    folderBytes: fileInventory.totalBytes,
    fileInventorySha256: fileInventory.sha256,
  };
}

function assertSameIntegrity(before, after) {
  const keys = [
    "manifestBytes",
    "manifestSha256",
    "manifestVersion",
    "currentVersion",
    "currentProjectPath",
    "currentSavedAt",
    "projectUpdatedAt",
    "snapshotBytes",
    "snapshotSha256",
    "fileCount",
    "folderBytes",
    "fileInventorySha256",
  ];
  const changed = keys.filter((key) => before[key] !== after[key]);
  if (changed.length > 0) throw new Error(`La integridad de RM cambió: ${changed.join(", ")}.`);
}

async function copyPortableRuntime(sourceRoot, destinationRoot) {
  await mkdir(destinationRoot, { recursive: true });
  let bytes = 0;
  for (const entry of await readdir(sourceRoot, { withFileTypes: true })) {
    if (entry.name === "proyectos" || entry.name === ".solara-runtime") continue;
    const from = join(sourceRoot, entry.name);
    const to = join(destinationRoot, entry.name);
    await cp(from, to, { recursive: entry.isDirectory() });
    if (!entry.isDirectory()) bytes += (await stat(from)).size;
  }
  return bytes;
}

async function cdpMetrics(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const metrics = (await cdp.send("Performance.getMetrics")).metrics;
  const get = (name) => (metrics.find((metric) => metric.name === name)?.value ?? 0) * 1000;
  const heap = await cdp.send("Runtime.getHeapUsage").catch(() => ({ usedSize: 0, totalSize: 0 }));
  return {
    taskDurationMs: get("TaskDuration"),
    scriptDurationMs: get("ScriptDuration"),
    layoutDurationMs: get("LayoutDuration"),
    heapUsed: heap.usedSize,
    heapTotal: heap.totalSize,
  };
}

async function processMemory(app) {
  return app
    .evaluate(async ({ app: electronApp }) => {
      const metrics = await electronApp.getAppMetrics();
      return metrics.map((metric) => ({
        type: metric.type,
        pid: metric.pid,
        rss: metric.memory?.workingSetSize ?? 0,
        cpu: metric.cpu?.percentCPUUsage ?? 0,
      }));
    })
    .catch(() => []);
}

async function openPortable(executablePath, operations, writeAttempts, phase) {
  const launchStarted = performance.now();
  const app = await electron.launch({
    executablePath,
    args: ["--disable-gpu", "--disable-gpu-compositing", "--in-process-gpu"],
    timeout: 120_000,
  });
  detectedElectronVersion = await app
    .evaluate(() => process.versions.electron)
    .catch(() => detectedElectronVersion);
  const page = await app.firstWindow({ timeout: 120_000 });
  const pendingReads = new Map();
  page.on("request", (request) => {
    if (!request.url().includes("/__solara/")) return;
    if (request.method() !== "GET") {
      writeAttempts.push({ method: request.method(), url: request.url() });
      return;
    }
    const endpoint = request.url().split("/__solara/")[1]?.split(/[?#]/)[0] ?? "unknown";
    const label = endpoint
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
    pendingReads.set(request, { started: performance.now(), label: label || "unknown" });
  });
  page.on("response", (response) => {
    const pending = pendingReads.get(response.request());
    if (!pending) return;
    pendingReads.delete(response.request());
    addSample(
      operations,
      `portable.endpoint.${pending.label}`,
      phase,
      performance.now() - pending.started,
      {
        status: response.status(),
      },
    );
  });
  try {
    await page.getByRole("heading", { name: "Tus tiendas" }).waitFor({ timeout: 120_000 });
    await page.locator('[data-store-card-id="store-rm-descartables"]').waitFor({
      state: "visible",
      timeout: 120_000,
    });
    addSample(operations, "portable.startup", phase, performance.now() - launchStarted, {
      dashboard: true,
    });
    const openStarted = performance.now();
    await page.locator('[data-store-card-id="store-rm-descartables"]').click();
    await page.getByRole("button", { name: "Abrir tienda", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Áreas de la tienda" })
      .waitFor({ timeout: 120_000 });
    const preview = page.locator('iframe[title="Vista previa desktop"]');
    await preview.waitFor({ state: "visible", timeout: 120_000 });
    await preview.contentFrame().locator("html").waitFor({ state: "attached", timeout: 120_000 });
    const metrics = await cdpMetrics(page);
    const appMetrics = await processMemory(app);
    addSample(operations, "portable.open-rm", phase, performance.now() - openStarted, {
      taskDurationMs: metrics.taskDurationMs,
      scriptDurationMs: metrics.scriptDurationMs,
      layoutDurationMs: metrics.layoutDurationMs,
      heapUsed: metrics.heapUsed,
      rss: appMetrics.reduce((total, metric) => total + metric.rss, 0) * 1024,
      processes: appMetrics.length,
    });
    await page.getByRole("tab", { name: "Exportar", exact: true }).click();
    await page
      .getByTestId("ui-export-audit-status")
      .waitFor({ state: "visible", timeout: 120_000 });
    addSample(operations, "portable.preview-and-worker", phase, performance.now() - openStarted, {
      auditReady: true,
    });
  } finally {
    await app.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => undefined);
    await app.close().catch(() => undefined);
  }
}

async function main() {
  await mkdir(reportDir, { recursive: true });
  const operations = {};
  const writeAttempts = [];
  const testRoot = await mkdtemp(join(tmpdir(), "solara-rm-performance-"));
  const isolatedRoot = join(testRoot, "portable");
  let report;
  try {
    const sourceProjectDir = join(source, "proyectos", sourceProjectFolder);
    const manifest = JSON.parse(
      (await readFile(join(sourceProjectDir, "manifest.json"))).toString("utf8"),
    );
    if (manifest.projectId !== "store-rm-descartables")
      throw new Error("El manifest no es RM Descartables.");
    if (manifest.current.version !== expectedVersion) {
      throw new Error(`RM Descartables cambió de versión: v${manifest.current.version}.`);
    }
    const before = await sourceIntegrity(sourceProjectDir);
    if (before.snapshotSha256 !== manifest.current.sha256) {
      throw new Error("El hash del snapshot portable no coincide con el manifest.");
    }
    const copiedRuntimeBytes = await copyPortableRuntime(source, isolatedRoot);
    const isolatedProjectDir = join(isolatedRoot, "proyectos", sourceProjectFolder);
    await mkdir(join(isolatedProjectDir, "actual"), { recursive: true });
    await cp(join(sourceProjectDir, "manifest.json"), join(isolatedProjectDir, "manifest.json"));
    await cp(
      join(sourceProjectDir, manifest.current.projectPath),
      join(isolatedProjectDir, manifest.current.projectPath),
    );
    const temporaryBefore = await inventory(isolatedRoot);
    const executablePath = join(isolatedRoot, "SolaraCommerce.exe");
    for (let index = 0; index < coldRuns; index += 1) {
      await openPortable(executablePath, operations, writeAttempts, "cold");
    }
    for (let index = 0; index < warmRuns; index += 1) {
      await openPortable(executablePath, operations, writeAttempts, "warm");
    }
    const after = await sourceIntegrity(sourceProjectDir);
    assertSameIntegrity(before, after);
    const temporaryAfter = await inventory(isolatedRoot);
    report = {
      environment: {
        commit: "see-node-report",
        node: process.version,
        browser: `electron ${detectedElectronVersion}`,
      },
      source: {
        storeId: manifest.projectId,
        version: manifest.current.version,
        snapshotBytes: before.snapshotBytes,
        sha256: before.snapshotSha256,
      },
      operations,
      resources: [],
      hotspots: [],
      details: {
        layer: "portable-electron",
        coldRuns,
        warmRuns,
        copiedRuntimeBytes,
        temporaryWritesOnly: true,
        writeAttempts,
        original: { before, after, unchanged: true },
        temporaryBefore,
        temporaryAfter,
      },
      integrity: { before, after, unchanged: true },
    };
  } catch (error) {
    report = {
      environment: {
        commit: "see-node-report",
        node: process.version,
        browser: `electron ${detectedElectronVersion}`,
      },
      source: { storeId: "unknown", version: 0, snapshotBytes: 0, sha256: "" },
      operations,
      resources: [],
      hotspots: [],
      details: { layer: "portable-electron", writeAttempts },
      errors: [error instanceof Error ? error.message : String(error)],
    };
    throw error;
  } finally {
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    // testRoot es un directorio temporal creado exclusivamente por este run.
    await rm(testRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 }).catch(
      (error) => console.warn(`No se pudo limpiar el temporal del portable: ${error}`),
    );
  }
}

await main();
