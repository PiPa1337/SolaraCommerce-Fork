/** Verifica el canal JSONL del agente contra el EXE portable real. */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { cp } from "node:fs/promises";
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

const testRoot = mkdtempSync(join(tmpdir(), "solara-agent-e2e-"));
const copy = join(testRoot, "Copia aislada agente");
const storeId = `store-agent-e2e-${Date.now().toString(36)}`;
let child;
const pending = [];
let lineBuffer = "";

function nextResponse() {
  return new Promise((resolveResponse, rejectResponse) => {
    pending.push({ resolve: resolveResponse, reject: rejectResponse });
  });
}

function send(id, method, params) {
  child.stdin.write(
    `${JSON.stringify({ id, method, ...(params === undefined ? {} : { params }) })}\n`,
  );
  return nextResponse();
}

function assertOk(response) {
  if (!response?.ok)
    throw new Error(
      `${response?.error?.code ?? "AGENT_ERROR"}: ${response?.error?.message ?? "respuesta inválida"}`,
    );
  return response.result;
}

try {
  await cp(source, copy, { recursive: true });
  child = spawn(
    join(copy, "SolaraCommerce.exe"),
    [join(copy, "resources", "app.asar", "dist", "agent-cli.cjs"), "--jsonl"],
    {
      cwd: copy,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", SOLARA_PORTABLE_ROOT: copy },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    },
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
        for (const item of pending.splice(0))
          item.reject(new Error(`stdout no protocol JSONL: ${line}`));
        continue;
      }
      const item = pending.shift();
      if (item) item.resolve(value);
    }
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.once("error", (error) => {
    for (const item of pending.splice(0)) item.reject(error);
  });

  const health = assertOk(await send(1, "health"));
  if (health.schemaVersion !== 2 || health.writable !== true)
    throw new Error("health no confirmó schema 2 y escritura.");
  const protocol = assertOk(await send(2, "protocol.describe"));
  if (!protocol.methods.includes("jobs.get") || !protocol.methods.includes("assets.upload.chunk"))
    throw new Error("protocol.describe no documentó jobs y uploads por chunks.");
  const before = assertOk(await send(12, "stores.list"));
  const protectedCandidate = (before.projects ?? []).find(
    (item) => item.projectId === "store-modo-sur-demo",
  );
  const protectedBefore = protectedCandidate
    ? assertOk(
        await send(11, "stores.get", { storeId: protectedCandidate.projectId, include: "catalog" }),
      )
    : undefined;
  const plan = assertOk(
    await send(3, "plans.create", {
      idempotencyKey: `portable-agent-${storeId}`,
      operations: [
        { type: "store.create", storeId, name: "Tienda creada por agente", slug: `${storeId}` },
        {
          type: "category.create",
          categoryId: "category-agent-e2e",
          slug: "seleccion",
          title: "Selección",
          description: "Catálogo de prueba.",
        },
        {
          type: "product.create",
          productId: "product-agent-e2e",
          slug: "producto-prueba",
          title: "Producto de prueba",
          description: "Creado por el protocolo.",
          priceCents: 9900,
          categoryIds: ["category-agent-e2e"],
        },
      ],
    }),
  );
  if (!plan.diff?.products || plan.requiresCommitApproval !== true)
    throw new Error("El plan portable no devolvió diff y aprobación explícita.");
  const planView = assertOk(await send(4, "plans.get", { planId: plan.planId }));
  if (planView.planId !== plan.planId) throw new Error("El plan durable no pudo recuperarse.");
  const job = assertOk(
    await send(5, "plans.commit", {
      planId: plan.planId,
      idempotencyKey: `portable-agent-${storeId}`,
      async: true,
    }),
  );
  let jobView = assertOk(await send(6, "jobs.get", { jobId: job.jobId }));
  for (
    let attempt = 0;
    attempt < 100 && ["queued", "running"].includes(jobView.status);
    attempt += 1
  ) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    jobView = assertOk(await send(7, "jobs.get", { jobId: job.jobId }));
  }
  if (jobView.status !== "succeeded") throw new Error("El job portable no terminó correctamente.");
  const receipt = jobView.result;
  if (receipt.storeId !== storeId) throw new Error("El commit no devolvió el storeId solicitado.");
  const after = assertOk(await send(8, "stores.get", { storeId, include: "catalog" }));
  if (after.counts.products < 1 || after.counts.categories < 1)
    throw new Error("El catálogo clonado y creado por agente no quedó persistido.");
  if (!after.catalog.products.some((product) => product.id === "product-agent-e2e"))
    throw new Error("El producto creado por agente no quedó persistido.");
  if (!after.catalog.categories.some((category) => category.id === "category-agent-e2e"))
    throw new Error("La categoría creada por agente no quedó persistida.");
  if (protectedBefore) {
    const baseProductIds = new Set(protectedBefore.catalog.products.map((product) => product.id));
    const baseCategoryIds = new Set(
      protectedBefore.catalog.categories.map((category) => category.id),
    );
    if (after.catalog.products.some((product) => baseProductIds.has(product.id)))
      throw new Error("La tienda creada por agente compartió IDs de productos con la plantilla.");
    if (after.catalog.categories.some((category) => baseCategoryIds.has(category.id)))
      throw new Error("La tienda creada por agente compartió IDs de categorías con la plantilla.");
  }
  if (after.protected !== false)
    throw new Error("La tienda nueva quedó protegida inesperadamente.");

  if (protectedCandidate) {
    const protectedStore = assertOk(
      await send(9, "stores.get", { storeId: protectedCandidate.projectId, include: "summary" }),
    );
    if (protectedStore.protected !== true)
      throw new Error("La tienda demo no fue marcada como protegida.");
    const response = await send(10, "plans.create", {
      storeId: protectedCandidate.projectId,
      baseVersion: protectedStore.version,
      operations: [{ type: "store.updateIdentity", changes: { description: "no tocar" } }],
    });
    if (response.ok || response.error?.code !== "PROTECTED_STORE")
      throw new Error("La tienda demo aceptó una mutación del agente.");
    const protectedAfter = assertOk(
      await send(14, "stores.get", { storeId: protectedCandidate.projectId, include: "catalog" }),
    );
    if (
      protectedAfter.version !== protectedBefore?.version ||
      JSON.stringify(protectedAfter.catalog) !== JSON.stringify(protectedBefore?.catalog)
    )
      throw new Error("La plantilla cambió durante la creación de la tienda del agente.");
  }
  const audit = assertOk(await send(13, "audit.list", { limit: 20 }));
  if (
    !audit.entries.some(
      (entry) => entry.event === "plan.commit.succeeded" && entry.requestId !== undefined,
    )
  )
    throw new Error("La auditoría portable no registró el commit.");
  child.stdin.end();
  await new Promise((resolveExit, rejectExit) => {
    const timer = setTimeout(() => {
      child.kill();
      rejectExit(new Error("El agente no terminó a tiempo."));
    }, 20_000);
    child.once("error", rejectExit);
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code !== 0) rejectExit(new Error(`El agente terminó ${code}. ${stderr}`));
      else resolveExit();
    });
  });
  const folders = readdirSync(join(copy, "proyectos"));
  if (
    !folders.some((folder) =>
      readFileSync(join(copy, "proyectos", folder, "manifest.json"), "utf8").includes(storeId),
    )
  ) {
    throw new Error("La tienda del agente no apareció en proyectos/.");
  }
  console.log(`portable agent e2e: OK (${storeId})`);
} finally {
  if (child && !child.killed) child.kill();
  if (process.env.SOLARA_KEEP_E2E_ARTIFACTS !== "1")
    rmSync(testRoot, { recursive: true, force: true });
}
