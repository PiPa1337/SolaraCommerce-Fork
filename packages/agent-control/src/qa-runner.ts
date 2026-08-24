/**
 * Ejecutor de tests via spawn de vitest CLI.
 * Usa spawn en vez de la API programatica para evitar conflictos de
 * configuracion con el worker del exporter.
 */
import { spawn } from "node:child_process";
import { resolve } from "node:path";

export interface GateResult {
  file: string;
  status: "pass" | "fail" | "skip";
  durationMs: number;
  error?: string;
}

export interface GatesResult {
  success: boolean;
  totalTests: number;
  passed: number;
  failed: number;
  durationMs: number;
  output: string;
}

const MONOREPO_ROOT = resolve(import.meta.dirname ?? ".", "..", "..", "..");

function runVitest(args: string[], timeoutMs: number): Promise<GatesResult> {
  return new Promise((resolvePromise) => {
    const start = Date.now();
    const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
    const child = spawn(npxCmd, ["vitest", "run", ...args], {
      cwd: MONOREPO_ROOT,
      shell: true,
      timeout: timeoutMs,
      env: { ...process.env, CI: "true" },
    });
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("close", (code) => {
      const durationMs = Date.now() - start;
      const passedMatch = output.match(/(\d+) passed/);
      const failedMatch = output.match(/(\d+) failed/);
      resolvePromise({
        success: code === 0,
        totalTests: Number(passedMatch?.[1] ?? 0) + Number(failedMatch?.[1] ?? 0),
        passed: Number(passedMatch?.[1] ?? 0),
        failed: Number(failedMatch?.[1] ?? 0),
        durationMs,
        output: output.slice(-5000), // last 5KB
      });
    });
    child.on("error", (err) => {
      resolvePromise({
        success: false,
        totalTests: 0,
        passed: 0,
        failed: 0,
        durationMs: Date.now() - start,
        output: err.message,
      });
    });
  });
}

export async function runQuickGates(): Promise<GatesResult> {
  return runVitest(["--reporter=dot"], 120_000);
}

export async function runTestFile(testPath: string): Promise<GatesResult> {
  return runVitest([testPath, "--reporter=verbose"], 30_000);
}

export async function detectFlaky(
  testPath: string,
  runs: number = 5,
): Promise<{
  stable: boolean;
  flaky: boolean;
  broken: boolean;
  passRate: number;
  results: boolean[];
}> {
  const results: boolean[] = [];
  for (let i = 0; i < runs; i++) {
    const result = await runTestFile(testPath);
    results.push(result.success);
  }
  const passCount = results.filter(Boolean).length;
  const passRate = passCount / runs;
  return {
    stable: passRate === 1,
    flaky: passRate > 0.2 && passRate < 0.8,
    broken: passRate === 0,
    passRate,
    results,
  };
}
