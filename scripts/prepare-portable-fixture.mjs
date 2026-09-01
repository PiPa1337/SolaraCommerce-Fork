/**
 * Prepara la plantilla protegida que el E2E portable espera encontrar en una
 * distribución recién empaquetada. Es una fixture de CI: no forma parte del
 * arranque de la app ni modifica el checkout persistente del desarrollador.
 */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createLocalProjectStorage } from "../packages/exporter/scripts/local-project-storage.mjs";
import {
  createProjectArchive,
  EXPORTER_RENDERER_FINGERPRINT,
  exportProject,
} from "../packages/exporter/src/index.ts";
import { buildCatalogModernProject } from "../packages/project-schema/src/catalog-modern-template.ts";

const portableRoot = resolve(
  process.env.SOLARA_PORTABLE_ROOT ?? ".release/portable/SolaraCommerce-Portable",
);
const projectId = "store-modo-sur-demo";

if (!existsSync(join(portableRoot, "SolaraCommerce.exe"))) {
  throw new Error(`No existe la distribución portable en ${portableRoot}.`);
}

function bytesStream(bytes) {
  return {
    async *[Symbol.asyncIterator]() {
      yield bytes;
    },
  };
}

function serializeSiteFiles(files) {
  return JSON.stringify(
    [...files.entries()].map(([path, value]) =>
      typeof value === "string"
        ? { path, encoding: "utf8", data: value }
        : { path, encoding: "base64", data: Buffer.from(value).toString("base64") },
    ),
  );
}

const storage = createLocalProjectStorage({ applicationRoot: portableRoot });
await storage.ensureRoots();
const existing = await storage.list();
if (existing.projects.some((project) => project.projectId === projectId)) {
  console.log("portable demo fixture: ya existe");
} else {
  const project = buildCatalogModernProject({
    seed: "demo",
    id: projectId,
    name: "Predeterminado",
    slug: "demo-catalogo-jerarquico",
    baseUrl: "https://demo-catalogo-jerarquico.example",
  });
  const exported = exportProject(project, { mode: "production" });
  const transaction = await storage.beginSave({
    projectId: project.id,
    name: project.name,
    slug: project.slug,
    projectUpdatedAt: project.updatedAt,
    expectedVersion: null,
    actor: { kind: "template-upgrade", id: "ci-portable-demo-seed" },
    allowProtectedWrite: true,
    rendererFingerprint: EXPORTER_RENDERER_FINGERPRINT,
  });
  try {
    await storage.upload(
      transaction.transactionId,
      "project",
      bytesStream(new TextEncoder().encode(createProjectArchive(project))),
    );
    await storage.upload(
      transaction.transactionId,
      "site",
      bytesStream(new TextEncoder().encode(serializeSiteFiles(exported.files))),
    );
    await storage.commit(transaction.transactionId);
  } catch (error) {
    await storage.abort(transaction.transactionId).catch(() => undefined);
    throw error;
  }
  console.log(
    `portable demo fixture: creada (${project.products.length} productos, ${exported.files.size} archivos)`,
  );
}
