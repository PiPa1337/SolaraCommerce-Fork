/**
 * Mensajes del respaldo masivo del dashboard. La decisión de éxito total vs.
 * fallos parciales se mantiene pura para poder testearla sin la UI.
 */
export interface BulkBackupOutcome {
  total: number;
  failed: number;
  firstError?: string;
}

export function bulkBackupToastMessage(outcome: BulkBackupOutcome): string {
  if (outcome.failed === 0) return `Se crearon ${outcome.total} respaldos en proyectos/.`;
  const done = outcome.total - outcome.failed;
  const firstError = outcome.firstError ?? "No se pudo crear el respaldo.";
  return `Se crearon ${done} de ${outcome.total} respaldos; revisá los errores (el primero: ${firstError}).`;
}
