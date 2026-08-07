/**
 * Puente mínimo entre Studio y el proceso principal. No expone `fs`, Node ni
 * Electron: sólo operaciones explícitas que la UI puede necesitar en modo
 * portable. El Studio web sigue usando sus endpoints HTTP habituales.
 */
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("solaraDesktop", {
  getStatus: () => ipcRenderer.invoke("solara:status"),
  close: () => ipcRenderer.invoke("solara:close"),
  openSite: (projectId) => ipcRenderer.invoke("solara:open-site", projectId),
  diagnostics: () => ipcRenderer.invoke("solara:diagnostics"),
});
