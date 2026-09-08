import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";
import {
  assertSiteOptimizerSmokeResult,
  CODEX_NATIVE_BACKEND,
  CODEX_NATIVE_PROVIDER,
  type CodexCollaborationBackend,
  READ_ONLY_SITE_OPTIMIZER_SMOKE_TASK,
  runSubagentTask,
} from "./codex-collaboration";

interface SmokeRuntime {
  backend: CodexCollaborationBackend;
  model: string;
  checkoutPath: string;
  payloadEncoding: "plaintext" | "encrypted";
}

async function loadSmokeRuntime(): Promise<SmokeRuntime> {
  const runtime = (globalThis as typeof globalThis & { __SOLARA_CODEX_SMOKE__?: SmokeRuntime })
    .__SOLARA_CODEX_SMOKE__;
  if (runtime) return runtime;
  const modulePath = process.env.SOLARA_CODEX_SMOKE_MODULE;
  if (modulePath) {
    const loaded = (await import(pathToFileURL(modulePath).href)) as {
      default?: SmokeRuntime;
      smokeRuntime?: SmokeRuntime;
    };
    const configured = loaded.default ?? loaded.smokeRuntime;
    if (configured) return configured;
  }
  throw new Error(
    "Delegación no ejecutada: configurá SOLARA_CODEX_SMOKE_MODULE con un módulo que exponga el backend nativo de Codex.",
  );
}

test("sub-agent nativo ejecuta el equivalente read-only de site-optimizer-check", async () => {
  let runtime: SmokeRuntime;
  try {
    runtime = await loadSmokeRuntime();
  } catch (error) {
    console.info(
      `[codex-subagent-smoke] ${JSON.stringify({ status: "not-executed", error: String(error) })}`,
    );
    throw error;
  }
  const report = await runSubagentTask(
    runtime.backend,
    {
      provider: CODEX_NATIVE_PROVIDER,
      backend: CODEX_NATIVE_BACKEND,
      model: runtime.model,
      payloadEncoding: runtime.payloadEncoding,
      checkoutPath: runtime.checkoutPath,
      task: READ_ONLY_SITE_OPTIMIZER_SMOKE_TASK,
    },
    { timeoutMs: 30_000 },
  );

  console.info(
    `[codex-subagent-smoke] ${JSON.stringify({
      model: report.transport.model,
      backend: report.transport.backend,
      checkoutPath: report.checkoutPath,
      provisioning: report.provisioning,
      finalStatus: report.status,
      result: report.result,
      error: report.error,
    })}`,
  );
  expect(report.transport.model).toBe(runtime.model);
  expect(report.transport.backend).toBe(CODEX_NATIVE_BACKEND);
  expect(report.checkoutPath).toBe(runtime.checkoutPath);
  expect(report.provisioning.state).toBe("ready");
  expect(report.status, report.error ? JSON.stringify(report.error) : undefined).toBe("succeeded");
  const smoke = assertSiteOptimizerSmokeResult(report.result);
  expect(smoke.summary).toEqual({
    modernActiveProducts: 50,
    scaleCategoryRoutes: 16,
    cleanActiveProducts: 0,
  });
});
