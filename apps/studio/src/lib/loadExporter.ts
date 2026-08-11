export type ExporterModule = typeof import("@solara/exporter");

function failedModuleUrl(reason: unknown): string | null {
  const message = reason instanceof Error ? reason.message : String(reason);
  const match = message.match(/https?:\/\/[^\s]+/);
  if (!match) return null;

  const candidate = match[0].replace(/[),.'"`]+$/, "");
  try {
    const url = new URL(
      candidate,
      typeof window === "undefined" ? undefined : window.location.href,
    );
    if (typeof window !== "undefined" && url.origin !== window.location.origin) return null;
    if (!url.pathname.endsWith(".js")) return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Carga el renderer del Studio y evita el cache de un import dinámico fallido
 * cuando el usuario pide reintentar. El primer intento conserva el chunk
 * normal de Vite; sólo el reintento usa la URL que el navegador reportó.
 */
export async function loadExporter(retryAttempt = 0): Promise<ExporterModule> {
  try {
    return await import("@solara/exporter");
  } catch (reason) {
    if (retryAttempt <= 0) throw reason;
    const moduleUrl = failedModuleUrl(reason);
    if (!moduleUrl) throw reason;
    const retryUrl = new URL(moduleUrl);
    retryUrl.searchParams.set("solara-retry", String(retryAttempt));
    return import(/* @vite-ignore */ retryUrl.href);
  }
}
