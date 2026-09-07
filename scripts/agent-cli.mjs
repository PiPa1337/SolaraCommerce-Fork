/** Entrada de consola del agente local de SolaraCommerce sobre Node.js. */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveLocalLayout } from "../packages/exporter/scripts/local-layout.mjs";
import { createLocalProjectStorage } from "../packages/exporter/scripts/local-project-storage.mjs";
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
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const applicationRoot = resolve(
    process.env.SOLARA_APPLICATION_ROOT ?? resolve(scriptDirectory, ".."),
  );
  const layout = resolveLocalLayout({ applicationRoot });
  const storage = createLocalProjectStorage({
    applicationRoot: layout.applicationRoot,
    projectsRoot: layout.projectsRoot,
    stagingRoot: layout.transactionRoot,
  });
  await storage.ensureRoots();
  await runAgentHost({
    storage,
    applicationRoot: layout.applicationRoot,
    appVersion: "node-agent-v1",
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
