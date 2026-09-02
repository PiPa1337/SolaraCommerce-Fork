import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export interface PerformanceMemory {
  heapUsed: number;
  rss: number;
  external: number;
  arrayBuffers: number;
}

export interface PerformanceOperation {
  coldMs?: number[];
  warmMs?: {
    samples: number[];
    median: number;
    p95: number;
  };
  memory?: PerformanceMemory;
  bytes?: number;
  cpuMs?: number[];
  meta?: Record<string, boolean | number | string | null>;
  error?: string;
}

export interface PerformanceResource {
  path: string;
  bytes: number;
  category: string;
}

export interface PerformanceHotspot {
  rank: number;
  layer: string;
  evidence: string;
  hypothesis: string;
  proposal: string;
  risk: string;
  guardTests: string[];
}

export interface PerformanceReport {
  environment: {
    commit: string;
    node: string;
    browser: string;
  };
  source: {
    storeId: string;
    version: number;
    snapshotBytes: number;
    sha256: string;
  };
  operations: Record<string, PerformanceOperation>;
  resources: PerformanceResource[];
  hotspots: PerformanceHotspot[];
  details?: Record<string, unknown>;
  integrity?: Record<string, unknown>;
  errors?: string[];
}

export const PERFORMANCE_REPORT_DIR = resolve(
  process.env.SOLARA_PERF_REPORT_DIR ?? "test-results/performance/rm-descartables",
);

export function median(samples: readonly number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

export function p95(samples: readonly number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));
  return sorted[index] ?? 0;
}

export function warmSummary(samples: readonly number[]): {
  samples: number[];
  median: number;
  p95: number;
} {
  return {
    samples: [...samples],
    median: median(samples),
    p95: p95(samples),
  };
}

export function writePerformanceReport(layer: string, report: PerformanceReport): string {
  mkdirSync(PERFORMANCE_REPORT_DIR, { recursive: true });
  const path = resolve(PERFORMANCE_REPORT_DIR, `${layer}.json`);
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return path;
}

export function readPerformanceReport(layer: string): PerformanceReport | undefined {
  const path = resolve(PERFORMANCE_REPORT_DIR, `${layer}.json`);
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PerformanceReport;
  } catch {
    return undefined;
  }
}
