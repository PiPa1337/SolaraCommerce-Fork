import type { ExportMode } from "@solara/exporter";

export interface DesktopExportFile {
  path: string;
  data: string | Uint8Array;
}

export interface DesktopExportResult {
  cancelled: boolean;
  folder?: string;
  parentFolder?: string;
  mode?: ExportMode;
  revision?: string;
  filesWritten?: number;
}

export interface DesktopProjectArchiveResult {
  cancelled: boolean;
  path?: string;
}

interface DesktopExportBridge {
  exportSite(payload: {
    storeSlug: string;
    mode: ExportMode;
    revision?: string;
    files: DesktopExportFile[];
  }): Promise<DesktopExportResult>;
  saveProjectArchive(payload: {
    filename: string;
    data: string | Uint8Array;
  }): Promise<DesktopProjectArchiveResult>;
  agentCall?(payload: {
    method: string;
    params?: unknown;
    requestId?: string | number;
  }): Promise<unknown>;
}

/** El navegador normal no tiene acceso al selector nativo ni al filesystem. */
export function getDesktopExportBridge(): DesktopExportBridge | undefined {
  if (typeof window === "undefined") return undefined;
  const candidate = (window as Window & { solaraDesktop?: DesktopExportBridge }).solaraDesktop;
  return candidate && typeof candidate.exportSite === "function" ? candidate : undefined;
}

export interface DesktopAgentBridge {
  agentCall(payload: {
    method: string;
    params?: unknown;
    requestId?: string | number;
  }): Promise<unknown>;
}

/** El panel administrativo sólo usa el controlador nativo, nunca filesystem. */
export function getDesktopAgentBridge(): DesktopAgentBridge | undefined {
  if (typeof window === "undefined") return undefined;
  const candidate = (window as Window & { solaraDesktop?: DesktopAgentBridge }).solaraDesktop;
  return candidate && typeof candidate.agentCall === "function" ? candidate : undefined;
}
