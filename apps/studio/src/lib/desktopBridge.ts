import type { ExportMode } from "@solara/exporter";

export interface DesktopExportFile {
  path: string;
  data: string | Uint8Array;
}

export interface DesktopExportResult {
  cancelled: boolean;
  folder?: string;
  filesWritten?: number;
}

interface DesktopExportBridge {
  exportSite(payload: {
    storeSlug: string;
    mode: ExportMode;
    files: DesktopExportFile[];
  }): Promise<DesktopExportResult>;
}

/** El navegador normal no tiene acceso al selector nativo ni al filesystem. */
export function getDesktopExportBridge(): DesktopExportBridge | undefined {
  if (typeof window === "undefined") return undefined;
  const candidate = (window as Window & { solaraDesktop?: DesktopExportBridge }).solaraDesktop;
  return candidate && typeof candidate.exportSite === "function" ? candidate : undefined;
}
