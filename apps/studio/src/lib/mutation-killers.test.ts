import "fake-indexeddb/auto";
import { StoreProjectV1Schema } from "@solara/project-schema";
import { referenceStore } from "@solara/project-schema/fixture";
import { describe, expect, it } from "vitest";
import {
  database,
  getRecoveryDraft,
  saveRecoveryDraft,
  shouldSeedRecoveryDraft,
} from "./repository";

describe("mutation-killers: repository / persistencia", () => {
  it("shouldSeedRecoveryDraft requiere diff true y updatedAt >= (mutacion >= a >)", () => {
    const disk = { updatedAt: "2026-08-01T10:00:00.000Z" };
    const browserEqual = { updatedAt: "2026-08-01T10:00:00.000Z" };
    const browserNewer = { updatedAt: "2026-08-02T10:00:00.000Z" };
    // igual timestamp pero diff true debe sembrar (evidencia de edicion sin cambio de timestamp?)
    expect(shouldSeedRecoveryDraft(browserEqual, disk, true)).toBe(true);
    expect(shouldSeedRecoveryDraft(browserNewer, disk, true)).toBe(true);
    expect(shouldSeedRecoveryDraft(disk, browserNewer, true)).toBe(false);
    expect(shouldSeedRecoveryDraft(browserNewer, disk, false)).toBe(false);
    // mutacion que cambie >= a > haria fallar el primer expect
    expect(shouldSeedRecoveryDraft(browserEqual, disk, false)).toBe(false);
  });

  it("recoveryDraft no sobrescribe silenciosamente version mas nueva", async () => {
    await database.recoveryDrafts.clear();
    const project = StoreProjectV1Schema.parse({
      ...referenceStore,
      updatedAt: "2026-08-02T10:00:00.000Z",
    });
    await saveRecoveryDraft(project, 5);
    const first = await getRecoveryDraft(project.id);
    expect(first?.baseDiskVersion).toBe(5);
    // intentar sobrescribir con version mas vieja y fecha igual debe ser ignorado
    const older = StoreProjectV1Schema.parse({
      ...referenceStore,
      updatedAt: "2026-08-02T10:00:00.000Z",
    });
    await saveRecoveryDraft(older, 3);
    const after = await getRecoveryDraft(project.id);
    // si mutacion quitara el guard de version, after.baseDiskVersion sería 3
    expect(after?.baseDiskVersion).toBe(5);
    await database.recoveryDrafts.clear();
  });

  it("saveRecoveryDraft actualiza cuando version es mayor", async () => {
    await database.recoveryDrafts.clear();
    const p1 = StoreProjectV1Schema.parse({
      ...referenceStore,
      updatedAt: "2026-08-02T10:00:00.000Z",
    });
    await saveRecoveryDraft(p1, 1);
    const p2 = StoreProjectV1Schema.parse({
      ...referenceStore,
      updatedAt: "2026-08-03T10:00:00.000Z",
    });
    await saveRecoveryDraft(p2, 2);
    const after = await getRecoveryDraft(p1.id);
    expect(after?.baseDiskVersion).toBe(2);
    expect(after?.project.updatedAt).toBe("2026-08-03T10:00:00.000Z");
    await database.recoveryDrafts.clear();
  });
});
