/** Verifica el transporte MCP del agente contra el EXE portable real. */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = resolve(
  process.env.SOLARA_AGENT_SOURCE ?? join(root, ".release/portable/SolaraCommerce-Portable"),
);
const executable = join(source, "SolaraCommerce.exe");
if (!existsSync(executable))
  throw new Error("No existe el portable. Ejecutá `pnpm desktop:package` primero.");

const testRoot = mkdtempSync(join(tmpdir(), "solara-agent-mcp-e2e-"));
const copy = join(testRoot, "Copia aislada MCP");
const storeId = `store-agent-mcp-${Date.now().toString(36)}`;
let child;
let stderr = "";
let lineBuffer = "";
let nextId = 1;
let pending = [];

function request(payload) {
  const response = new Promise((resolveResponse, rejectResponse) => {
    pending.push({ resolve: resolveResponse, reject: rejectResponse });
  });
  child.stdin.write(`${JSON.stringify(payload)}\n`);
  return response;
}

function assertResponse(response) {
  if (!response || response.jsonrpc !== "2.0")
    throw new Error("El agente MCP devolvió una respuesta JSON-RPC inválida.");
  if (response.error)
    throw new Error(
      `${response.error.data?.code ?? "MCP_ERROR"}: ${response.error.message ?? "error MCP"}`,
    );
  return response.result;
}

async function callTool(name, args = {}) {
  const result = assertResponse(
    await request({
      jsonrpc: "2.0",
      id: nextId++,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  );
  if (!result || result.isError !== false || !result.structuredContent)
    throw new Error(`La herramienta ${name} no devolvió structuredContent exitoso.`);
  return result.structuredContent;
}

function storeFolder(folder, projectId) {
  const entry = readdirSync(join(folder, "proyectos"), { withFileTypes: true }).find(
    (candidate) => {
      if (!candidate.isDirectory()) return false;
      try {
        const manifest = JSON.parse(
          readFileSync(join(folder, "proyectos", candidate.name, "manifest.json"), "utf8"),
        );
        return manifest.projectId === projectId;
      } catch {
        return false;
      }
    },
  );
  if (!entry) throw new Error(`No se encontró la carpeta de la tienda ${projectId}.`);
  return join(folder, "proyectos", entry.name);
}

function readProject(folder, projectId) {
  const directory = storeFolder(folder, projectId);
  const manifest = JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8"));
  const projectPath = manifest.current?.projectPath;
  if (typeof projectPath !== "string")
    throw new Error(`La tienda ${projectId} no tiene proyecto actual.`);
  const stored = JSON.parse(readFileSync(join(directory, projectPath), "utf8"));
  return stored.project ?? stored;
}

function protectedSnapshot(value) {
  return JSON.stringify({
    id: value.id,
    version: value.version,
    protected: value.protected,
    catalog: value.catalog,
  });
}

function startAgent() {
  pending = [];
  lineBuffer = "";
  stderr = "";
  const spawnOptions = {
    cwd: copy,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", SOLARA_PORTABLE_ROOT: copy },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  };
  child =
    process.env.SOLARA_AGENT_USE_WRAPPER === "1"
      ? spawn(`"${join(copy, "SolaraCommerce-Agent.cmd")}" --mcp`, [], {
          ...spawnOptions,
          shell: true,
        })
      : spawn(
          join(copy, "SolaraCommerce.exe"),
          [join(copy, "resources", "app.asar", "dist", "agent-cli.cjs")],
          spawnOptions,
        );
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    lineBuffer += chunk;
    const lines = lineBuffer.split(/\r?\n/);
    lineBuffer = lines.pop() ?? "";
    for (const line of lines.filter(Boolean)) {
      let value;
      try {
        value = JSON.parse(line);
      } catch {
        for (const item of pending.splice(0)) item.reject(new Error(`stdout no JSON-RPC: ${line}`));
        continue;
      }
      const item = pending.shift();
      if (item) item.resolve(value);
    }
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.once("exit", (code, signal) => {
    if (pending.length === 0) return;
    const error = new Error(
      `El agente MCP terminó antes de responder (${code ?? "signal"} ${signal ?? ""}). ${stderr}`,
    );
    for (const item of pending.splice(0)) item.reject(error);
  });
  child.on("error", (error) => {
    for (const item of pending.splice(0)) item.reject(error);
  });
}

async function stopAgent() {
  const instance = child;
  child = undefined;
  if (!instance) return;
  instance.stdin.end();
  await new Promise((resolveExit, rejectExit) => {
    const timer = setTimeout(() => {
      instance.kill();
      rejectExit(new Error(`El agente MCP no terminó a tiempo. ${stderr}`));
    }, 20_000);
    instance.once("error", rejectExit);
    instance.once("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0) rejectExit(new Error(`El agente MCP terminó ${code}. ${stderr}`));
      else resolveExit();
    });
  });
}

try {
  await cp(source, copy, { recursive: true });
  await rm(join(copy, ".solara-runtime"), { recursive: true, force: true });

  startAgent();
  const initialized = assertResponse(
    await request({
      jsonrpc: "2.0",
      id: nextId++,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "nightwatch", version: "1" },
      },
    }),
  );
  if (initialized.protocolVersion !== "2024-11-05")
    throw new Error("initialize no confirmó la versión MCP esperada.");
  child.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');

  const health = await callTool("solara_health");
  if (health.schemaVersion !== 2 || health.writable !== true)
    throw new Error("health MCP no confirmó schema 2 y escritura.");

  const protocol = await callTool("solara_protocol_describe");
  if (
    !protocol.methods.includes("assets.generatePlaceholder") ||
    !protocol.methods.includes("qa.runExport")
  )
    throw new Error("protocol.describe MCP no documentó todos los métodos de QA y assets.");

  const toolsList = assertResponse(
    await request({ jsonrpc: "2.0", id: nextId++, method: "tools/list", params: {} }),
  );
  const tools = toolsList?.tools ?? [];
  const toolNames = tools.map((tool) => tool.name);
  if (new Set(toolNames).size !== toolNames.length || tools.length !== protocol.methods.length)
    throw new Error(
      `tools/list MCP no coincide: tools=${tools.length}, methods=${protocol.methods.length}, names=${toolNames.join(",")}`,
    );
  for (const required of [
    "solara_asset_generate_placeholder",
    "solara_qa_run_export",
    "solara_plan_commit",
  ]) {
    if (!toolNames.includes(required)) throw new Error(`Falta la herramienta MCP ${required}.`);
  }

  const before = await callTool("solara_stores_list");
  const protectedCandidate = (before.projects ?? []).find(
    (item) => item.projectId === "store-modo-sur-demo",
  );
  const protectedBefore = protectedCandidate
    ? await callTool("solara_store_get", {
        storeId: protectedCandidate.projectId,
        include: "catalog",
      })
    : undefined;

  const asset = await callTool("solara_asset_generate_placeholder", {
    name: "mcp-placeholder.png",
    alt: "Placeholder MCP",
    seed: storeId,
  });
  const plan = await callTool("solara_plan_create", {
    idempotencyKey: `mcp-e2e-${storeId}`,
    operations: [
      {
        type: "store.create",
        storeId,
        name: "Tienda MCP Nightwatch",
        slug: storeId,
        source: { kind: "clean" },
      },
      {
        type: "product.create",
        productId: "product-mcp-e2e",
        slug: "producto-mcp",
        title: "Producto MCP",
        description: "Creado por el transporte MCP.",
        priceCents: 4200,
        imageIds: [asset.assetId],
      },
    ],
  });
  if (!plan.planId || plan.requiresCommitApproval !== true)
    throw new Error("plans.create MCP no devolvió un plan durable con aprobación.");
  const planView = await callTool("solara_plan_get", { planId: plan.planId });
  if (planView.planId !== plan.planId) throw new Error("plans.get MCP no recuperó el plan.");
  const receipt = await callTool("solara_plan_commit", {
    planId: plan.planId,
    idempotencyKey: `mcp-e2e-${storeId}`,
    async: false,
  });
  if (receipt.storeId !== storeId || receipt.version !== 1)
    throw new Error("plans.commit MCP no persistió la tienda nueva.");

  const after = await callTool("solara_store_get", { storeId, include: "catalog" });
  if (
    after.protected !== false ||
    !after.catalog.products.some((item) => item.id === "product-mcp-e2e")
  )
    throw new Error("La tienda MCP no conservó el producto creado.");
  const audit = await callTool("solara_audit_list", { limit: 50 });
  if (!audit.entries.some((entry) => entry.event === "plan.commit.succeeded"))
    throw new Error("La auditoría MCP no registró el commit.");

  const unknown = await request({
    jsonrpc: "2.0",
    id: nextId++,
    method: "tools/call",
    params: { name: "solara_unknown_tool", arguments: {} },
  });
  if (
    unknown.error?.data?.code !== "METHOD_NOT_FOUND" ||
    String(unknown.error.message).includes(" at ")
  )
    throw new Error("MCP no rechazó la herramienta desconocida de forma segura.");

  await stopAgent();
  startAgent();
  const reopenedHealth = await callTool("solara_health");
  const reopened = await callTool("solara_store_get", { storeId, include: "catalog" });
  if (reopenedHealth.schemaVersion !== 2 || reopened.catalog.products.length !== 1)
    throw new Error("La reapertura MCP no recuperó la persistencia del catálogo.");
  if (protectedCandidate) {
    const protectedAfter = await callTool("solara_store_get", {
      storeId: protectedCandidate.projectId,
      include: "catalog",
    });
    if (protectedSnapshot(protectedAfter) !== protectedSnapshot(protectedBefore))
      throw new Error("La plantilla protegida cambió durante la prueba MCP.");
  }
  await stopAgent();

  const persisted = readProject(copy, storeId);
  if (persisted.products.length !== 1 || persisted.products[0]?.id !== "product-mcp-e2e")
    throw new Error("La tienda MCP no quedó en el respaldo editable del portable.");
  console.log(`portable agent MCP e2e: OK (${storeId}, tools=${tools.length})`);
} finally {
  if (child && !child.killed) child.kill();
  pending = [];
  rmSync(testRoot, { recursive: true, force: true });
}
