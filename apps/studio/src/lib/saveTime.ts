/** Formatea un timestamp como hora local corta (HH:MM) para el indicador de guardado. */
export function formatSaveTime(timestamp: number): string {
  return new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" }).format(timestamp);
}
