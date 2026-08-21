import "fake-indexeddb/auto";
import { StoreProjectV1Schema } from "@solara/project-schema";
import { buildCatalogModernProject } from "@solara/project-schema/catalog-modern-template";
import { beforeEach, describe, expect, it } from "vitest";
import {
  database,
  getRecoveryDraft,
  saveRecoveryDraft,
  shouldSeedRecoveryDraft,
} from "./repository";

describe("red-team repository - shouldSeedRecoveryDraft", () => {
  it("INV3: con timestamps iguales y diff true debe sembrar (evita divergencia silenciosa)", () => {
    const browser = { updatedAt: "2026-08-07T10:00:00.000Z" };
    const disk = { updatedAt: "2026-08-07T10:00:00.000Z" };
    expect(shouldSeedRecoveryDraft(browser, disk, true)).toBe(true);
    expect(shouldSeedRecoveryDraft(browser, disk, false)).toBe(false);
  });
  it("INV3: browser más nuevo siembra, más viejo no", () => {
    const disk = { updatedAt: "2026-08-07T10:00:00.000Z" };
    expect(shouldSeedRecoveryDraft({ updatedAt: "2026-08-07T11:00:00.000Z" }, disk, true)).toBe(
      true,
    );
    expect(shouldSeedRecoveryDraft({ updatedAt: "2026-08-07T09:00:00.000Z" }, disk, true)).toBe(
      false,
    );
  });
});

describe("red-team repository - saveRecoveryDraft no sobrescribe más nuevo", () => {
  beforeEach(async () => {
    await database.recoveryDrafts.clear();
  });
  it("INV3: no sobrescribe borrador más nuevo con uno más viejo", async () => {
    const base = buildCatalogModernProject({
      seed: "clean",
      id: "store-recovery-test",
      name: "Test",
      slug: "test",
    });
    const newer = StoreProjectV1Schema.parse({ ...base, updatedAt: "2026-08-07T12:00:00.000Z" });
    const older = StoreProjectV1Schema.parse({ ...base, updatedAt: "2026-08-07T11:00:00.000Z" });
    await saveRecoveryDraft(newer, 1);
    const first = await getRecoveryDraft(newer.id);
    expect(first?.project.updatedAt).toBe("2026-08-07T12:00:00.000Z");
    await saveRecoveryDraft(older, 1);
    const second = await getRecoveryDraft(newer.id);
    expect(second?.project.updatedAt).toBe("2026-08-07T12:00:00.000Z");
    expect(second?.project.updatedAt).not.toBe("2026-08-07T11:00:00.000Z");
  });
  it("INV3: no sobrescribe borrador anclado a disco más nuevo", async () => {
    const base = buildCatalogModernProject({
      seed: "clean",
      id: "store-recovery-test2",
      name: "Test2",
      slug: "test2",
    });
    const first = StoreProjectV1Schema.parse({ ...base, updatedAt: "2026-08-07T12:00:00.000Z" });
    const second = StoreProjectV1Schema.parse({ ...base, updatedAt: "2026-08-07T12:00:00.000Z" });
    await saveRecoveryDraft(first, 2);
    await saveRecoveryDraft(second, 1);
    const draft = await getRecoveryDraft(first.id);
    expect(draft?.baseDiskVersion).toBe(2);
  });
});
