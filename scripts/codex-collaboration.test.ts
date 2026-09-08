import { describe, expect, it, vi } from "vitest";
import {
  assertSiteOptimizerSmokeResult,
  CollaborationError,
  runSubagentTask,
  waitForExecutableThread,
} from "./codex-collaboration";

const request = {
  provider: "codex",
  backend: "native",
  model: "gpt-5.6-sol",
  payloadEncoding: "plaintext" as const,
  checkoutPath: "C:/checkout",
  task: "read-only smoke",
};

describe("transporte nativo de colaboración Codex", () => {
  it("bloquea antes del launch cualquier backend no nativo", async () => {
    const launch = vi.fn();
    await expect(
      runSubagentTask(
        {
          launch,
          getProvisioningStatus: vi.fn(),
          sendFollowUp: vi.fn(),
        },
        { ...request, provider: "external-provider", backend: "external-backend" },
      ),
    ).rejects.toMatchObject({ code: "NATIVE_BACKEND_REQUIRED" });
    expect(launch).not.toHaveBeenCalled();
  });

  it("resuelve clientThreadId antes de enviar follow-ups", async () => {
    const events: string[] = [];
    const backend = {
      launch: vi.fn(async () => {
        events.push("launch");
        return { clientThreadId: "client-1" };
      }),
      getProvisioningStatus: vi.fn(async () => {
        events.push("status");
        return { state: "ready" as const, threadId: "thread-1", worktreePath: "C:/worktree" };
      }),
      sendFollowUp: vi.fn(async (threadId: string) => {
        events.push(`follow-up:${threadId}`);
        return { executed: true };
      }),
    };
    const result = await runSubagentTask(
      backend,
      { ...request, payloadEncoding: "plaintext" },
      {
        sleep: async () => undefined,
        followUps: ["review"],
      },
    );
    expect(result.status).toBe("succeeded");
    expect(events).toEqual(["launch", "status", "follow-up:thread-1"]);
  });

  it("devuelve diagnóstico explícito cuando el worktree agota el timeout", async () => {
    const result = await runSubagentTask(
      {
        launch: async () => ({ clientThreadId: "client-timeout" }),
        getProvisioningStatus: async () => ({
          state: "pending" as const,
          message: "worktree pending",
        }),
        sendFollowUp: vi.fn(),
      },
      { ...request, payloadEncoding: "plaintext" },
      { timeoutMs: 0, sleep: async () => undefined },
    );
    expect(result.status).toBe("failed");
    expect(result.error).toMatchObject({ code: "WORKTREE_PROVISIONING_TIMEOUT", retryable: true });
    expect(result.provisioning).toMatchObject({ state: "failed" });
  });

  it("reintenta con backoff acotado hasta que el worktree está listo", async () => {
    const states = [
      { state: "pending" as const, message: "worktree pending" },
      { state: "pending" as const, message: "worktree still pending" },
      { state: "ready" as const, threadId: "thread-ready" },
    ];
    const delays: number[] = [];
    const result = await waitForExecutableThread(
      {
        getProvisioningStatus: async () => states.shift() ?? { state: "failed" as const },
      },
      "client-retry",
      {
        timeoutMs: 1_000,
        initialDelayMs: 10,
        maxDelayMs: 20,
        sleep: async (delayMs) => {
          delays.push(delayMs);
        },
      },
    );
    expect(result).toMatchObject({ state: "ready", threadId: "thread-ready", attempts: 3 });
    expect(delays).toEqual([10, 20]);
  });

  it("falla sin reintentar cuando el backend informa provisioning fallido", async () => {
    const sleep = vi.fn(async () => undefined);
    const status = await waitForExecutableThread(
      {
        getProvisioningStatus: async () => ({
          state: "failed" as const,
          message: "worktree failed",
        }),
      },
      "client-failed",
      { timeoutMs: 100, sleep },
    ).catch((error: unknown) => error);
    expect(status).toBeInstanceOf(CollaborationError);
    expect(status).toMatchObject({ code: "WORKTREE_PROVISIONING_FAILED" });
    expect(sleep).not.toHaveBeenCalled();
  });

  it("valida evidencia de que el smoke read-only sí fue ejecutado", () => {
    expect(() => assertSiteOptimizerSmokeResult({ executed: false })).toThrow(
      "no demostró ejecución read-only",
    );
    expect(
      assertSiteOptimizerSmokeResult({
        executed: true,
        readOnly: true,
        check: "site-optimizer",
        summary: { modernActiveProducts: 50, scaleCategoryRoutes: 16, cleanActiveProducts: 0 },
      }),
    ).toMatchObject({ executed: true, readOnly: true });
  });
});
