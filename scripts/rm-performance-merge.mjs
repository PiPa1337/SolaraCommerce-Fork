import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const reportDir = resolve(
  process.env.SOLARA_PERF_REPORT_DIR ?? "test-results/performance/rm-descartables",
);
const layers = ["node", "studio", "storefront", "portable"];

function readLayer(layer) {
  const path = resolve(reportDir, `${layer}.json`);
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8"));
}

function operationValue(operation, field) {
  const values = operation?.[field];
  if (!Array.isArray(values) || values.length === 0) return 0;
  return Math.max(...values);
}

function operationRows(reports) {
  return reports.flatMap(({ layer, report }) =>
    Object.entries(report.operations ?? {}).map(([label, operation]) => ({
      layer,
      label,
      p95Ms: operation.warmMs?.p95 ?? Math.max(...(operation.coldMs ?? [0])),
      cpuMs: operationValue(operation, "cpuMs"),
      rss: operation.memory?.rss ?? 0,
      heapUsed: operation.memory?.heapUsed ?? 0,
      bytes: operation.bytes ?? 0,
      requests: operation.meta?.requests ?? 0,
    })),
  );
}

function operationLabel(layer, label) {
  const prefix = `${layer}.`;
  return label.startsWith(prefix) ? label : `${prefix}${label}`;
}

function top(rows, key) {
  return [...rows]
    .sort((left, right) => Number(right[key] ?? 0) - Number(left[key] ?? 0))
    .slice(0, 10)
    .map((row, index) => ({ rank: index + 1, ...row }));
}

function main() {
  const loaded = layers
    .map((layer) => ({ layer, report: readLayer(layer) }))
    .filter((entry) => entry.report);
  if (loaded.length === 0) throw new Error(`No hay capas en ${reportDir}.`);
  const primary = loaded.find((entry) => entry.layer === "node")?.report ?? loaded[0].report;
  const resources = [];
  const seenResources = new Set();
  for (const { report } of loaded) {
    for (const resource of report.resources ?? []) {
      const key = `${resource.category}\t${resource.path}`;
      if (seenResources.has(key)) continue;
      seenResources.add(key);
      resources.push(resource);
    }
  }
  const rows = operationRows(loaded);
  const errors = loaded.flatMap(({ layer, report }) =>
    (report.errors ?? []).map((error) => `${layer}: ${error}`),
  );
  const aggregate = {
    topByTime: top(rows, "p95Ms"),
    topByCpu: top(rows, "cpuMs"),
    topByMemoryRss: top(rows, "rss"),
    topByMemoryHeap: top(rows, "heapUsed"),
    topByOperationBytes: top(rows, "bytes"),
    topByRequests: top(rows, "requests"),
    topResourcesByBytes: [...resources]
      .sort((left, right) => right.bytes - left.bytes)
      .slice(0, 10)
      .map((resource, index) => ({ rank: index + 1, ...resource })),
  };
  const report = {
    ...primary,
    environment: {
      ...primary.environment,
      browser: loaded
        .map(({ report }) => report.environment?.browser)
        .filter(Boolean)
        .filter((value, index, all) => all.indexOf(value) === index)
        .join("; "),
    },
    operations: Object.fromEntries(
      loaded.flatMap(({ layer, report }) =>
        Object.entries(report.operations ?? {}).map(([label, operation]) => [
          operationLabel(layer, label),
          operation,
        ]),
      ),
    ),
    resources,
    hotspots: primary.hotspots ?? [],
    details: {
      ...(primary.details ?? {}),
      layers: Object.fromEntries(loaded.map(({ layer, report }) => [layer, report.details ?? {}])),
      aggregateTop10: aggregate,
      generatedAt: new Date().toISOString(),
      reportDir,
    },
    integrity: Object.fromEntries(
      loaded
        .filter(({ report }) => report.integrity)
        .map(({ layer, report }) => [layer, report.integrity]),
    ),
    ...(errors.length > 0 ? { errors: [...new Set(errors)] } : {}),
  };
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(resolve(reportDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Reporte agregado: ${resolve(reportDir, "report.json")}`);
  if (errors.length > 0) process.exitCode = 1;
}

main();
