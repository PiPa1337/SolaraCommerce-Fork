import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { QACycleManager } from "./qa-cycle-manager.js";

describe("QA cycle manager", () => {
  it("crea, persiste y carga ciclos", async () => {
    const root = await mkdtemp(join(tmpdir(), "qa-cycle-"));
    try {
      const mgr = new QACycleManager(root);
      await mgr.ensureDir();

      const cycle = mgr.createCycle("P10-1");
      expect(cycle.phase).toBe("read");
      expect(cycle.attempts).toBe(0);

      mgr.updatePhase(cycle.cycleId, "test-write");
      mgr.updatePhase(cycle.cycleId, "gates");
      expect(mgr.shouldBlock(cycle.cycleId)).toBe(false); // attempts=1

      mgr.updatePhase(cycle.cycleId, "implement");
      mgr.updatePhase(cycle.cycleId, "gates");
      mgr.updatePhase(cycle.cycleId, "implement");
      mgr.updatePhase(cycle.cycleId, "gates");
      expect(mgr.shouldBlock(cycle.cycleId)).toBe(true); // attempts=3

      mgr.blockCycle(cycle.cycleId, "test failure x3");
      await mgr.persist(cycle.cycleId);

      // Reload in a new manager (simulates restart)
      const mgr2 = new QACycleManager(root);
      await mgr2.loadCycles();
      expect(mgr2.getActiveCycle()).toBeUndefined(); // blocked cycles are not active
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("ciclo completado no es bloqueado", async () => {
    const root = await mkdtemp(join(tmpdir(), "qa-cycle-done-"));
    try {
      const mgr = new QACycleManager(root);
      await mgr.ensureDir();
      const cycle = mgr.createCycle("P10-2");
      mgr.completeCycle(cycle.cycleId, "abc123");
      expect(mgr.shouldBlock(cycle.cycleId)).toBe(false);

      await mgr.persist(cycle.cycleId);
      const raw = JSON.parse(
        await readFile(join(root, "qa-cycles", `${cycle.cycleId}.json`), "utf8"),
      );
      expect(raw.phase).toBe("done");
      expect(raw.commitHash).toBe("abc123");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
