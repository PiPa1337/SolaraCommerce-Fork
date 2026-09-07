export type RecoveryDraftDecision = "recover" | "keep" | "discard";

export async function resolveRecoveryDraftDecision<T extends { id: string }>(
  decision: RecoveryDraftDecision,
  diskProject: T,
  draftProject: T,
  clearDraft: (projectId: string) => Promise<unknown>,
): Promise<T> {
  if (decision === "recover") return draftProject;
  if (decision === "discard") await clearDraft(diskProject.id);
  return diskProject;
}
