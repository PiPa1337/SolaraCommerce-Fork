/**
 * Proceso principal de la distribución portable Windows.
 *
 * La ventana carga Studio desde `solara://studio/`; el renderer no obtiene
 * acceso a filesystem. El handler de requests compartido mantiene el mismo
 * contrato `/__solara/*` que el launcher HTTP de desarrollo.
 */

import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from "electron";
import {
  ensurePortableLayout,
  resolvePortableLayout,
} from "../../../packages/exporter/scripts/portable-layout.mjs";
import {
  createSolaraRequestHandler,
  resolveStaticFile,
} from "../../../packages/exporter/scripts/solara-request-handler.mjs";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "solara",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

// Fuerza composición por software antes de que Chromium cree el proceso GPU.
// Algunas máquinas Windows no tienen las DLL/controladores esperados por la
// versión embebida de Chromium y, sin este switch temprano, la app termina
// antes de poder mostrar el error o cargar Studio.
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.commandLine.appendSwitch("in-process-gpu");

const bundleRoot =
  typeof __dirname === "string" ? __dirname : dirname(fileURLToPath(import.meta.url));
const isPackaged = app.isPackaged || process.env.SOLARA_PACKAGED === "1";
const layout = resolvePortableLayout({
  mode: isPackaged ? "packaged" : "development",
  cwd: process.env.SOLARA_PORTABLE_ROOT ?? process.cwd(),
  executablePath: process.execPath,
});
const smokeMode = process.argv.includes("--solara-smoke");
let mainWindow;
let requestHandler;
let shuttingDown = false;

// Los paths se fijan antes de `ready`, pero las carpetas se crean dentro de
// `start()` para que un disco sin permisos termine en el diálogo accionable de
// arranque en vez de provocar una excepción síncrona del proceso principal.
app.setPath("userData", layout.profileRoot);
app.setPath("sessionData", join(layout.profileRoot, "session"));
app.setPath("crashDumps", join(layout.runtimeRoot, "crash-dumps"));
// Electron puede guardar sus logs de aplicación fuera de `userData` si no se
// fija explícitamente. Mantenerlos dentro del runtime hace que una copia
// portable no deje rastros en AppData ni mezcle diagnósticos entre copias.
app.setAppLogsPath(layout.logsRoot);
// La distribución debe iniciar también en equipos sin un controlador GPU
// compatible. Chromium conserva composición acelerada en el navegador externo;
// Studio prioriza una apertura determinista dentro de la carpeta portable.
app.disableHardwareAcceleration();

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  void start();
}

async function log(message, error) {
  try {
    await mkdir(layout.logsRoot, { recursive: true });
    const suffix = error ? ` ${error instanceof Error ? error.stack : String(error)}` : "";
    await appendFile(
      join(layout.logsRoot, "main.log"),
      `${new Date().toISOString()} ${message}${suffix}\n`,
    );
  } catch {
    // Un fallo de logging no debe impedir que la aplicación guarde proyectos.
  }
}

async function start() {
  try {
    await ensurePortableLayout(layout, { appVersion: app.getVersion() });
    await app.whenReady();

    requestHandler = createSolaraRequestHandler({
      staticRoot: resolve(bundleRoot, "studio"),
      applicationRoot: layout.portableRoot,
      projectsRoot: layout.projectsRoot,
      transactionRoot: layout.transactionRoot,
      managed: true,
      origin: "solara://studio",
      protocolOrigin: "solara://studio",
      allowProtocolOrigin: true,
      onShutdown: shutdown,
    });
    await requestHandler.storage.cleanupStaging();

    protocol.handle("solara", async (request) => {
      try {
        const url = new URL(request.url);
        const requestHeaders = Object.fromEntries(request.headers.entries());
        // Electron no siempre reenvía Origin para un esquema propio. El
        // adaptador fija el origen que ya fue validado por protocol.handle.
        requestHeaders.origin = "solara://studio";
        if (!url.pathname.startsWith("/__solara/")) {
          const staticFile = resolveStaticFile(resolve(bundleRoot, "studio"), url.pathname, {
            fallbackToIndex: true,
          });
          if (!staticFile) return new Response("Not found", { status: 404 });
          // net.fetch entrega al protocolo una respuesta nativa de Chromium;
          // evita conversiones de Buffer que algunos builds de Electron
          // rechazan al cargar el documento inicial.
          try {
            return await net.fetch(pathToFileURL(staticFile).href);
          } catch (error) {
            await log("No se pudo servir recurso estático", error);
            return new Response("No se pudo cargar el recurso.", { status: 500 });
          }
        }
        const result = await requestHandler.handle({
          method: request.method,
          pathname: `${url.pathname}${url.search}`,
          headers: requestHeaders,
          body: request.body,
        });
        const responseBody =
          typeof result.body === "string"
            ? result.body
            : result.body.buffer.slice(
                result.body.byteOffset,
                result.body.byteOffset + result.body.byteLength,
              );
        return new Response(responseBody, { status: result.status, headers: result.headers });
      } catch (error) {
        await log("Error atendiendo solara://", error);
        return new Response(JSON.stringify({ ok: false, error: "Error del protocolo local." }), {
          status: 500,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      }
    });

    registerIpc();
    createWindow();
    await log(`SolaraCommerce iniciado en ${layout.portableRoot}`);
  } catch (error) {
    await log("No se pudo iniciar SolaraCommerce", error);
    await app.whenReady();
    dialog.showErrorBox(
      "No se pudo iniciar SolaraCommerce",
      error instanceof Error ? error.message : String(error),
    );
    app.quit();
  }
}

function registerIpc() {
  ipcMain.handle("solara:diagnostics", () => ({
    appVersion: app.getVersion(),
    portableRoot: layout.portableRoot,
    profileRoot: layout.profileRoot,
  }));
  ipcMain.handle("solara:open-site", async (_event, projectId) => {
    if (typeof projectId !== "string") throw new Error("ID de tienda inválido.");
    const result = await requestHandler.handle({
      method: "POST",
      pathname: `/__solara/storage/projects/${encodeURIComponent(projectId)}/open-site`,
      headers: { origin: "solara://studio" },
      body: new Uint8Array(),
    });
    if (result.status >= 400) throw new Error(String(result.body));
    return JSON.parse(String(result.body)).url;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    // 1024×700 es el mínimo que mantiene el layout del editor sin romperse;
    // por debajo los paneles laterales ya no entran. El default sigue en
    // 1440×900, el tamaño en el que se desarrolló y verificó el Studio.
    minWidth: 1024,
    minHeight: 700,
    show: !smokeMode,
    backgroundColor: "#171b18",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // backgroundThrottling: true es el default de Electron (los timers y
      // rAF del renderer se ralentizan con la ventana oculta o minimizada).
      // Se declara explícito para que nadie lo desactive sin revisarlo.
      backgroundThrottling: true,
      // Electron 37 en Windows no completa la navegación de un protocolo
      // privilegiado con sandbox=true. La superficie sigue aislada por
      // contextIsolation y nodeIntegration=false; se documenta esta excepción.
      sandbox: false,
      preload: resolve(bundleRoot, "preload.cjs"),
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("solara://studio")) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    }
  });
  // Un renderer caído no debe terminar en un cierre silencioso: el usuario
  // recibe un diálogo con la causa y la salida sugerida antes de recargar.
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    if (shuttingDown || !mainWindow) return;
    void log(`El editor dejó de funcionar: ${details.reason}`);
    dialog.showErrorBox(
      "SolaraCommerce dejó de responder",
      `El editor se detuvo inesperadamente (motivo: ${details.reason}).\n\n` +
        "Aceptá para recargarlo, o cerrá la ventana y volvé a abrir " +
        "SolaraCommerce. El progreso guardado en proyectos/ está a salvo.",
    );
    if (!mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.reload();
    }
  });
  mainWindow.webContents.on("unresponsive", () => {
    if (shuttingDown || !mainWindow) return;
    void log("El editor no responde");
    dialog.showErrorBox(
      "SolaraCommerce no responde",
      "El editor dejó de responder.\n\n" +
        "Si no se recupera en unos segundos, cerrá la ventana y volvé a abrir " +
        "SolaraCommerce para recargarlo.",
    );
  });
  mainWindow
    .loadURL("solara://studio/")
    .catch((error) => void log("No se pudo cargar Studio", error));
  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
  if (smokeMode) {
    mainWindow.webContents.once("did-finish-load", () =>
      setTimeout(() => void shutdown(), 250).unref(),
    );
    setTimeout(() => void shutdown(), 3000).unref();
  }
}

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  await requestHandler?.close();
  await log("SolaraCommerce cerrado");
  app.quit();
}

app.on("before-quit", () => {
  if (!shuttingDown) {
    shuttingDown = true;
    void requestHandler?.close();
  }
});
app.on("window-all-closed", () => void shutdown());
