/**
 * Puente mínimo entre Studio y el proceso principal. No expone `fs`, Node ni
 * Electron: sólo las operaciones explícitas que el shell portable necesita
 * (diagnóstico y apertura del sitio). El Studio web sigue usando sus endpoints
 * HTTP habituales.
 */
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("solaraDesktop", {
  openSite: (projectId) => ipcRenderer.invoke("solara:open-site", projectId),
  diagnostics: () => ipcRenderer.invoke("solara:diagnostics"),
});
