/**
 * Entrada de consola del portable. Electron en Windows usa un subsistema GUI
 * y puede perder stdin cuando arranca el main de la aplicación; este entry
 * se ejecuta con ELECTRON_RUN_AS_NODE=1 para conservar stdio real sin abrir
 * BrowserWindow ni inicializar el proceso gráfico.
 */

import { createLocalProjectStorage } from "../../../packages/exporter/scripts/local-project-storage.mjs";
import { resolvePortableLayout } from "../../../packages/exporter/scripts/portable-layout.mjs";
import { runAgentHost } from "./agent-host.mjs";

function resolveScopes() {
  if (process.argv.includes("--read-only")) return ["read", "audit:read"];
  const configured = process.argv
    .find((argument) => argument.startsWith("--scopes="))
    ?.slice("--scopes=".length);
  if (configured) return configured.split(",").filter(Boolean);
  if (process.env.SOLARA_AGENT_SCOPES) {
    return process.env.SOLARA_AGENT_SCOPES.split(",").filter(Boolean);
  }
  return undefined;
}

async function main() {
  const portableRoot = process.env.SOLARA_PORTABLE_ROOT;
  const layout = resolvePortableLayout({
    mode: portableRoot ? "development" : "packaged",
    cwd: portableRoot ?? process.cwd(),
    executablePath: process.execPath,
  });
  const storage = createLocalProjectStorage({
    applicationRoot: layout.portableRoot,
    projectsRoot: layout.projectsRoot,
    stagingRoot: layout.transactionRoot,
  });
  await storage.ensureRoots();
  await runAgentHost({
    storage,
    applicationRoot: layout.portableRoot,
    appVersion: "portable-agent-v1",
    mode: process.argv.includes("--jsonl") ? "jsonl" : "mcp",
    scopes: resolveScopes(),
  });
}

void main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
});
