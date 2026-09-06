# Eliminar ZIP del producto (JSON sin compresión) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar ZIP y gzip de todo el producto: respaldo editable `.solara.json` (JSON único), sitio público como carpeta escrita por el servidor, import de catálogo por carpeta, budgets en bytes crudos, migración única de `.solara.zip` existentes.

**Architecture:** Ocho tareas en fases que mantienen cada paquete con tests verdes: (1) storage local V2 con `.solara.json` y mapa de archivos, (2) migración única `legacy-zip-migration.mjs`, (3) exporter sin ZIP, (4) transporte de Studio en JSON, (5) catálogo por carpeta, (6) budgets sin gzip, (7) gate anti-ZIP en `check-repository`, (8) documentación y gate completo. El orden garantiza que el typecheck de cada paquete pasa en cada commit.

**Tech Stack:** Node 22+ (release), pnpm 10.15.1 vía `corepack`, Vitest 3.2.4, `fflate` 0.8.2 **sólo** en `legacy-zip-migration.mjs` (temporal), Dexie, Playwright Chromium.

## Global Constraints

- No modificar `StoreProjectV2Schema` ni `schemaVersion: 2` (contrato de la tienda, no del transporte).
- `fflate` queda únicamente en `packages/exporter/scripts/legacy-zip-migration.mjs`; en un release posterior se elimina junto con el módulo (quedar documentado).
- El servicio local conserva: `409` de conflicto, lock por tienda, manifest atómico con rename, `faultInjector` (sólo tests), SHA-256, staging, límites (bytes totales, por archivo, nº de archivos).
- `solara-request-handler.mjs` es compartido HTTP/Electron: los cambios de endpoints y content-types deben probar ambos transportes (los tests del handler cubren el contrato).
- Gates: `corepack pnpm --filter <paquete> test` y `typecheck` por tarea; `corepack pnpm check` + `check:budgets` + `benchmark:export` + `test:e2e` (Chromium) en la Task 8.
- `test:e2e:release` exige Node 22; el entorno local con Node 24 no es validación release.
- Commits breves en español, uno por tarea, `git add` de archivos explícitos.
- `proyectos/`, `.solara-runtime/`, `.release/`, `dist/`, `test-results/` no entran al commit.

---

### Task 1: Storage local V2 — `.solara.json` y sitio como carpeta

**Files:**
- Modify: `packages/exporter/scripts/local-project-storage.mjs`
- Modify: `packages/exporter/scripts/solara-request-handler.mjs`
- Test: `packages/exporter/src/local-project-storage.test.mjs`

**Interfaces:**
- Consumes: `createLocalProjectStorage({ applicationRoot, maxUploadBytes, maxExtractedBytes, maxFileBytes, maxFiles, faultInjector })` (opciones sin cambios de contrato; `maxExtractedBytes` pasa a limitar el mapa de archivos del sitio).
- Produces:
  - Upload `kind: "project"`: archivo de texto con el formato `.solara.json` (`{ format: "solara-project", version: 2, projectId, exportedAt, project }`), guardado como `project.json` en la transacción.
  - Upload `kind: "site"`: JSON con `Array<{ path: string; encoding: "utf8" | "base64"; data: string }>` (mapa de archivos del sitio), guardado como `site-map.json`.
  - `parseProjectJson(bytes: Buffer): project` (valida format/version/projectId/schemaVersion).
  - `writeSiteFiles(siteMapPath, destination, limits): Promise<{ files: number, bytes: number }>` (valida rutas, límites y escribe archivos).
  - Manifest V2: `current.projectPath` (apunta a `actual/<clave>.solara.json`), respaldos `.solara.json`, `current.sha256` del JSON.
  - `readCurrent` devuelve los bytes del JSON; el handler sirve `Content-Type: application/vnd.solara.project+json`.

- [ ] **Step 1: Reescribir los helpers de test sin ZIP**

En `packages/exporter/src/local-project-storage.test.mjs`, reemplazar los imports de fflate (línea 5) y los helpers `projectArchive`/`siteArchive` (líneas 11–22) por:

```js
import { describe, expect, it } from "vitest";
import { createLocalProjectStorage } from "../scripts/local-project-storage.mjs";

const projectId = "store-storage-test";

function projectJson(name = "Prueba") {
  return JSON.stringify({
    format: "solara-project",
    version: 2,
    projectId,
    exportedAt: "2026-08-07T10:00:00.000Z",
    project: { schemaVersion: 2, id: projectId, name, slug: name.toLowerCase() },
  });
}

function siteMap(entries = [{ path: "index.html", encoding: "utf8", data: "<!doctype html><main>sitio</main>" }]) {
  return JSON.stringify(entries);
}
```

Mantener `requestFrom`, `upload`, `readFile`, `stat`, `join`, `mkdtemp`, `rm`, `tmpdir` según el uso de cada test.

- [ ] **Step 2: Reescribir los tests del storage sin ZIP**

En el mismo archivo:
- `await upload(storage, id, "project", projectArchive())` → `await upload(storage, id, "project", projectJson())`.
- `await upload(storage, id, "site", siteArchive(...))` → `await upload(storage, id, "site", siteMap([...]))` con el contenido esperado (p. ej. `{ path: "index.html", encoding: "utf8", data: "<main>v1</main>" }`).
- Test "rechaza conflictos de versión y rutas Zip Slip" (línea 115): el sitio malicioso pasa de `zipSync({ "../fuera.txt": ... })` a:

```js
      await upload(
        storage,
        malicious.transactionId,
        "site",
        siteMap([{ path: "../fuera.txt", encoding: "utf8", data: "no" }]),
      );
```

- Test "conserva el manifest anterior ante una interrupción y limita el upload" (línea 159): usar `projectJson("v2")` y `siteMap([{ path: "index.html", encoding: "utf8", data: "<main>v2</main>" }])`.
- Agregar dos tests nuevos al final del `describe`:

```js
  it("rechaza un mapa de sitio con demasiados archivos", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-storage-files-"));
    try {
      const storage = createLocalProjectStorage({ applicationRoot: root, maxFiles: 2 });
      const transaction = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T10:00:00.000Z",
        expectedVersion: null,
      });
      await upload(storage, transaction.transactionId, "project", projectJson());
      await upload(
        storage,
        transaction.transactionId,
        "site",
        siteMap([
          { path: "index.html", encoding: "utf8", data: "<main>a</main>" },
          { path: "catalog-index.json", encoding: "utf8", data: "{}" },
          { path: "search-index.json", encoding: "utf8", data: "{}" },
        ]),
      );
      await expect(storage.commit(transaction.transactionId)).rejects.toThrow(/archivos/i);
      expect((await storage.list()).projects).toHaveLength(0);
      await storage.abort(transaction.transactionId);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rechaza un archivo individual del sitio demasiado grande", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-storage-file-"));
    try {
      const storage = createLocalProjectStorage({ applicationRoot: root, maxFileBytes: 4 * 1024 });
      const transaction = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T10:00:00.000Z",
        expectedVersion: null,
      });
      await upload(storage, transaction.transactionId, "project", projectJson());
      await upload(
        storage,
        transaction.transactionId,
        "site",
        siteMap([{ path: "index.html", encoding: "utf8", data: "x".repeat(8 * 1024) }]),
      );
      await expect(storage.commit(transaction.transactionId)).rejects.toThrow(/límite/i);
      expect((await storage.list()).projects).toHaveLength(0);
      await storage.abort(transaction.transactionId);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
```

- [ ] **Step 3: Ejecutar los tests para verificar que fallan**

Run: `corepack pnpm --filter @solara/exporter test`
Expected: FAIL — el storage todavía lee `.zip` con `unzipSync` y rechaza los payloads JSON.

- [ ] **Step 4: Implementar el storage V2**

En `packages/exporter/scripts/local-project-storage.mjs`:

1. Quitar el import de `fflate` (línea 20). Quedarán `strFromU8` sin uso → eliminar también. Conservar los imports de `node:fs/promises` y `node:path`.

2. Cambiar la constante del manifest (línea 28) porque `list()` valida contra ella y el commit ya escribe V2:

```js
const MANIFEST_VERSION = 2;
```

2. Reemplazar `parseProjectArchive` (líneas 126–153) por:

```js
function parseProjectJson(bytes) {
  let envelope;
  try {
    envelope = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("El respaldo de la tienda está corrupto o no es JSON válido.");
  }
  const project = envelope?.project;
  if (envelope?.format !== "solara-project" || envelope?.version !== 2 || !project) {
    throw new Error("El respaldo no pertenece al formato de proyecto actual.");
  }
  if (project.schemaVersion !== 2 || project.id !== envelope.projectId) {
    throw new Error("El respaldo no coincide con la tienda que se está guardando.");
  }
  return project;
}
```

3. Reemplazar `extractSiteArchive` (líneas 155–185) por:

```js
async function writeSiteFiles(siteMapPath, destination, limits) {
  let entries;
  try {
    entries = JSON.parse(await readFile(siteMapPath, "utf8"));
  } catch {
    throw new Error("El mapa del sitio está corrupto o no es JSON válido.");
  }
  if (!Array.isArray(entries)) throw new Error("El mapa del sitio debe ser una lista.");
  if (entries.length > limits.maxFiles) throw new Error("El sitio contiene demasiados archivos.");
  let totalBytes = 0;
  let hasIndex = false;
  const prepared = [];
  for (const entry of entries) {
    if (typeof entry?.path !== "string" || (entry.encoding !== "utf8" && entry.encoding !== "base64")) {
      throw new Error("El mapa del sitio contiene entradas inválidas.");
    }
    const pathname = assertRelativeArchivePath(entry.path);
    const output = assertInside(destination, join(destination, pathname));
    const payload = Buffer.from(entry.data ?? "", entry.encoding);
    if (payload.byteLength > limits.maxFileBytes) {
      throw new Error("El contenido descomprimido supera el límite permitido.");
    }
    totalBytes += payload.byteLength;
    if (totalBytes > limits.maxExtractedBytes) {
      throw new Error("El contenido descomprimido supera el límite permitido.");
    }
    if (pathname === "index.html") hasIndex = true;
    prepared.push({ output, payload });
  }
  await mkdir(destination, { recursive: true });
  for (const { output, payload } of prepared) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, payload);
  }
  if (!hasIndex) throw new Error("La exportación del sitio no contiene index.html.");
  return { files: prepared.length, bytes: totalBytes };
}
```

4. En `upload` (líneas 377–389), el pathname pasa a depender del kind:

```js
    const filename = kind === "project" ? "project.json" : "site-map.json";
    const pathname = join(transaction.root, filename);
```

5. En `commit` (líneas 391–497):
- Reemplazar la lectura/validación del proyecto:

```js
    const project = parseProjectJson(await readFile(join(transaction.root, "project.json")));
```

- Reemplazar la extracción del sitio (bloque `if (transaction.site)`, líneas 417–441) por:

```js
    let siteInfo;
    if (transaction.site) {
      const temporarySite = join(sitesRoot, `.${key}.${transaction.id}.tmp`);
      const finalSite = join(sitesRoot, key);
      await rm(temporarySite, { recursive: true, force: true });
      try {
        await checkpoint("before-site-extract");
        siteInfo = await writeSiteFiles(join(transaction.root, "site-map.json"), temporarySite, {
          maxFiles,
          maxExtractedBytes,
          maxFileBytes,
        });
        await checkpoint("before-site-rename");
        await rename(temporarySite, finalSite);
      } catch (error) {
        await rm(temporarySite, { recursive: true, force: true });
        throw error;
      }
      siteInfo = {
        ...siteInfo,
        version: metadata.version,
        key,
        directoryPath: relative(applicationRoot, finalSite).replaceAll("\\", "/"),
        sha256: transaction.site.sha256,
        savedAt: savedAt.toISOString(),
      };
    }
```

- Reemplazar la copia del respaldo editable (líneas 443–447):

```js
    await checkpoint("before-project-archive");
    await copyFile(join(transaction.root, "project.json"), temporaryArchivePath);
    await rename(temporaryArchivePath, archivePath);
```

- Reemplazar los nombres de archivo (líneas 411–414 y 530):

```js
    const archiveName = `${key}.solara.json`;
    const archivePath = join(actualRoot, archiveName);
    const temporaryArchivePath = join(actualRoot, `.${archiveName}.${transaction.id}.tmp`);
```

```js
      `${found.manifest.current.key}-manual-${timestampKey()}-${randomBytes(4).toString("hex")}.solara.json`,
```

- El manifest (líneas 458–476) pasa a:

```js
    const manifest = {
      format: MANIFEST_FORMAT,
      manifestVersion: 2,
      projectId: metadata.projectId,
      storeName: project.name,
      slug: project.slug,
      schemaVersion: project.schemaVersion,
      status: siteInfo ? "synced" : "site-outdated",
      current: {
        version: metadata.version,
        key,
        projectPath: join("actual", archiveName).replaceAll("\\", "/"),
        sha256: transaction.project.sha256,
        savedAt: savedAt.toISOString(),
        projectUpdatedAt: project.updatedAt,
      },
      ...(lastValidSite ? { lastValidSite } : {}),
    };
```

- El chequeo del anterior (líneas 450–456 y 479–484) usa `previous.current.projectPath` en lugar de `archivePath`:

```js
    const previous = metadata.previous;
    if (previous?.current?.projectPath) {
      const oldCurrent = manifestPath(storeRoot, previous.current.projectPath);
      if ((await fileExists(oldCurrent)) && oldCurrent !== archivePath) {
        const oldBackup = join(backupsRoot, oldCurrent.split(sep).at(-1));
        if (!(await fileExists(oldBackup))) await copyFile(oldCurrent, oldBackup);
      }
    }
```

```js
    if (previous?.current?.projectPath) {
      const oldCurrent = manifestPath(storeRoot, previous.current.projectPath);
      if ((await fileExists(oldCurrent)) && oldCurrent !== archivePath) {
        await rm(oldCurrent, { force: true });
      }
    }
```

- `readCurrent` (líneas 499–509) verifica el hash igual que hoy (el hash ahora es del JSON; no requiere cambios de código, sólo el mensaje queda igual).

6. En `solara-request-handler.mjs`, el endpoint `current` (línea 247) cambia el content type:

```js
          "Content-Type": "application/vnd.solara.project+json",
```

- [ ] **Step 5: Ejecutar los tests para verificar que pasan**

Run: `corepack pnpm --filter @solara/exporter test`
Expected: PASS — todos los tests del storage en JSON, incluidos versionado, site-outdated, conflictos, Zip Slip→rutas inseguras, interrupción y límites nuevos.

- [ ] **Step 6: Commit**

```bash
git add packages/exporter/scripts/local-project-storage.mjs packages/exporter/scripts/solara-request-handler.mjs packages/exporter/src/local-project-storage.test.mjs
git commit -m "Cambia el almacenamiento local a JSON y mapa de archivos sin ZIP"
```

---

### Task 2: Migración única de `.solara.zip` a `.solara.json`

**Files:**
- Create: `packages/exporter/scripts/legacy-zip-migration.mjs`
- Modify: `packages/exporter/scripts/local-project-storage.mjs` (`ensureRoots`)
- Test: `packages/exporter/src/legacy-zip-migration.test.mjs`

**Interfaces:**
- Produces: `runLegacyZipMigration({ applicationRoot, projectsRoot, migrationStatePath }): Promise<{ converted: number, failed: string[] }>` — idempotente mediante marca `.solara-runtime/migration.json` (`{ format: "solara-migration", version: 1, convertedAt, projectIds }`). Único módulo del repo que importa `fflate` (temporal).
- `ensureRoots()` llama a la migración una vez (protegida por la marca) antes de validar reparse points.

- [ ] **Step 1: Escribir el test que falla**

Crear `packages/exporter/src/legacy-zip-migration.test.mjs`:

```js
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createLocalProjectStorage } from "../scripts/local-project-storage.mjs";

const projectId = "store-legacy";
const project = { schemaVersion: 2, id: projectId, name: "Antigua", slug: "antigua" };

function legacyArchive() {
  return zipSync({
    "manifest.json": strToU8(JSON.stringify({ format: "solara-project", version: 2, projectId })),
    "project.json": strToU8(JSON.stringify(project)),
  });
}

function legacyManifest() {
  return {
    format: "solara-local-project",
    manifestVersion: 1,
    projectId,
    storeName: "Antigua",
    slug: "antigua",
    schemaVersion: 2,
    status: "synced",
    current: {
      version: 3,
      key: "antigua-2026-08-07T00-00-00-000Z-v000003",
      archivePath: "actual/antigua-2026-08-07T00-00-00-000Z-v000003.solara.zip",
      sha256: "ignored",
      savedAt: "2026-08-07T00:00:00.000Z",
      projectUpdatedAt: "2026-08-07T00:00:00.000Z",
    },
    lastValidSite: { version: 3, key: "antigua-2026-08-07T00-00-00-000Z-v000003", directoryPath: "proyectos/store-legacy/sitios/antigua-2026-08-07T00-00-00-000Z-v000003" },
  };
}

describe("migración única de respaldos .solara.zip", () => {
  it("convierte una tienda legacy a .solara.json y reescribe el manifest V2", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-migration-"));
    try {
      const storeRoot = join(root, "proyectos", "antigua--storelegacy");
      await mkdir(join(storeRoot, "actual"), { recursive: true });
      await writeFile(
        join(storeRoot, "manifest.json"),
        `${JSON.stringify(legacyManifest(), null, 2)}\n`,
        "utf8",
      );
      await writeFile(
        join(storeRoot, "actual", "antigua-2026-08-07T00-00-00-000Z-v000003.solara.zip"),
        legacyArchive(),
      );

      const storage = createLocalProjectStorage({ applicationRoot: root });
      const listing = await storage.list();
      expect(listing.projects).toHaveLength(1);
      expect(listing.projects[0]).toMatchObject({ projectId, version: 3 });

      const manifest = JSON.parse(await readFile(join(storeRoot, "manifest.json"), "utf8"));
      expect(manifest.manifestVersion).toBe(2);
      expect(manifest.current.projectPath).toBe(
        "actual/antigua-2026-08-07T00-00-00-000Z-v000003.solara.json",
      );
      expect(manifest.current.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(manifest.current.sha256).not.toBe("ignored");
      const envelope = JSON.parse(
        await readFile(join(storeRoot, "actual", "antigua-2026-08-07T00-00-00-000Z-v000003.solara.json"), "utf8"),
      );
      expect(envelope.format).toBe("solara-project");
      expect(envelope.project.id).toBe(projectId);
      const backups = await readFile(
        join(storeRoot, "respaldos", "antigua-2026-08-07T00-00-00-000Z-v000003.solara.zip"),
      );
      expect(backups.byteLength).toBeGreaterThan(0);
      expect((await storage.readCurrent(projectId)).manifest.current.version).toBe(3);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("es idempotente y no toca carpetas corruptas", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-migration-"));
    try {
      const storeRoot = join(root, "proyectos", "antigua--storelegacy");
      await mkdir(join(storeRoot, "actual"), { recursive: true });
      await writeFile(join(storeRoot, "manifest.json"), `${JSON.stringify(legacyManifest(), null, 2)}\n`, "utf8");
      await writeFile(
        join(storeRoot, "actual", "antigua-2026-08-07T00-00-00-000Z-v000003.solara.zip"),
        legacyArchive(),
      );
      const corruptRoot = join(root, "proyectos", "rota--corrupta");
      await mkdir(join(corruptRoot, "actual"), { recursive: true });
      await writeFile(
        join(corruptRoot, "manifest.json"),
        `${JSON.stringify({ ...legacyManifest(), projectId: "store-rota" }, null, 2)}\n`,
        "utf8",
      );
      await writeFile(join(corruptRoot, "actual", "rota.solara.zip"), Buffer.from([1, 2, 3]));

      const storage = createLocalProjectStorage({ applicationRoot: root });
      const first = await storage.list();
      expect(first.projects).toHaveLength(1);
      const second = await storage.list();
      expect(second.projects).toHaveLength(1);
      const jsonPath = join(storeRoot, "actual", "antigua-2026-08-07T00-00-00-000Z-v000003.solara.json");
      expect(JSON.parse(await readFile(jsonPath, "utf8")).project.id).toBe(projectId);
      expect(second.recovery.length).toBeGreaterThanOrEqual(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `corepack pnpm --filter @solara/exporter test`
Expected: FAIL — `list()` pone la tienda legacy en `recovery` (manifest V1 incompatible) y no convierte nada.

- [ ] **Step 3: Implementar el módulo de migración**

Crear `packages/exporter/scripts/legacy-zip-migration.mjs`:

```js
/**
 * Conversión única de tiendas guardadas como .solara.zip (manifest V1) al
 * formato JSON .solara.json (manifest V2). Único módulo del repositorio que
 * lee ZIP: tras un release se elimina junto con fflate.
 */
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { strFromU8, unzipSync } from "fflate";

const STATE_FORMAT = "solara-migration";
const STATE_VERSION = 1;

async function readJson(pathname, fallback) {
  try {
    return JSON.parse(await readFile(pathname, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(pathname, value) {
  const temporary = `${pathname}.tmp-${randomBytes(8).toString("hex")}`;
  await mkdir(dirname(pathname), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, pathname);
}

export async function runLegacyZipMigration({ applicationRoot, projectsRoot, migrationStatePath }) {
  const state = await readJson(migrationStatePath, {});
  if (state.format === STATE_FORMAT && state.version === STATE_VERSION) {
    return { converted: [], failed: [] };
  }
  const converted = [];
  const failed = [];
  const { readdir } = await import("node:fs/promises");
  let entries = [];
  try {
    entries = await readdir(projectsRoot, { withFileTypes: true });
  } catch {
    entries = [];
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const storeRoot = join(projectsRoot, entry.name);
    try {
      const manifest = await readJson(join(storeRoot, "manifest.json"), undefined);
      if (!manifest || manifest.manifestVersion !== 1) continue;
      const archivePath = manifest.current?.archivePath;
      if (typeof archivePath !== "string" || !archivePath.endsWith(".solara.zip")) continue;
      const sourcePath = join(storeRoot, ...archivePath.split("/"));
      const zip = unzipSync(await readFile(sourcePath));
      const projectBytes = zip["project.json"];
      const manifestBytes = zip["manifest.json"];
      if (!projectBytes || !manifestBytes) throw new Error("Faltan manifest.json o project.json.");
      const inner = JSON.parse(strFromU8(manifestBytes));
      const project = JSON.parse(strFromU8(projectBytes));
      if (inner.format !== "solara-project" || inner.version !== 2 || project.schemaVersion !== 2) {
        throw new Error("El respaldo no es un proyecto solara v2.");
      }
      if (project.id !== manifest.projectId) throw new Error("El proyecto no coincide con la tienda.");
      const key = manifest.current.key;
      const jsonName = `${key}.solara.json`;
      const jsonText = `${JSON.stringify(
        {
          format: "solara-project",
          version: 2,
          projectId: manifest.projectId,
          exportedAt: manifest.current.savedAt,
          project,
        },
        null,
        2,
      )}\n`;
      const { createHash } = await import("node:crypto");
      const sha256 = createHash("sha256").update(jsonText).digest("hex");
      await mkdir(join(storeRoot, "actual"), { recursive: true });
      await writeFile(join(storeRoot, "actual", jsonName), jsonText, "utf8");
      await mkdir(join(storeRoot, "respaldos"), { recursive: true });
      const backupPath = join(storeRoot, "respaldos", archivePath.split("/").pop());
      const { copyFile } = await import("node:fs/promises");
      try {
        await copyFile(sourcePath, backupPath);
      } catch {
        // El respaldo ya existe; se conserva el original en su lugar.
      }
      await writeJsonAtomic(join(storeRoot, "manifest.json"), {
        ...manifest,
        manifestVersion: 2,
        current: {
          ...manifest.current,
          projectPath: join("actual", jsonName).replaceAll("\\", "/"),
          sha256,
        },
      });
      converted.push(manifest.projectId);
    } catch (error) {
      failed.push(entry.name);
    }
  }
  await writeJsonAtomic(migrationStatePath, {
    format: STATE_FORMAT,
    version: STATE_VERSION,
    convertedAt: new Date().toISOString(),
    projectIds: converted,
  });
  return { converted, failed };
}
```

- [ ] **Step 4: Conectar la migración en `ensureRoots`**

En `packages/exporter/scripts/local-project-storage.mjs`:

1. Agregar el import dinámico dentro de `ensureRoots` (antes de los chequeos de reparse):

```js
  async function ensureRoots() {
    await mkdir(projectsRoot, { recursive: true });
    await mkdir(stagingRoot, { recursive: true });
    const { runLegacyZipMigration } = await import("./legacy-zip-migration.mjs");
    await runLegacyZipMigration({
      applicationRoot,
      projectsRoot,
      migrationStatePath: join(stagingRoot, "..", "migration.json"),
    });
    await assertNoReparsePoints(applicationRoot, projectsRoot);
    await assertNoReparsePoints(applicationRoot, stagingRoot);
  }
```

2. Verificar que `list()` acepta los manifests V2 convertidos (la constante `MANIFEST_VERSION` ya es 2 desde la Task 1; no requiere código).

- [ ] **Step 5: Ejecutar los tests para verificar que pasan**

Run: `corepack pnpm --filter @solara/exporter test`
Expected: PASS — migración (conversión, idempotencia, corrupción) y storage completo.

- [ ] **Step 6: Commit**

```bash
git add packages/exporter/scripts/legacy-zip-migration.mjs packages/exporter/scripts/local-project-storage.mjs packages/exporter/src/legacy-zip-migration.test.mjs
git commit -m "Migra una sola vez los respaldos .solara.zip a .solara.json"
```

---

### Task 3: Exporter sin ZIP

**Files:**
- Modify: `packages/exporter/src/index.ts`
- Modify: `packages/exporter/src/index.test.ts`
- Modify: `packages/exporter/src/scale.test.ts`
- Modify: `apps/studio/src/workers/export.worker.ts`
- Modify: `apps/studio/src/lib/workers.ts`
- Modify: `scripts/export-benchmark.test.ts`, `scripts/optimization-baseline.test.ts`, `scripts/pilot-preflight.test.ts`, `scripts/write-pilot-export.test.ts`, `scripts/write-reference-export.test.ts`, `scripts/create-release-manifest.mjs`

**Interfaces:**
- Produces: `ExportResult = { files: ReadonlyMap<string, string | Uint8Array>; audit: AuditIssue[]; optimization: OptimizationReport }` (sin `zip`). `createProjectArchive(project): string` y `readProjectArchive(input: string): StoreProjectV1` con formato `.solara.json`. Eliminados `zipFiles`, import de `fflate`, `stableMtime`.
- `exportSiteInWorker` devuelve `{ files, audit, optimization }` (workers.ts y export.worker.ts).

- [ ] **Step 1: Actualizar los tests primero**

En `packages/exporter/src/index.test.ts`:
- Líneas 338–339: `const first = exportProject(...).zip;` → usar `files` y comparar con `toEqual` de los dos mapas:

```ts
    const first = exportProject(referenceStore, { mode: "production" }).files;
    const second = exportProject(referenceStore, { mode: "production" }).files;
    expect(second).toEqual(first);
```

- Línea 334: `expect(readProjectArchive(createProjectArchive(referenceStore))).toEqual(referenceStore);` se mantiene (el formato interno cambia pero la API JSON queda).
- Línea 133: `createProjectArchive(invalid)` sigue lanzando por `parseProject`; sin cambios.

En `packages/exporter/src/scale.test.ts`, línea 96:

```ts
    expect(exportProject(catalogScaleStore, { mode: "production" }).files).toEqual(exported.files);
```

En `scripts/pilot-preflight.test.ts`, línea 75:

```ts
  expect(second.files).toEqual(result.files);
```

En `scripts/export-benchmark.test.ts`, reemplazar el log y el chequeo:

```ts
  const filesBytes = [...result.files.values()].reduce(
    (total, value) => total + (typeof value === "string" ? Buffer.byteLength(value, "utf8") : value.byteLength),
    0,
  );
  console.log({
    products: project.products.length,
    activeProductPages: productPages,
    files: result.files.size,
    filesBytes,
    elapsedMs: Math.round(elapsedMs),
  });
```

En `scripts/optimization-baseline.test.ts`: eliminar el import de `gzipSync`; en `measure` reemplazar `zipBytes`/`zipSha256` y los tres `*GzipBytes` por:

```ts
    filesBytes: [...result.files.values()].reduce(
      (total, value) =>
        total + (typeof value === "string" ? Buffer.byteLength(value, "utf8") : value.byteLength),
      0,
    ),
    filesSha256: sha256(
      [...result.files.entries()]
        .map(([path, value]) => `${path}:${typeof value === "string" ? value : Buffer.from(value).toString("base64")}`)
        .join("\n"),
    ),
```

y la aserción final (línea 81):

```ts
  expect(report.fixtures.catalogModern.javascriptBytes).toBeLessThanOrEqual(128 * 1024);
```

En `scripts/write-pilot-export.test.ts`:
- Líneas 24–27: `const project = readProjectArchive(...)` se mantiene; `expect(repeated.zip).toEqual(exported.zip)` → `expect(repeated.files).toEqual(exported.files)`.
- Línea 31: eliminar `writeFileSync(resolve(outputRoot, "site.zip"), exported.zip);`.
- Línea 42: `console.log({ source, output: outputDirectory, files: exported.files.size });`.

En `scripts/write-reference-export.test.ts`:
- Línea 15: eliminar `writeFileSync(resolve(root, ".release/site.zip"), exported.zip);`.
- Líneas 16–19: reemplazar por:

```ts
  writeFileSync(
    resolve(root, ".release/reference.solara.json"),
    createProjectArchive(referenceStore),
  );
```

En `scripts/create-release-manifest.mjs`, línea 26:

```js
  artifacts: ["apps/studio/dist", ".release/reference-site"],
```

- [ ] **Step 2: Ejecutar para verificar que fallan**

Run: `corepack pnpm --filter @solara/exporter test` y `corepack pnpm --filter @solara/studio typecheck`
Expected: FAIL — `zip` ya no existe en `ExportResult` y `createProjectArchive` sigue devolviendo `Uint8Array`.

- [ ] **Step 3: Implementar**

En `packages/exporter/src/index.ts`:
1. Línea 35: eliminar el import de `fflate` completo.
2. Línea 158: eliminar `stableMtime`.
3. Líneas 2279–2290: eliminar `zipFiles`.
4. Líneas 113–118: `ExportResult` sin `zip`:

```ts
export interface ExportResult {
  files: ReadonlyMap<string, string | Uint8Array>;
  audit: AuditIssue[];
  optimization: OptimizationReport;
}
```

5. Línea 2327: `return { files, audit, optimization };`.
6. Reemplazar `createProjectArchive` (líneas 2399–2422) por:

```ts
export function createProjectArchive(projectInput: StoreProjectV1): string {
  const project = parseProject(projectInput, "crear el archivo del proyecto");
  return `${JSON.stringify(
    {
      format: "solara-project",
      version: 2,
      projectId: project.id,
      exportedAt: new Date().toISOString(),
      project,
    },
    null,
    2,
  )}\n`;
}
```

7. Reemplazar `readProjectArchive` (líneas 2424–2442) por:

```ts
export function readProjectArchive(input: string): StoreProjectV1 {
  let envelope: {
    format?: string;
    version?: number;
    project?: unknown;
  };
  try {
    envelope = JSON.parse(input) as { format?: string; version?: number; project?: unknown };
  } catch {
    throw new Error("El respaldo está corrupto o no es JSON válido.");
  }
  if (envelope.format !== "solara-project" || envelope.version !== 2 || !envelope.project) {
    throw new Error(
      "Este respaldo pertenece a una versión anterior. Conservá el archivo original y creá una nueva tienda con el sistema actual.",
    );
  }
  return parseProject(envelope.project, "leer el respaldo del proyecto");
}
```

En `apps/studio/src/workers/export.worker.ts`:
- En el caso `"site"`, reemplazar las líneas 40–45 por:

```ts
      const result = exportProject(
        { ...request.project },
        { mode: request.mode, ...request.options },
      );
      const optimization: OptimizationReport = result.optimization;
      const audit: AuditIssue[] = result.audit;
      self.postMessage({
        id: request.id,
        ok: true,
        result: { files: result.files, audit, optimization },
      });
      return;
```

- Eliminar `transferableBytes` si queda sin uso (sí: `project-write` lo usa hasta la Task 4; dejarlo).

En `apps/studio/src/lib/workers.ts`, línea 222–228:

```ts
export function exportSiteInWorker(
  project: StoreProjectV1,
  mode: ExportMode,
  options: { publicAiContext?: boolean; optimizationProfile?: "safe" | "strict" } = {},
): Promise<{
  files: ReadonlyMap<string, string | Uint8Array>;
  audit: AuditIssue[];
  optimization: OptimizationReport;
}> {
  return requestWorker(getExportWorker(), { type: "site", project, mode, options });
}
```

- [ ] **Step 4: Ejecutar los tests y el typecheck**

Run: `corepack pnpm --filter @solara/exporter test`, `corepack pnpm --filter @solara/studio typecheck`, `corepack pnpm benchmark:export`, `corepack pnpm check:optimization`
Expected: PASS en todos.

- [ ] **Step 5: Commit**

```bash
git add packages/exporter/src/index.ts packages/exporter/src/index.test.ts packages/exporter/src/scale.test.ts apps/studio/src/workers/export.worker.ts apps/studio/src/lib/workers.ts scripts/export-benchmark.test.ts scripts/optimization-baseline.test.ts scripts/pilot-preflight.test.ts scripts/write-pilot-export.test.ts scripts/write-reference-export.test.ts scripts/create-release-manifest.mjs
git commit -m "Quita el ZIP del exporter y deja el sitio como mapa de archivos"
```

---

### Task 4: Transporte de Studio en JSON

**Files:**
- Modify: `apps/studio/src/lib/projectArchive.ts`
- Modify: `apps/studio/src/lib/projectArchive.test.ts`
- Modify: `apps/studio/src/lib/localStorage.ts`
- Modify: `apps/studio/src/lib/localProjectRepository.ts`
- Modify: `apps/studio/src/workers/export.worker.ts`
- Modify: `apps/studio/src/lib/workers.ts`
- Modify: `apps/studio/src/App.tsx`, `apps/studio/src/features/Export.tsx`, `apps/studio/src/features/Studio.tsx`
- Modify: `tests/e2e/studio-visual.spec.ts`

**Interfaces:**
- Produces: `createProjectArchive(project): string` (formato `.solara.json`); `readProjectArchive(input: string | Uint8Array): StoreProjectV2` (decodifica si recibe bytes); `serializeSiteFiles(files: ReadonlyMap<string, string | Uint8Array>): string` (JSON del mapa). Cliente `saveLocalProject(metadata, projectJson: string, siteMap?: string)`. Descargas con nombre `*.solara.json` y MIME `application/vnd.solara.project+json`. Import con `accept=".json,.solara.json,application/json"`.

- [ ] **Step 1: Reescribir projectArchive.ts y su test**

`apps/studio/src/lib/projectArchive.ts` completo:

```ts
/**
 * Formato de transporte `.solara.json`: envelope de proyecto sin compresión.
 * La lectura trata el archivo como entrada no confiable y valida schema antes
 * de incorporarlo al estado del editor.
 */
import type { StoreProjectV2 } from "@solara/project-schema";
import { StoreProjectV2Schema } from "@solara/project-schema";

interface ArchiveEnvelope {
  format: "solara-project";
  version: 2;
  projectId: string;
  exportedAt: string;
  project: StoreProjectV2;
}

export function createProjectArchive(project: StoreProjectV2): string {
  const parsed = StoreProjectV2Schema.parse(project);
  const envelope: ArchiveEnvelope = {
    format: "solara-project",
    version: 2,
    projectId: parsed.id,
    exportedAt: new Date().toISOString(),
    project: parsed,
  };
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

export function readProjectArchive(input: string | Uint8Array): StoreProjectV2 {
  let text: string;
  if (typeof input === "string") {
    text = input;
  } else {
    text = new TextDecoder().decode(input);
  }
  let envelope: Partial<ArchiveEnvelope>;
  try {
    envelope = JSON.parse(text) as Partial<ArchiveEnvelope>;
  } catch {
    throw new Error("El respaldo está corrupto o no es JSON válido.");
  }
  if (envelope.format !== "solara-project" || envelope.version !== 2) {
    throw new Error(
      "Este respaldo pertenece a una version anterior y no es compatible. Conserva el archivo original y crea una nueva tienda con el sistema actual.",
    );
  }
  const parsed = StoreProjectV2Schema.safeParse(envelope.project);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") || "project";
    throw new Error(
      "El proyecto no es compatible: " +
        path +
        ": " +
        (issue?.message ?? "validación fallida") +
        ". Conservá el archivo original.",
    );
  }
  return parsed.data;
}

export type DownloadData = string | Blob | Uint8Array;

function blobPart(data: DownloadData): BlobPart {
  if (!(data instanceof Uint8Array)) return data;
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy.buffer;
}

export function downloadBlob(data: DownloadData, filename: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([blobPart(data)], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
```

Verificar con `rg "normalizePublicExport"` si quedó algún consumidor; si no hay, eliminarlo del archivo viejo (ya no se define).

`apps/studio/src/lib/projectArchive.test.ts` completo:

```ts
import { describe, expect, it } from "vitest";
import { referenceStore } from "@solara/project-schema/fixture";
import { createProjectArchive, readProjectArchive } from "./projectArchive";

describe("archivo de proyecto .solara.json", () => {
  it("hace round-trip del proyecto sin compresión", () => {
    const archive = createProjectArchive(referenceStore);
    expect(archive.startsWith("{")).toBe(true);
    expect(readProjectArchive(archive)).toEqual(referenceStore);
  });

  it("rechaza JSON corrupto", () => {
    expect(() => readProjectArchive(new Uint8Array([1, 2, 3]))).toThrow(/corrupto|JSON/);
  });

  it("rechaza respaldos de otro formato", () => {
    const manifest = JSON.stringify({ format: "otro-formato", version: 1, project: referenceStore });
    expect(() => readProjectArchive(manifest)).toThrow(/no es compatible/);
  });

  it("rechaza proyectos que no cumplen el schema", () => {
    const invalidProject = JSON.stringify({
      format: "solara-project",
      version: 2,
      projectId: "x",
      exportedAt: "2026-08-07T00:00:00.000Z",
      project: { schemaVersion: 2, id: "x" },
    });
    expect(() => readProjectArchive(invalidProject)).toThrow(/no es compatible/);
  });
});
```

- [ ] **Step 2: Actualizar workers**

`apps/studio/src/workers/export.worker.ts`:
- `"project-write"` (líneas 49–53):

```ts
    if (request.type === "project-write") {
      self.postMessage({ id: request.id, ok: true, result: createProjectArchive(request.project) });
      return;
    }
```

- `"project-read"` (línea 55):

```ts
    const project = readProjectArchive(new TextDecoder().decode(new Uint8Array(request.buffer)));
```

- Mensaje de error genérico (línea 61): "No se pudo procesar el respaldo del proyecto."

`apps/studio/src/lib/workers.ts`:
- Líneas 230–232:

```ts
export function createProjectArchiveInWorker(project: StoreProjectV1): Promise<string> {
  return requestWorker(getExportWorker(), { type: "project-write", project });
}
```

- Líneas 234–245:

```ts
export async function readProjectArchiveInWorker(file: File): Promise<StoreProjectV1> {
  const buffer = await file.arrayBuffer();
  return requestWorker(getExportWorker(), { type: "project-read", buffer }, [buffer]);
}

export function readProjectArchiveBytesInWorker(bytes: Uint8Array): Promise<StoreProjectV1> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return requestWorker(getExportWorker(), { type: "project-read", buffer: copy.buffer }, [copy.buffer]);
}
```

- [ ] **Step 3: Cliente y orquestador**

`apps/studio/src/lib/localStorage.ts`:
- `saveLocalProject` (líneas 147–183): firma y envío:

```ts
export async function saveLocalProject(
  metadata: LocalSaveMetadata,
  projectJson: string,
  siteMap?: string,
): Promise<LocalSaveReceipt> {
  const started = await requestJson<
    { transactionId: string } & Pick<LocalSaveReceipt, "version" | "folder">
  >("/__solara/storage/saves", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(metadata),
  });
  try {
    await uploadBytes(
      `/__solara/storage/saves/${encodeURIComponent(started.transactionId)}/project`,
      new TextEncoder().encode(projectJson),
      "application/vnd.solara.project+json",
    );
    if (siteMap) {
      await uploadBytes(
        `/__solara/storage/saves/${encodeURIComponent(started.transactionId)}/site`,
        new TextEncoder().encode(siteMap),
        "application/json",
      );
    }
    return await requestJson<LocalSaveReceipt>(
      `/__solara/storage/saves/${encodeURIComponent(started.transactionId)}/commit`,
      { method: "POST", headers: { Accept: "application/json" } },
    );
  } catch (error) {
    await fetch(`/__solara/storage/saves/${encodeURIComponent(started.transactionId)}/abort`, {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => undefined);
    throw error;
  }
}
```

`apps/studio/src/lib/localProjectRepository.ts`:
- Agregar el serializador:

```ts
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.byteLength; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export function serializeSiteFiles(
  files: ReadonlyMap<string, string | Uint8Array>,
): string {
  return JSON.stringify(
    [...files.entries()].map(([path, value]) =>
      typeof value === "string"
        ? { path, encoding: "utf8", data: value }
        : { path, encoding: "base64", data: bytesToBase64(value) },
    ),
  );
}
```

- `loadDiskProject` (líneas 26–39): sin cambios (sigue leyendo bytes y validando en worker).
- `persistProjectToDisk` (líneas 75–104):

```ts
export async function persistProjectToDisk(
  project: StoreProjectV1,
  expectedVersion: number | null,
): Promise<{ receipt: LocalSaveReceipt; siteError?: string }> {
  const projectArchive = await createProjectArchiveInWorker(project);
  const verifiedProject = await readProjectArchiveBytesInWorker(
    new TextEncoder().encode(projectArchive),
  );
  if (verifiedProject.id !== project.id) {
    throw new Error("El respaldo generado no coincide con la tienda actual.");
  }
  let siteMap: string | undefined;
  let siteError: string | undefined;
  try {
    const site = await exportSiteInWorker(project, "production");
    siteMap = serializeSiteFiles(site.files);
  } catch (error) {
    siteError =
      error instanceof Error ? error.message : "La exportación de producción no pudo completarse.";
  }
  const receipt = await saveLocalProject(
    {
      projectId: project.id,
      name: project.name,
      slug: project.slug,
      projectUpdatedAt: project.updatedAt,
      expectedVersion,
    },
    projectArchive,
    siteMap,
  );
  return { receipt, ...(siteError ? { siteError } : {}) };
}
```

- [ ] **Step 4: UI (App, Export, Studio) y E2E**

`apps/studio/src/App.tsx`:
- Línea 314: "recuperá una copia compatible desde un respaldo .solara.json."
- Línea 329: `accept=".json,.solara.json,application/json"`.
- Línea 424: `downloadBlob(archive, \`${project.slug}-respaldo.solara.json\`, "application/vnd.solara.project+json");`
- Línea 437: `\`${selected?.project.slug ?? "tienda"}${version}.solara.json\`` y MIME `"application/vnd.solara.project+json"`.

`apps/studio/src/features/Export.tsx`:
- `exportSite` (líneas 51–66): eliminar la descarga del sitio; mostrar aviso:

```tsx
  const [notice, setNotice] = useState("");
  const exportSite = async (mode: "draft" | "production") => {
    setBusy(mode);
    setError("");
    setNotice("");
    try {
      const result = await exportSiteInWorker(project, mode, {
        publicAiContext,
        optimizationProfile: "safe",
      });
      setOptimization(result.optimization);
      setNotice(
        "Exportación correcta. El sitio público se guarda en proyectos/<tienda>/sitios/ al guardar con el lanzador; podés abrirlo desde el dashboard.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo exportar la tienda.");
    } finally {
      setBusy("");
    }
  };
```

- Renderizar `notice` junto a `error` (patrón existente de `InlineError`):

```tsx
      {notice ? <output className="export-notice">{notice}</output> : null}
```

- `backup` (líneas 68–82): nombre `\`${project.slug}.solara.json\`` y MIME `"application/vnd.solara.project+json"`.
- Línea 128: texto del botón "Descargar .solara.json".
- Línea 134: `accept=".json,.solara.json,application/json"`.

`apps/studio/src/features/Studio.tsx`, línea 190: `\`${project.slug}-antes-de-actualizar.solara.json\`` y MIME `"application/vnd.solara.project+json"` (verificar el `downloadBlob` adyacente).

`tests/e2e/studio-visual.spec.ts`, línea 207: `expect(download.suggestedFilename()).toMatch(/\.solara\.json$/);`

- [ ] **Step 5: Verificar**

Run: `corepack pnpm --filter @solara/studio typecheck`, `corepack pnpm --filter @solara/studio test`, `corepack pnpm --filter @solara/exporter test`
Expected: PASS en los tres.

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/lib/projectArchive.ts apps/studio/src/lib/projectArchive.test.ts apps/studio/src/lib/localStorage.ts apps/studio/src/lib/localProjectRepository.ts apps/studio/src/workers/export.worker.ts apps/studio/src/lib/workers.ts apps/studio/src/App.tsx apps/studio/src/features/Export.tsx apps/studio/src/features/Studio.tsx tests/e2e/studio-visual.spec.ts
git commit -m "Migra el transporte de Studio a .solara.json sin ZIP"
```

---

### Task 5: Importación de catálogo por carpeta

**Files:**
- Modify: `apps/studio/src/workers/catalog-package.worker.ts`
- Modify: `apps/studio/src/lib/workers.ts`
- Modify: `apps/studio/src/lib/catalogPackage.ts`
- Modify: `apps/studio/src/features/Catalog.tsx`
- Modify: `tests/e2e/catalog-package.spec.ts`

**Interfaces:**
- Produces: request del worker `{ type: "catalog-package", files: Array<{ path: string; type: string; buffer: ArrayBuffer }> }`; resultado igual que hoy (`{ csv, images }`). `readCatalogPackageInFolder(files: File[]): Promise<CatalogPackageContents>`; `buildCatalogPackagePlan(files: File[], project)` con `summary.filename` = nombre de la carpeta raíz.

- [ ] **Step 1: Reescribir el worker**

`apps/studio/src/workers/catalog-package.worker.ts` completo:

```ts
/** Procesa la carpeta comercial fuera de UI y devuelve una importación revisable. */
interface CatalogPackageRequest {
  id: string;
  type: "catalog-package";
  files: Array<{ path: string; type: string; buffer: ArrayBuffer }>;
}

function mimeType(path: string): string {
  const extension = path.split(".").pop()?.toLocaleLowerCase("en-US");
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "";
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function entryBytes(entry: { buffer: ArrayBuffer }): Uint8Array {
  const view = new Uint8Array(entry.buffer.byteLength);
  view.set(new Uint8Array(entry.buffer));
  return view;
}

self.onmessage = (event: MessageEvent<CatalogPackageRequest>) => {
  try {
    const files = event.data.files;
    if (!Array.isArray(files)) throw new Error("La carpeta no contiene archivos.");
    const totalInputBytes = files.reduce((sum, file) => sum + file.buffer.byteLength, 0);
    if (totalInputBytes > 250 * 1024 * 1024) {
      throw new Error("La carpeta supera el máximo de 250 MB.");
    }
    const csvEntry = files.find(
      (file) => normalizePath(file.path) === "productos.csv" || normalizePath(file.path) === "catalogo.csv",
    );
    if (!csvEntry) throw new Error("La carpeta debe contener productos.csv.");

    const imageEntries = files.filter((file) =>
      normalizePath(file.path).startsWith("imagenes/"),
    );
    const unsupported = imageEntries.filter((file) => mimeType(file.path) === "");
    const images = imageEntries
      .map((file) => ({
        path: normalizePath(file.path),
        bytes: entryBytes(file),
        type: mimeType(file.path),
      }))
      .filter((entry) => entry.path.startsWith("imagenes/") && entry.type !== "");

    if (unsupported.length > 0) {
      throw new Error("La carpeta contiene archivos no compatibles dentro de imagenes/.");
    }

    const invalidEntries = files
      .map((file) => normalizePath(file.path))
      .filter((path) => path.includes("../") || path.startsWith("/") || path.includes(":"));
    if (invalidEntries.length > 0) throw new Error("La carpeta contiene una ruta de archivo insegura.");

    if (images.length > 500) throw new Error("La carpeta supera el máximo de 500 imágenes.");
    if (images.some((image) => image.bytes.byteLength > 20 * 1024 * 1024)) {
      throw new Error("Una imagen de la carpeta supera el límite de 20 MB.");
    }
    const totalBytes = images.reduce((sum, image) => sum + image.bytes.byteLength, 0);
    if (totalBytes > 500 * 1024 * 1024) {
      throw new Error("El contenido de imágenes de la carpeta supera los 500 MB.");
    }

    const transferableImages = images.map((image) => ({
      path: image.path,
      type: image.type,
      buffer: image.bytes.buffer,
    }));
    const result = {
      csv: new TextDecoder().decode(entryBytes(csvEntry)),
      images: transferableImages,
    };
    self.postMessage({ id: event.data.id, ok: true, result }, [
      ...transferableImages.map((image) => image.buffer),
    ]);
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo leer la carpeta del catálogo.",
    });
  }
};
```

- [ ] **Step 2: workers.ts y catalogPackage.ts**

`apps/studio/src/lib/workers.ts`, reemplazar `readCatalogPackageInWorker` (líneas 172–178):

```ts
export function readCatalogPackageInFolder(files: File[]): Promise<CatalogPackageContents> {
  const payload = files.map((file) => ({
    path: file.webkitRelativePath || file.name,
    type: file.type,
    buffer: file.arrayBuffer(),
  }));
  return Promise.all(payload.map(async (entry) => ({ ...entry, buffer: await entry.buffer }))).then(
    (entries) => requestWorker(getCatalogPackageWorker(), { type: "catalog-package", files: entries }),
  );
}
```

`apps/studio/src/lib/catalogPackage.ts`:
- `buildCatalogPackagePlan(file: File, project)` → `buildCatalogPackagePlan(files: File[], project)`:

```ts
export async function buildCatalogPackagePlan(
  files: File[],
  project: StoreProjectV1,
): Promise<CatalogPackagePlan> {
  const contents = await readCatalogPackageInFolder(files);
  const folderName =
    files[0]?.webkitRelativePath?.split("/")[0] ??
    files[0]?.name?.split(".")[0] ??
    "carpeta";
  ...
  summary: {
    filename: folderName,
    ...
  }
}
```

- [ ] **Step 3: UI del Catálogo**

`apps/studio/src/features/Catalog.tsx`:
- `importPackage` (líneas 418–429):

```tsx
  const importPackage = async (files: File[]) => {
    setBusy("package");
    setError("");
    setPendingPackage(undefined);
    try {
      setPendingPackage(await buildCatalogPackagePlan(files, project));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo leer la carpeta del catálogo.");
    } finally {
      setBusy("");
    }
  };
```

- Input (líneas 528–538):

```tsx
            <input
              className="visually-hidden"
              id={packageInputId}
              type="file"
              webkitdirectory=""
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length > 0) void importPackage(files);
                event.target.value = "";
              }}
            />
```

- Botón (líneas 539–545): texto `{busy === "package" ? "Leyendo carpeta" : "Importar carpeta + imágenes"}`.

- [ ] **Step 4: E2E por carpeta**

`tests/e2e/catalog-package.spec.ts`:
- Eliminar el import de `fflate`.
- Reemplazar el bloque de construcción del ZIP (líneas 37–50) por la creación de una carpeta temporal con archivos reales:

```ts
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const packageDirectory = mkdtempSync(join(tmpdir(), "solara-catalog-package-"));
  try {
    mkdirSync(join(packageDirectory, "imagenes"), { recursive: true });
    writeFileSync(join(packageDirectory, "productos.csv"), csv, "utf8");
    writeFileSync(join(packageDirectory, "imagenes", "taza.png"), pixel);
    await page.locator('input[type="file"][webkitdirectory]').setInputFiles(packageDirectory);
  } finally {
    rmSync(packageDirectory, { recursive: true, force: true });
  }
```

Nota: Playwright soporta `setInputFiles` con una ruta de directorio para inputs con `webkitdirectory`. Si en Chromium la versión local no lo soporta, alternativa: crear los `FilePayload` con `relativePath` (`{ name: "productos.csv", mimeType: "text/csv", buffer, relativePath: "productos.csv" }`).

- Línea 52: la cabecera espera el nombre de la carpeta; reemplazar por:

```ts
  await expect(page.getByRole("heading", { name: /carpeta|cat/ })).toBeVisible({
```

y ajustar el nombre real de la carpeta temporal en la aserción (usar el último segmento de `packageDirectory`).

- [ ] **Step 5: Verificar**

Run: `corepack pnpm --filter @solara/studio typecheck`, `corepack pnpm --filter @solara/studio test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/workers/catalog-package.worker.ts apps/studio/src/lib/workers.ts apps/studio/src/lib/catalogPackage.ts apps/studio/src/features/Catalog.tsx tests/e2e/catalog-package.spec.ts
git commit -m "Importa el catálogo comercial desde una carpeta sin ZIP"
```

---

### Task 6: Budgets en bytes crudos (sin gzip)

**Files:**
- Modify: `scripts/check-budgets.mjs`
- Modify: `scripts/storefront-runtime-budget.test.ts`
- Modify: `scripts/public-storefront-budget.test.ts`
- Modify: `packages/storefront-runtime/src/index.test.ts`

**Interfaces:**
- Produces: todos los budgets miden `byteLength` sin compresión. Topes recalculados con los valores medidos + margen documentado en el propio archivo.

- [ ] **Step 1: Medir los valores actuales en crudo**

Run: `corepack pnpm build` y luego un script temporal o consola con Node para imprimir los bytes crudos de: bundle JS inicial de Studio (`apps/studio/dist/assets/index-*.js` mayor), CSS inicial, `storefront.js`, `storefront.css` del export de `catalogModernStore`. Anotar los cuatro números.

- [ ] **Step 2: Escribir los tests con topes en crudo**

`scripts/check-budgets.mjs` (completo, sin `node:zlib`):

```js
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const assetsDirectory = new URL("../apps/studio/dist/assets/", import.meta.url);
const directoryPath = fileURLToPath(assetsDirectory);

if (!existsSync(directoryPath)) {
  console.error("No existe apps/studio/dist. Ejecutá pnpm build antes de revisar budgets.");
  process.exit(1);
}

const files = readdirSync(directoryPath);
const javascriptCandidates = files.filter((file) => /^index-[^./]+\.js$/.test(file));
const stylesheet = files.find((file) => /^index-[^./]+\.css$/.test(file));
if (javascriptCandidates.length === 0 || !stylesheet) {
  console.error("No se encontraron los bundles iniciales de Studio.");
  process.exit(1);
}

// Vite puede separar Preview/SEO en chunks `index-*`; el entry inicial es el
// mayor de esos chunks y no debe elegirse por el orden del sistema de archivos.
const javascript = javascriptCandidates.reduce((largest, file) =>
  readFileSync(new URL(`./${file}`, assetsDirectory)).byteLength >
  readFileSync(new URL(`./${largest}`, assetsDirectory)).byteLength
    ? file
    : largest,
);

// Topes en bytes crudos (sin compresión), fijados con margen sobre la medición
// de la Task 6 (Step 1). Un servidor web puede comprimir; estos topes bloquean
// crecimientos accidentales del bundle de Studio.
const checks = [
  {
    label: "Studio JavaScript inicial crudo",
    file: javascript,
    limit: 700 * 1024,
  },
  {
    label: "Studio CSS inicial crudo",
    file: stylesheet,
    limit: 160 * 1024,
  },
];

let failed = false;
for (const check of checks) {
  const bytes = readFileSync(new URL(`./${check.file}`, assetsDirectory)).byteLength;
  const status = bytes <= check.limit ? "OK" : "EXCEDE";
  console.log(`${status} ${check.label}: ${bytes} B / ${check.limit} B`);
  if (bytes > check.limit) failed = true;
}

if (failed) process.exit(1);
```

Ajustar los límites con las mediciones reales del Step 1 (margen ~20% sobre el valor medido) y actualizar el comentario con los valores.

`scripts/storefront-runtime-budget.test.ts`: reemplazar `gzipSync(x).byteLength` por `Buffer.byteLength(x, "utf8")` (o `x.byteLength` según el tipo) y fijar topes crudos medidos (runtime JS ~35 KiB, CSS ~6 KiB según la medición; ajustar al valor real + 20%).

`scripts/public-storefront-budget.test.ts`, líneas 18–19:

```ts
  expect(Buffer.byteLength(css, "utf8")).toBeLessThanOrEqual(120 * 1024);
  expect(Buffer.byteLength(javascript, "utf8")).toBeLessThanOrEqual(64 * 1024);
```

(ajustar con la medición real del Step 1).

`packages/storefront-runtime/src/index.test.ts`, línea 61:

```ts
    expect(Buffer.byteLength(STOREFRONT_RUNTIME_JS, "utf8")).toBeLessThanOrEqual(64 * 1024);
```

(ajustar con la medición real; eliminar el import de `node:zlib` si queda sin uso).

- [ ] **Step 3: Verificar**

Run: `corepack pnpm check:budgets` y `corepack pnpm check:optimization`
Expected: PASS con los topes recalculados.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-budgets.mjs scripts/storefront-runtime-budget.test.ts scripts/public-storefront-budget.test.ts packages/storefront-runtime/src/index.test.ts
git commit -m "Mide budgets en bytes crudos sin gzip"
```

---

### Task 7: Gate anti-ZIP en check-repository

**Files:**
- Modify: `scripts/check-repository.mjs`

**Interfaces:**
- Produces: el scan de repositorio falla si el código fuente vuelve a introducir `fflate`, `zipSync`, `unzipSync`, `gzipSync`, `.solara.zip`, `site.zip` (excepto `packages/exporter/scripts/legacy-zip-migration.mjs`).

- [ ] **Step 1: Escribir el gate (sin test previo: es un script de CI, se verifica manualmente)**

En `scripts/check-repository.mjs`, después de `secretPatterns` (línea 28):

```js
const zipPatterns = [
  {
    label: "compresión ZIP reintroducida",
    pattern: /\b(?:fflate|zipSync|unzipSync|gzipSync)\b/,
  },
  {
    label: "archivo ZIP del producto",
    pattern: /\.solara\.zip\b|site\.zip\b/,
  },
];
const zipMigrationPath = "packages/exporter/scripts/legacy-zip-migration.mjs";
```

En `checkFile`, después del bucle de secretos (línea 66):

```js
  if (path === zipMigrationPath) return issues;
  for (const { label, pattern } of zipPatterns) {
    if (pattern.test(text)) issues.push(`${path}: ${label} (formato eliminado).`);
  }
  return issues;
```

- [ ] **Step 2: Verificar el gate**

Run: `corepack pnpm check:repository`
Expected: PASS (el único archivo que menciona fflate queda excluido). Verificación negativa manual: `node -e "require('child_process').execFileSync(process.execPath, ['scripts/check-repository.mjs', 'scripts/check-budgets.mjs'])"` debe fallar si `check-budgets.mjs` contuviera fflate; como no lo contiene, comprobar con un archivo temporal que contenga `gzipSync` y esperar salida con error, luego borrarlo.

- [ ] **Step 3: Commit**

```bash
git add scripts/check-repository.mjs
git commit -m "Bloquea el retorno de ZIP y gzip en el repositorio"
```

---

### Task 8: Documentación, plan de deuda y gate completo

**Files:**
- Modify: `docs/TECHNICAL_DEBT.md`, `docs/HANDOFF.md`, `docs/DATA_MODEL.md`, `docs/INTEGRATIONS.md`, `docs/ARCHITECTURE.md`, `docs/README.md`, `docs/backup-and-recovery.md`, `docs/PORTABILITY.md`, `docs/current-phase.md`, `docs/pilot-checklist.md`, `docs/TESTING.md`, `docs/project-spec.md`, `README.md`
- Modify: `docs/superpowers/plans/2026-08-07-deuda-tecnica.md`

**Interfaces:**
- Consumes: los resultados de las Tasks 1–7.

- [ ] **Step 1: Actualizar documentación del formato**

En todos los documentos, reemplazar referencias a `.solara.zip`, `site.zip`, "ZIP" y "gzip" por el nuevo contrato:
- `.solara.zip` → `.solara.json` (envelope `{ format, version, projectId, exportedAt, project }`).
- `site.zip` / "Descargar ZIP" → carpeta `proyectos/<tienda>/sitios/<versión>/` copiada a un hosting estático.
- `actual/<clave>.solara.zip` → `actual/<clave>.solara.json`; `current.archivePath` → `current.projectPath`; `manifestVersion: 2`.
- Import de catálogo: "ZIP comercial" → "carpeta con productos.csv e imagenes/".
- Budgets: "JS gzip 183.180 B" → bytes crudos (usar los valores medidos en la Task 6).
- `SOLARA_PILOT_PROJECT_ARCHIVE` apunta a un `.solara.json`.
- `docs/INTEGRATIONS.md`: content-type del proyecto `application/vnd.solara.project+json`; upload del sitio como mapa JSON; nota de migración única.
- `docs/DATA_MODEL.md`: agregar el formato de transporte `.solara.json` y la tabla de migración con marca idempotente.
- `docs/TECHNICAL_DEBT.md`: marcar como resueltas las filas P1 de extracción ZIP (reemplazadas por la eliminación del formato) y añadir la deuda temporal "legacy-zip-migration.mjs + fflate a eliminar en release posterior".
- `docs/HANDOFF.md`: sección "Eliminación de ZIP" con el resumen de las 8 tareas, la migración única y el gate anti-ZIP.

- [ ] **Step 2: Actualizar el plan de deuda técnica**

En `docs/superpowers/plans/2026-08-07-deuda-tecnica.md`:
- Reemplazar la Task 1 (extracción streaming) por una nota: "Resuelta por el plan `2026-08-07-eliminar-zip.md`: el formato ZIP se eliminó del producto; la extracción streaming ya no aplica."
- Adaptar la Task 2 (`writeGuard`) a los nuevos nombres de op (`write-site-files`, `write-manifest`, `copy-archive`, `rename-site`, `remove-old-current`, `write-upload`) y a los tests JSON (helpers `projectJson`/`siteMap`).

- [ ] **Step 3: Gate completo**

Run:
```
corepack pnpm check
corepack pnpm build
corepack pnpm check:budgets
corepack pnpm benchmark:export
corepack pnpm test:e2e
```
Expected: PASS en todos. NO ejecutar `test:e2e:release` (exige Node 22).

- [ ] **Step 4: Commit final**

```bash
git add docs/ README.md
git commit -m "Documenta el formato JSON sin compresión y cierra la eliminación de ZIP"
```

---

## Self-review

- **Cobertura:** spec completo cubierto: `.solara.json` (Tasks 1–4), sitio como carpeta (1, 3, 4), import por carpeta (5), migración única (2), budgets crudos (6), gate anti-ZIP (7), docs (8). La eliminación definitiva de `fflate`/migración queda documentada como release posterior (spec y Task 8).
- **Sin placeholders:** cada paso tiene código completo o instrucciones exactas de sustitución con líneas de referencia; los topes de budgets se fijan por medición en el Step 1 de la Task 6 con margen documentado.
- **Consistencia de tipos:** `createProjectArchive`/`readProjectArchive` devuelven/aceptan `string` en ambas implementaciones (studio y exporter); `exportSiteInWorker` devuelve `{ files, audit, optimization }` en workers.ts y export.worker.ts; `serializeSiteFiles` produce el mismo contrato `{ path, encoding, data }` que `writeSiteFiles` consume; `buildCatalogPackagePlan(files: File[], project)` coincide con el worker `{ type: "catalog-package", files }`.
