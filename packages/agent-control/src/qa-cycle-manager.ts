/**
 * Gestion de ciclos de QA perpetuo: estado, watchdog, persistencia.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type QAPhase = "read" | "test-write" | "implement" | "gates" | "commit" | "done" | "blocked";

export interface QACycleState {
  cycleId: string;
  startedAt: string;
  updatedAt: string;
  backlogItem: string;
  phase: QAPhase;
  attempts: number;
  testFile?: string;
  testStatus?: "pass" | "fail";
  gateResults?: Array<{ file: string; status: string; durationMs: number }>;
  commitHash?: string;
  error?: string;
}

const MAX_ATTEMPTS = 3;

export class QACycleManager {
  private readonly cyclesRoot: string;
  private cycles = new Map<string, QACycleState>();

  constructor(agentRoot: string) {
    this.cyclesRoot = join(agentRoot, "qa-cycles");
  }

  async ensureDir(): Promise<void> {
    await mkdir(this.cyclesRoot, { recursive: true });
  }

  async loadCycles(): Promise<void> {
    await this.ensureDir();
    try {
      const files = await readdir(this.cyclesRoot);
      for (const file of files.filter((f) => f.endsWith(".json"))) {
        try {
          const raw = await readFile(join(this.cyclesRoot, file), "utf8");
          const state = JSON.parse(raw) as QACycleState;
          if (state.phase !== "done" && state.phase !== "blocked") {
            this.cycles.set(state.cycleId, state);
          }
        } catch {
          /* skip corrupt */
        }
      }
    } catch {
      /* dir not found */
    }
  }

  getActiveCycle(): QACycleState | undefined {
    return [...this.cycles.values()].find((c) => !["done", "blocked"].includes(c.phase));
  }

  createCycle(backlogItem: string): QACycleState {
    const now = new Date().toISOString();
    const state: QACycleState = {
      cycleId: `qa-cycle-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      startedAt: now,
      updatedAt: now,
      backlogItem,
      phase: "read",
      attempts: 0,
    };
    this.cycles.set(state.cycleId, state);
    return state;
  }

  updatePhase(cycleId: string, phase: QAPhase): void {
    const cycle = this.cycles.get(cycleId);
    if (!cycle) return;
    cycle.phase = phase;
    cycle.updatedAt = new Date().toISOString();
    if (["gates", "implement"].includes(phase)) cycle.attempts += 1;
  }

  shouldBlock(cycleId: string): boolean {
    const cycle = this.cycles.get(cycleId);
    if (!cycle) return false;
    return cycle.attempts >= MAX_ATTEMPTS && ["gates", "implement"].includes(cycle.phase);
  }

  blockCycle(cycleId: string, error: string): void {
    const cycle = this.cycles.get(cycleId);
    if (!cycle) return;
    cycle.phase = "blocked";
    cycle.error = error;
    cycle.updatedAt = new Date().toISOString();
  }

  completeCycle(cycleId: string, commitHash?: string): void {
    const cycle = this.cycles.get(cycleId);
    if (!cycle) return;
    cycle.phase = "done";
    if (commitHash !== undefined) {
      cycle.commitHash = commitHash;
    }
    cycle.updatedAt = new Date().toISOString();
  }

  async persist(cycleId: string): Promise<void> {
    const cycle = this.cycles.get(cycleId);
    if (!cycle) return;
    await this.ensureDir();
    const path = join(this.cyclesRoot, `${cycleId}.json`);
    await writeFile(path, JSON.stringify(cycle, null, 2), "utf8");
  }

  getStatus(): Record<string, unknown> {
    const active = this.getActiveCycle();
    const done = [...this.cycles.values()].filter((c) => c.phase === "done");
    const blocked = [...this.cycles.values()].filter((c) => c.phase === "blocked");
    return {
      activeCycle: active ?? null,
      completedCount: done.length,
      blockedCount: blocked.length,
      lastCompleted: done.at(-1) ?? null,
    };
  }
}
