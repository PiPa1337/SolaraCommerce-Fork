/**
 * Metodos de QA perpetuo para el canal nativo del agente.
 * Requiere scope "qa:write".
 */

import { spawn } from "node:child_process";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { exportProject } from "@solara/exporter";
import type { StoreProjectV1 } from "@solara/project-schema";
import { QACycleManager } from "./qa-cycle-manager.js";

export interface QaContext {
  applicationRoot: string;
  requireScope(scope: string): void;
  audit(event: string, details?: Record<string, unknown>): Promise<void>;
}

async function runVitest(args: string[], timeoutMs: number) {
  return new Promise<{ success: boolean; passed: number; failed: number; output: string }>(
    (res) => {
      // Mismo hardening que qa-runner: binario local sin shell.
      const vitestBin = resolve(
        import.meta.dirname ?? ".",
        "..",
        "..",
        "..",
        "node_modules",
        ".bin",
        process.platform === "win32" ? "vitest.CMD" : "vitest",
      );
      const child = spawn(vitestBin, ["run", ...args], {
        timeout: timeoutMs,
        env: { ...process.env, CI: "true" },
        windowsVerbatimArguments: false,
      });
      let output = "";
      child.stdout?.on("data", (c: Buffer) => {
        output += c.toString();
      });
      child.stderr?.on("data", (c: Buffer) => {
        output += c.toString();
      });
      child.on("close", (code) => {
        const p = output.match(/(\d+) passed/);
        const f = output.match(/(\d+) failed/);
        res({
          success: code === 0,
          passed: Number(p?.[1] ?? 0),
          failed: Number(f?.[1] ?? 0),
          output: output.slice(-5000),
        });
      });
      child.on("error", () => res({ success: false, passed: 0, failed: 0, output: "spawn error" }));
    },
  );
}

export async function readBacklog(ctx: QaContext) {
  ctx.requireScope("qa:write");
  const statePath = join(ctx.applicationRoot, "docs", "perpetual-state.json");
  try {
    return JSON.parse(await readFile(statePath, "utf8"));
  } catch {
    return { error: "No se pudo leer perpetual-state.json" };
  }
}

export async function logProgress(ctx: QaContext, entry: string) {
  ctx.requireScope("qa:write");
  const logPath = join(ctx.applicationRoot, "docs", "perpetual-progress.log");
  await mkdir(join(logPath, ".."), { recursive: true });
  const ts = `${new Date().toISOString().replace("T", " ").slice(0, 16)}Z`;
  await appendFile(logPath, `- ${ts} ${entry}\n`, "utf8");
  await ctx.audit("qa.progress.logged", { entry });
  return { logged: true };
}

export async function updateState(ctx: QaContext, patch: Record<string, unknown>) {
  ctx.requireScope("qa:write");
  const statePath = join(ctx.applicationRoot, "docs", "perpetual-state.json");
  let state: Record<string, unknown> = {};
  try {
    state = JSON.parse(await readFile(statePath, "utf8"));
  } catch {
    /* fresh */
  }
  Object.assign(state, patch);
  await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
  await ctx.audit("qa.state.updated", { keys: Object.keys(patch) });
  return { updated: true, state };
}

export async function writeTest(ctx: QaContext, filePath: string, content: string) {
  ctx.requireScope("qa:write");
  if (!/^packages\/[\w-]+\/src\/[\w-]+\.test\.(ts|mjs)$/.test(filePath))
    throw Object.assign(new Error("Ruta de test invalida"), { code: "QA_PATH_INVALID" });
  if (!content.includes("vitest"))
    throw Object.assign(new Error("Debe importar vitest"), { code: "QA_NO_VITEST" });
  const fullPath = join(ctx.applicationRoot, filePath);
  await mkdir(fullPath.replace(/[/\\][^/\\]+$/, ""), { recursive: true });
  await writeFile(fullPath, content, "utf8");
  await ctx.audit("qa.test.written", { filePath });
  return { written: true, filePath };
}

export async function runGates(ctx: QaContext, suite: string, filter?: string) {
  ctx.requireScope("qa:write");
  const args = suite === "quick" ? [] : filter ? [filter] : [];
  const result = await runVitest(args.filter(Boolean), suite === "quick" ? 120_000 : 30_000);
  await ctx.audit("qa.gates.run", { suite, ...result });
  return result;
}

export async function detectFlaky(ctx: QaContext, testFile: string, runs: number) {
  ctx.requireScope("qa:write");
  const results: boolean[] = [];
  for (let i = 0; i < runs; i++) {
    const r = await runVitest([testFile], 15_000);
    results.push(r.success);
  }
  const passRate = results.filter(Boolean).length / runs;
  return {
    stable: passRate === 1,
    flaky: passRate > 0.2 && passRate < 1,
    broken: passRate === 0,
    passRate,
    results,
  };
}

export function createQaContext(
  applicationRoot: string,
  scopes: Set<string>,
  auditFn: (event: string, details?: Record<string, unknown>) => Promise<void>,
): QaContext {
  return {
    applicationRoot,
    requireScope(scope: string) {
      if (!scopes.has(scope)) {
        throw Object.assign(new Error(`Sin scope ${scope}`), { code: "PERMISSION_DENIED" });
      }
    },
    audit: auditFn,
  };
}

export async function dispatchQaMethod(
  ctx: QaContext,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  switch (method) {
    case "qa.readBacklog":
      return readBacklog(ctx);
    case "qa.logProgress":
      return logProgress(ctx, (params as { entry?: string }).entry ?? "");
    case "qa.updateState":
      return updateState(ctx, (params as { patch?: Record<string, unknown> }).patch ?? {});
    case "qa.writeTest": {
      const p = params as { filePath?: string; content?: string };
      if (!p.filePath || !p.content) throw new Error("filePath y content requeridos");
      return writeTest(ctx, p.filePath, p.content);
    }
    case "qa.runGates": {
      const p = params as { suite?: string; filter?: string };
      return runGates(ctx, p.suite ?? "quick", p.filter);
    }
    case "qa.detectFlaky": {
      const p = params as { testFile?: string; runs?: number };
      if (!p.testFile) throw new Error("testFile requerido");
      return detectFlaky(ctx, p.testFile, p.runs ?? 5);
    }
    case "qa.runExport": {
      const p = params as { storeId?: string; projectData?: StoreProjectV1 };
      if (!p.projectData) throw new Error("projectData requerido para export");
      const result = exportProject(p.projectData, { mode: "draft" });
      let totalBytes = 0;
      let htmlFiles = 0;
      for (const [path, content] of result.files) {
        totalBytes += typeof content === "string" ? Buffer.byteLength(content) : content.byteLength;
        if (path.endsWith(".html")) htmlFiles++;
      }
      const critical = result.audit.filter((i) => i.severity === "critical").length;
      return {
        storeId: p.storeId,
        mode: "draft",
        files: result.files.size,
        htmlFiles,
        totalBytes,
        criticalAuditIssues: critical,
        auditCount: result.audit.length,
      };
    }
    case "qa.runCycle":
      return runQaCycle(ctx);
    case "qa.status":
      return qaStatus(ctx);
    default:
      throw Object.assign(new Error(`Metodo QA desconocido: ${method}`), {
        code: "METHOD_NOT_FOUND",
      });
  }
}

export async function runQaCycle(ctx: QaContext): Promise<unknown> {
  ctx.requireScope("qa:write");
  const backlog = await readBacklog(ctx);
  const nextItem = (backlog as { nextItem?: string }).nextItem;
  if (!nextItem) return { error: "No hay item siguiente en el backlog" };
  // Ciclo con estado durable: el manager persiste la fase, el watchdog de 3
  // intentos y el historial para que qa.status y la UI lean el mismo estado.
  const manager = new QACycleManager(ctx.applicationRoot);
  await manager.loadCycles();
  const active = manager.getActiveCycle();
  const cycle = active ?? manager.createCycle(nextItem);
  manager.updatePhase(cycle.cycleId, "gates");
  await logProgress(ctx, `Ciclo iniciado para ${nextItem}`);
  const gates = await runGates(ctx, "quick");
  if (manager.shouldBlock(cycle.cycleId)) {
    manager.blockCycle(cycle.cycleId, `gates fallando tras 3 intentos: ${gates.failed} tests`);
    await manager.persist(cycle.cycleId);
    return {
      cycleId: cycle.cycleId,
      blocked: true,
      backlogItem: nextItem,
      gatesFailed: gates.failed,
    };
  }
  manager.updatePhase(cycle.cycleId, "done");
  await manager.persist(cycle.cycleId);
  await logProgress(
    ctx,
    `Ciclo ${cycle.cycleId}: gates ${gates.passed} pass / ${gates.failed} fail`,
  );
  return {
    cycleId: cycle.cycleId,
    blocked: false,
    backlogItem: nextItem,
    gatesSuccess: gates.success,
    gatesPassed: gates.passed,
    gatesFailed: gates.failed,
    instruction: gates.success
      ? "Los gates estan verdes. Escribi un test nuevo o implementa el fix."
      : "Hay tests falliendo. Diagnostica y corrige antes de continuar.",
  };
}

export async function qaStatus(ctx: QaContext) {
  ctx.requireScope("qa:write");
  const manager = new QACycleManager(ctx.applicationRoot);
  await manager.loadCycles();
  return manager.getStatus();
}
