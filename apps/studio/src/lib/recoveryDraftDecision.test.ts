import { describe, expect, it, vi } from "vitest";
import { resolveRecoveryDraftDecision } from "./recoveryDraftDecision";

describe("resolveRecoveryDraftDecision", () => {
  const diskProject = { id: "store-demo", source: "disk" };
  const draftProject = { id: "store-demo", source: "draft" };

  it("conserva el RecoveryDraft al cerrar neutralmente", async () => {
    const clearDraft = vi.fn(async () => undefined);

    const project = await resolveRecoveryDraftDecision(
      "keep",
      diskProject,
      draftProject,
      clearDraft,
    );

    expect(project).toBe(diskProject);
    expect(clearDraft).not.toHaveBeenCalled();
  });

  it("recupera el borrador sin borrarlo", async () => {
    const clearDraft = vi.fn(async () => undefined);

    const project = await resolveRecoveryDraftDecision(
      "recover",
      diskProject,
      draftProject,
      clearDraft,
    );

    expect(project).toBe(draftProject);
    expect(clearDraft).not.toHaveBeenCalled();
  });

  it("borra el RecoveryDraft únicamente ante descarte explícito", async () => {
    const clearDraft = vi.fn(async () => undefined);

    const project = await resolveRecoveryDraftDecision(
      "discard",
      diskProject,
      draftProject,
      clearDraft,
    );

    expect(project).toBe(diskProject);
    expect(clearDraft).toHaveBeenCalledOnce();
    expect(clearDraft).toHaveBeenCalledWith("store-demo");
  });
});
