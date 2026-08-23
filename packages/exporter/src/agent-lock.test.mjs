import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAgentLockStore } from "../scripts/agent-lock.mjs";
import { createLocalProjectStorage } from "../scripts/local-project-storage.mjs";

describe("lock cooperativo del agente", () => {
  it("bloquea Studio pero permite continuar al plan dueño", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-agent-lock-"));
    try {
      const storage = createLocalProjectStorage({
        applicationRoot: root,
        projectsRoot: join(root, "proyectos"),
        stagingRoot: join(root, ".solara-runtime", "transactions"),
      });
      const locks = createAgentLockStore({ applicationRoot: root });
      await locks.claim("store-lock", "plan-lock", { planId: "plan-lock" });
      await expect(
        storage.beginSave({
          projectId: "store-lock",
          name: "Bloqueada",
          slug: "bloqueada",
          projectUpdatedAt: new Date().toISOString(),
          expectedVersion: null,
        }),
      ).rejects.toMatchObject({ code: "AGENT_LOCKED" });
      const transaction = await storage.beginSave({
        projectId: "store-lock",
        name: "Bloqueada",
        slug: "bloqueada",
        projectUpdatedAt: new Date().toISOString(),
        expectedVersion: null,
        actor: { kind: "agent", id: "plan-lock" },
      });
      await storage.abort(transaction.transactionId);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
