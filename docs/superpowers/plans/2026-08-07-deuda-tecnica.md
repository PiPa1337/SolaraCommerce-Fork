# Resolución de deuda técnica Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver las partidas de `docs/TECHNICAL_DEBT.md` sin cambiar `StoreProjectV2Schema`, el renderer compartido ni el contrato público del storefront.

**Architecture:** Cuatro fases independientes: (1) hardening del almacenamiento local y su handler (P1 + P3 de storage), (2) contratos y tipos (P2), (3) refactors de Studio para reducir archivos grandes (P2), (4) documentación y cierre. Cada fase produce software testeable por sí mismo; las fases 2–3 no dependen de la 1.

**Tech Stack:** Node 22+ (release), pnpm 10.15.1 vía `corepack`, Vitest 3.2.4, `fflate` 0.8.2 (sólo temporal en `legacy-zip-migration.mjs`), Dexie 4.2.0 + `fake-indexeddb` (tests de Studio), Playwright Chromium para E2E.

## Global Constraints

- No modificar `StoreProjectV2Schema` ni el literal `schemaVersion: 2` (contrato persistido).
- No agregar dependencias de runtime; `fflate` queda temporalmente en `packages/exporter/scripts/legacy-zip-migration.mjs` y se elimina en un release posterior.
- `proyectos/`, `.solara-runtime/`, `.release/`, `dist/` y reportes no entran al commit.
- El servicio local conserva obligatoriamente: validación de rutas relativas del mapa del sitio, `409` de conflicto, lock por tienda, manifest atómico con rename, y el hook `faultInjector` (sólo tests).
- `solara-request-handler.mjs` es compartido por HTTP (`serve.mjs`) y Electron (`apps/desktop/src/main.mjs`): cualquier endpoint nuevo debe probar ambos transportes sin cambiar el contrato de respuestas.
- Gates: ejecutar el paquete afectado (`corepack pnpm --filter <paquete> test` y `typecheck`), luego el gate completo `corepack pnpm check` + `corepack pnpm test:e2e` al cerrar fases que tocan Studio.
- `test:e2e:release` exige Node 22; el entorno local puede tener Node 24 y no se presenta como validación release.
- Commits breves en español; un commit por task, con `git add` de archivos explícitos.
- Todos los tests del storage crean carpetas temporales con `mkdtemp(join(tmpdir(), ...))` y las eliminan en `finally`.

---

### Task 1: Extracción streaming de ZIP con límites — RESUELTA

Resuelta por el plan
[`2026-08-07-eliminar-zip.md`](../2026-08-07-eliminar-zip.md): el formato ZIP
se eliminó del producto y la extracción streaming ya no aplica. El respaldo
editable es `.solara.json` y el sitio público se escribe como carpeta desde un
mapa de archivos JSON validado (`writeSiteFiles` en
`packages/exporter/scripts/local-project-storage.mjs`). La única lectura de ZIP
restante es la migración única `legacy-zip-migration.mjs`, que se elimina en un
release posterior (ver `docs/TECHNICAL_DEBT.md`).

---

### Task 2: Fallos de escritura deterministas (disco lleno / permisos)

**Files:**
- Modify: `packages/exporter/scripts/local-project-storage.mjs`
- Test: `packages/exporter/src/local-project-storage.test.mjs`

**Interfaces:**
- Consumes: hook `faultInjector` ya existente (checkpoints por etapa).
- Produces: nueva opción de storage `writeGuard: (op: { op: string, pathname: string }) => Promise<void> | void` (sólo tests; el handler nunca la inyecta). Ops emitidas: `write-upload`, `write-site-files`, `rename-site`, `copy-archive`, `write-manifest`, `remove-old-current`. Helper interno `guardWrite(op, pathname)`. Los tests usan los helpers JSON del storage V2 (`projectJson()` y `siteMap([...])`) en lugar de los helpers de ZIP eliminados.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final del `describe` de `local-project-storage.test.mjs`:

```js
  it("simula disco lleno al escribir el manifest sin reemplazar la versión anterior", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-storage-enospc-"));
    try {
      const storage = createLocalProjectStorage({ applicationRoot: root });
      const first = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T10:00:00.000Z",
        expectedVersion: null,
      });
      await upload(storage, first.transactionId, "project", projectJson());
      await upload(
        storage,
        first.transactionId,
        "site",
        siteMap([{ path: "index.html", encoding: "utf8", data: "<main>v1</main>" }]),
      );
      const firstReceipt = await storage.commit(first.transactionId);

      let failingOp = "";
      const guarded = createLocalProjectStorage({
        applicationRoot: root,
        writeGuard: async ({ op }) => {
          if (op === failingOp) {
            const error = new Error(`escritura rechazada: ${op}`);
            error.code = "ENOSPC";
            throw error;
          }
        },
      });
      const attempt = await guarded.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T11:00:00.000Z",
        expectedVersion: firstReceipt.version,
      });
      await upload(guarded, attempt.transactionId, "project", projectJson("v2"));
      failingOp = "write-manifest";
      await expect(guarded.commit(attempt.transactionId)).rejects.toThrow(/escritura rechazada/i);
      const listing = await storage.list();
      expect(listing.projects[0]).toMatchObject({ version: 1, siteVersion: 1 });
      expect((await storage.readCurrent(projectId)).manifest.current.version).toBe(1);
      await guarded.abort(attempt.transactionId);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("simula permisos revocados al escribir el sitio sin dejar carpetas huérfanas", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-storage-eacces-"));
    try {
      const storage = createLocalProjectStorage({ applicationRoot: root });
      const first = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T10:00:00.000Z",
        expectedVersion: null,
      });
      await upload(storage, first.transactionId, "project", projectJson());
      await upload(
        storage,
        first.transactionId,
        "site",
        siteMap([{ path: "index.html", encoding: "utf8", data: "<main>v1</main>" }]),
      );
      const firstReceipt = await storage.commit(first.transactionId);

      let failingOp = "";
      const guarded = createLocalProjectStorage({
        applicationRoot: root,
        writeGuard: async ({ op }) => {
          if (op === failingOp) {
            const error = new Error(`escritura rechazada: ${op}`);
            error.code = "EACCES";
            throw error;
          }
        },
      });
      const attempt = await guarded.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T11:00:00.000Z",
        expectedVersion: firstReceipt.version,
      });
      await upload(guarded, attempt.transactionId, "project", projectJson("v2"));
      await upload(
        guarded,
        attempt.transactionId,
        "site",
        siteMap([{ path: "index.html", encoding: "utf8", data: "<main>v2</main>" }]),
      );
      failingOp = "write-site-files";
      await expect(guarded.commit(attempt.transactionId)).rejects.toThrow(/escritura rechazada/i);
      const sitesRoot = join(
        root,
        "proyectos",
        (await storage.list()).projects[0].folder,
        "sitios",
      );
      const siteDirs = (await readdir(sitesRoot)).filter((name) => !name.startsWith("."));
      expect(siteDirs).toHaveLength(1);
      expect(siteDirs[0]).toBe(firstReceipt.key);
      await guarded.abort(attempt.transactionId);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("permite reintentar después de un fallo transitorio de escritura", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-storage-retry-"));
    try {
      let failingOp = "";
      const storage = createLocalProjectStorage({
        applicationRoot: root,
        writeGuard: async ({ op }) => {
          if (op === failingOp) throw new Error(`escritura rechazada: ${op}`);
        },
      });
      const first = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T10:00:00.000Z",
        expectedVersion: null,
      });
      await upload(storage, first.transactionId, "project", projectJson());
      await upload(
        storage,
        first.transactionId,
        "site",
        siteMap([{ path: "index.html", encoding: "utf8", data: "<main>v1</main>" }]),
      );
      const firstReceipt = await storage.commit(first.transactionId);

      failingOp = "rename-site";
      const attempt = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T11:00:00.000Z",
        expectedVersion: firstReceipt.version,
      });
      await upload(storage, attempt.transactionId, "project", projectJson("v2"));
      await upload(
        storage,
        attempt.transactionId,
        "site",
        siteMap([{ path: "index.html", encoding: "utf8", data: "<main>v2</main>" }]),
      );
      await expect(storage.commit(attempt.transactionId)).rejects.toThrow(/escritura rechazada/i);
      await storage.abort(attempt.transactionId);

      failingOp = "";
      const retry = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T11:00:00.000Z",
        expectedVersion: firstReceipt.version,
      });
      await upload(storage, retry.transactionId, "project", projectJson("v2"));
      await upload(
        storage,
        retry.transactionId,
        "site",
        siteMap([{ path: "index.html", encoding: "utf8", data: "<main>v2</main>" }]),
      );
      const receipt = await storage.commit(retry.transactionId);
      expect(receipt).toMatchObject({ version: 2, status: "synced" });
      expect(receipt.site?.version).toBe(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
```

Nota: el test de reintento falla al inicio porque `writeGuard` todavía no existe como opción; al inyectarla en la firma pero no emitir ops, el commit "rename-site" no falla. Eso es correcto: primero se implementa la opción con las guardas y el test pasa.

- [ ] **Step 2: Ejecutar los tests para verificar que fallan**

Run: `corepack pnpm --filter @solara/exporter test`
Expected: FAIL — "writeGuard" no se usa en ningún op; el test de reintento falla porque el primer commit no es rechazado.

- [ ] **Step 3: Implementar la guarda de escritura**

En `packages/exporter/scripts/local-project-storage.mjs`:

1. En `createLocalProjectStorage` (junto al `faultInjector`, línea 217):

```js
  const writeGuard =
    typeof options.writeGuard === "function" ? options.writeGuard : undefined;
  const guardWrite = async (op, pathname) => {
    await writeGuard?.({ op, pathname });
  };
```

2. En `streamToFile`, antes de `handle.write(buffer)` dentro del bucle (línea 116), agregar la guarda una sola vez antes del bucle:

```js
  await guardWrite("write-upload", pathname);
```

3. En `commit`, agregar guardas antes de cada operación mutante:

```js
    // antes de writeSiteFiles (línea 429):
        await guardWrite("write-site-files", temporarySite);
        siteInfo = await writeSiteFiles(join(transaction.root, "site-map.json"), temporarySite, {
    // antes de rename(temporarySite, finalSite) (línea 435):
        await guardWrite("rename-site", finalSite);
        await rename(temporarySite, finalSite);
    // antes de copyFile (línea 453):
    await guardWrite("copy-archive", temporaryArchivePath);
    await copyFile(join(transaction.root, "project.json"), temporaryArchivePath);
    // antes de writeJsonAtomic del manifest (línea 485):
    await guardWrite("write-manifest", join(storeRoot, "manifest.json"));
    await writeJsonAtomic(join(storeRoot, "manifest.json"), manifest);
    // antes del rm del oldCurrent (línea 489):
    if ((await fileExists(oldCurrent)) && oldCurrent !== archivePath) {
      await guardWrite("remove-old-current", oldCurrent);
      await rm(oldCurrent, { force: true });
    }
```

- [ ] **Step 4: Ejecutar los tests para verificar que pasan**

Run: `corepack pnpm --filter @solara/exporter test`
Expected: PASS — los 3 tests nuevos de `writeGuard` y los tests previos del storage.

- [ ] **Step 5: Commit**

```bash
git add packages/exporter/scripts/local-project-storage.mjs packages/exporter/src/local-project-storage.test.mjs
git commit -m "Simula fallos de escritura deterministas en el almacenamiento local"
```

---

### Task 3: Matriz de reparse points (junctions Windows / symlinks POSIX)

**Files:**
- Create: `packages/exporter/src/reparse-points.test.mjs`
- Modify: ninguno (sólo si el test descubre que `assertNoReparsePoints` no detecta junctions, se extiende `packages/exporter/scripts/portable-layout.mjs`)

**Interfaces:**
- Consumes: `assertNoReparsePoints` de `packages/exporter/scripts/portable-layout.mjs` y `createLocalProjectStorage` con `ensureRoots`.
- Produces: matriz de tests que fija el comportamiento defensivo actual.

- [ ] **Step 1: Escribir los tests que fallan o se saltan según plataforma**

Crear `packages/exporter/src/reparse-points.test.mjs`:

```js
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createLocalProjectStorage } from "../scripts/local-project-storage.mjs";
import { assertNoReparsePoints } from "../scripts/portable-layout.mjs";

const execFileAsync = promisify(execFile);

describe.runIf(process.platform === "win32")("reparse points en Windows", () => {
  it("rechaza un junction dentro de proyectos/", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-reparse-"));
    try {
      const outside = join(root, "afuera");
      const projects = join(root, "proyectos");
      const escaped = join(projects, "escapada");
      await mkdir(outside, { recursive: true });
      await mkdir(projects, { recursive: true });
      try {
        await execFileAsync("cmd", ["/c", "mklink", "/J", escaped, outside]);
      } catch {
        return; // el entorno no permite crear junctions; no es un fallo del servicio.
      }
      const storage = createLocalProjectStorage({ applicationRoot: root });
      await expect(storage.ensureRoots()).rejects.toThrow(/enlace simbólico/i);
      await expect(assertNoReparsePoints(projects, escaped)).rejects.toThrow(/enlace simbólico/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe.runIf(process.platform !== "win32")("symlinks en POSIX", () => {
  it("rechaza un symlink dentro de proyectos/", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-reparse-"));
    try {
      const outside = join(root, "afuera");
      const projects = join(root, "proyectos");
      const escaped = join(projects, "escapada");
      await mkdir(outside, { recursive: true });
      await mkdir(projects, { recursive: true });
      await symlink(outside, escaped, "dir");
      const storage = createLocalProjectStorage({ applicationRoot: root });
      await expect(storage.ensureRoots()).rejects.toThrow(/enlace simbólico/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Ejecutar para ver el resultado según la plataforma**

Run: `corepack pnpm --filter @solara/exporter test`
Expected: en Windows, los tests del describe Windows deben pasar si `lstat` reporta junctions como symlinks (Node 22 lo hace). En POSIX debe pasar el describe de symlinks. Si un junction NO se detecta (test falla), pasar al Step 3; si todo pasa, ir al Step 5.

- [ ] **Step 3 (sólo si falla en Windows): extender la detección**

En `packages/exporter/scripts/portable-layout.mjs`, dentro del bucle de `assertNoReparsePoints`, reemplazar:

```js
    const info = await lstat(current);
    if (info.isSymbolicLink())
      throw new Error("La instalación contiene un enlace simbólico no permitido.");
```

por:

```js
    const info = await lstat(current);
    // Windows reporta los junctions como symlinks; la máscara de modo cubre
    // los reparse points que lstat no clasifica en versiones antiguas.
    const isReparse = info.isSymbolicLink() || (info.mode & 0o170000) === 0o120000;
    if (isReparse)
      throw new Error("La instalación contiene un enlace simbólico no permitido.");
```

Luego re-ejecutar el test de la Task (Step 4) y documentar en el commit si se requirió este cambio.

- [ ] **Step 4: Ejecutar los tests para verificar que pasan**

Run: `corepack pnpm --filter @solara/exporter test`
Expected: PASS en la plataforma de ejecución; el otro describe queda skipped.

- [ ] **Step 5: Commit**

```bash
git add packages/exporter/src/reparse-points.test.mjs packages/exporter/scripts/portable-layout.mjs
git commit -m "Agrega matriz de reparse points al almacenamiento local"
```

---

### Task 4: Diagnóstico de recovery persistido

**Files:**
- Modify: `packages/exporter/scripts/local-project-storage.mjs` (`list`, líneas 257–299)
- Test: `packages/exporter/src/local-project-storage.test.mjs`

**Interfaces:**
- Consumes: `writeJsonAtomic`, `readJson`, `rm` (ya internos).
- Produces: sidecar `recovery.json` en `proyectos/<carpeta>/` con `{ format: "solara-local-recovery", folder, message, detectedAt }`. `list()` devuelve mensajes estables entre llamadas; las carpetas sanas eliminan el sidecar viejo. Sin cambios en `LocalStorageRecovery`.

- [ ] **Step 1: Escribir el test que falla**

Agregar al final del `describe` de `local-project-storage.test.mjs`:

```js
  it("persiste el diagnóstico de recovery entre listados", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-storage-recovery-"));
    try {
      const storage = createLocalProjectStorage({ applicationRoot: root });
      await storage.ensureRoots();
      const brokenRoot = join(root, "proyectos", "tienda-rota");
      await mkdir(brokenRoot, { recursive: true });
      await writeFile(join(brokenRoot, "manifest.json"), "{ esto no es json", "utf8");

      const first = await storage.list();
      expect(first.recovery).toHaveLength(1);
      expect(first.recovery[0].message.length).toBeGreaterThan(0);
      const second = await storage.list();
      expect(second.recovery[0].message).toBe(first.recovery[0].message);

      const sidecar = join(brokenRoot, "recovery.json");
      expect(JSON.parse(await readFile(sidecar, "utf8")).format).toBe("solara-local-recovery");

      await rm(join(brokenRoot, "manifest.json"), { force: true });
      await rm(sidecar, { force: true });
      expect((await storage.list()).recovery).toHaveLength(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
```

Agregar `writeFile` al import de `node:fs/promises` del archivo de test (línea 1).

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `corepack pnpm --filter @solara/exporter test`
Expected: FAIL — el sidecar `recovery.json` no se crea (`ENOENT` al leerlo) y el mensaje del segundo listado puede variar.

- [ ] **Step 3: Implementar el sidecar**

En `list()` de `local-project-storage.mjs`:

1. En el `try` del bucle (después de leer el manifest válido, antes de `projects.push`), eliminar sidecars viejos:

```js
        await rm(join(root, "recovery.json"), { force: true });
```

2. Reemplazar el bloque `catch` del bucle por:

```js
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "No se pudo leer el manifest local.";
        const diagnosticPath = join(root, "recovery.json");
        try {
          const existing = await readJson(diagnosticPath);
          if (typeof existing?.message === "string") {
            recovery.push({ folder: entry.name, message: existing.message });
          } else {
            throw new Error("Diagnóstico sin mensaje.");
          }
        } catch {
          recovery.push({ folder: entry.name, message });
        }
        try {
          await writeJsonAtomic(diagnosticPath, {
            format: "solara-local-recovery",
            folder: entry.name,
            message,
            detectedAt: new Date().toISOString(),
          });
        } catch {
          // Carpeta de solo lectura: se conserva el diagnóstico anterior si existe.
        }
      }
```

- [ ] **Step 4: Ejecutar los tests para verificar que pasan**

Run: `corepack pnpm --filter @solara/exporter test`
Expected: PASS — test nuevo y storage completo.

- [ ] **Step 5: Commit**

```bash
git add packages/exporter/scripts/local-project-storage.mjs packages/exporter/src/local-project-storage.test.mjs
git commit -m "Persiste el diagnóstico de recovery en sidecar por carpeta"
```

---

### Task 5: Endpoint para abrir la carpeta de una tienda en Explorer

**Files:**
- Modify: `packages/exporter/scripts/local-project-storage.mjs` (función `openFolder`)
- Modify: `packages/exporter/scripts/solara-request-handler.mjs` (ruta `open-folder`, import de `spawn`, opción `openFolderInExplorer`)
- Modify: `apps/studio/src/lib/localStorage.ts` (cliente `openLocalProjectFolder`)
- Modify: `apps/studio/src/App.tsx` (prop `onOpenFolder` hacia Dashboard)
- Modify: `apps/studio/src/features/Dashboard.tsx` (botón "Abrir carpeta" en el panel de acciones)
- Create: `packages/exporter/src/request-handler.test.mjs`

**Interfaces:**
- Produces: `storage.openFolder(projectId): Promise<{ folder: string, path: string } | undefined>`; endpoint `POST /__solara/storage/projects/{projectId}/open-folder` → `200 { ok: true, folder }` / `404` si la tienda no existe; opción de handler `openFolderInExplorer: (folderPath) => boolean` (default: `spawn("explorer", ...)` sólo en `win32`, devuelve `false` en otras plataformas). Cliente `openLocalProjectFolder(projectId): Promise<{ folder: string }>`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `packages/exporter/src/request-handler.test.mjs`:

```js
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { createSolaraRequestHandler } from "../scripts/solara-request-handler.mjs";

const projectId = "store-open-folder";
const shutdownCookieName = "solara_shutdown";

function projectArchive() {
  return zipSync({
    "manifest.json": strToU8(JSON.stringify({ format: "solara-project", version: 2, projectId })),
    "project.json": strToU8(
      JSON.stringify({ schemaVersion: 2, id: projectId, name: "Prueba", slug: "prueba" }),
    ),
  });
}

function request(method, pathname, headers = {}, body) {
  return {
    method,
    pathname,
    headers,
    body,
    ...(body
      ? {
          [Symbol.asyncIterator]: () =>
            Readable.from([Buffer.from(body)])[Symbol.asyncIterator](),
        }
      : {}),
  };
}

async function createProject(handler) {
  const storage = handler.storage;
  const transaction = await storage.beginSave({
    projectId,
    name: "Prueba",
    slug: "prueba",
    projectUpdatedAt: "2026-08-07T10:00:00.000Z",
    expectedVersion: null,
  });
  await storage.upload(
    transaction.transactionId,
    "project",
    Readable.from([Buffer.from(projectArchive())]),
  );
  return storage.commit(transaction.transactionId);
}

describe("handler: abrir carpeta de una tienda", () => {
  it("abre la carpeta de una tienda existente con la cookie de sesión", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-handler-folder-"));
    try {
      const openFolderInExplorer = vi.fn(() => true);
      const handler = createSolaraRequestHandler({
        applicationRoot: root,
        shutdownToken: "token-test",
        openFolderInExplorer,
        onShutdown: () => {},
      });
      await createProject(handler);
      const response = await handler.handle(
        request("POST", `/__solara/storage/projects/${projectId}/open-folder`, {
          cookie: `${shutdownCookieName}=token-test`,
        }),
      );
      expect(response.status).toBe(200);
      expect(openFolderInExplorer).toHaveBeenCalledOnce();
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.folder).toMatch(/^prueba--[a-f0-9]{8}$/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("responde 404 para tiendas inexistentes y 403 sin sesión", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-handler-folder-"));
    try {
      const handler = createSolaraRequestHandler({
        applicationRoot: root,
        shutdownToken: "token-test",
        openFolderInExplorer: vi.fn(() => true),
        onShutdown: () => {},
      });
      const missing = await handler.handle(
        request("POST", "/__solara/storage/projects/tienda-ausente/open-folder", {
          cookie: `${shutdownCookieName}=token-test`,
        }),
      );
      expect(missing.status).toBe(404);
      const unauthorized = await handler.handle(
        request("POST", `/__solara/storage/projects/${projectId}/open-folder`),
      );
      expect(unauthorized.status).toBe(403);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Ejecutar para verificar que fallan**

Run: `corepack pnpm --filter @solara/exporter test`
Expected: FAIL — el endpoint no existe (404 de `staticResponse` o 405 de storage).

- [ ] **Step 3: Implementar en storage y handler**

1. En `local-project-storage.mjs`, después de `getLastValidSiteDirectory` (línea 521):

```js
  async function openFolder(projectId) {
    const found = await findManifest(projectId);
    if (!found) return undefined;
    return { folder: found.folder, path: found.root };
  }
```

Y exportarlo en el objeto de retorno (línea 564+), junto a `getLastValidSiteDirectory`.

2. En `solara-request-handler.mjs`:

- Agregar al import de `node:fs` (línea 8): no, al import de `node:child_process`:

```js
import { spawn } from "node:child_process";
```

- Agregar la función default después de `storageErrorStatus` (línea 107):

```js
function defaultOpenFolderInExplorer(folderPath) {
  if (process.platform !== "win32") return false;
  spawn("explorer", [folderPath], { detached: true, stdio: "ignore" }).unref();
  return true;
}
```

- En `createSolaraRequestHandler`, leer la opción (junto a `onShutdown`):

```js
  const openFolderInExplorer = options.openFolderInExplorer ?? defaultOpenFolderInExplorer;
```

- Agregar la ruta dentro de `handleStorage`, después del bloque `openSiteMatch` (línea 287):

```js
      const openFolderMatch = /^\/__solara\/storage\/projects\/([^/]+)\/open-folder$/.exec(pathname);
      if (openFolderMatch && request.method === "POST") {
        const result = await storage.openFolder(decodeURIComponent(openFolderMatch[1]));
        if (!result) {
          return jsonResponse(
            404,
            { ok: false, error: "La tienda no existe en disco." },
            sessionHeaders,
          );
        }
        openFolderInExplorer(result.path);
        return jsonResponse(200, { ok: true, folder: result.folder }, sessionHeaders);
      }
```

3. En `apps/studio/src/lib/localStorage.ts`, después de `openLocalSite`:

```ts
export async function openLocalProjectFolder(projectId: string): Promise<{ folder: string }> {
  return requestJson<{ folder: string }>(
    `/__solara/storage/projects/${encodeURIComponent(projectId)}/open-folder`,
    { method: "POST", headers: { Accept: "application/json" } },
  );
}
```

4. En `App.tsx`, dentro del spread condicional de `localStorageStatus.managed` (junto a `onOpenSite`, línea 443):

```tsx
        {...(localStorageStatus.managed
          ? {
              onOpenFolder: async (id: string) => {
                await guard(async () => {
                  const { openLocalProjectFolder } = await loadLocalStorage();
                  await openLocalProjectFolder(id);
                });
              },
            }
          : {})}
```

5. En `Dashboard.tsx`:
- Agregar `onOpenFolder?: (id: string) => Promise<void>` a la interfaz de props del `Dashboard`.
- En el panel de acciones de la tienda (junto al botón de "Abrir sitio", que sólo existe con `onOpenSite`), renderizar cuando `onOpenFolder` esté definido:

```tsx
          {onOpenFolder ? (
            <button type="button" onClick={() => void onOpenFolder(project.id)}>
              Abrir carpeta
            </button>
          ) : null}
```

Usar el mismo `className` y estilo que el botón "Abrir sitio" existente.

- [ ] **Step 4: Ejecutar los tests para verificar que pasan**

Run: `corepack pnpm --filter @solara/exporter test`
Expected: PASS — tests del handler nuevo.

Luego: `corepack pnpm --filter @solara/studio typecheck` y `corepack pnpm --filter @solara/studio test` deben pasar (App.tsx y Dashboard.tsx compilan).

- [ ] **Step 5: Commit**

```bash
git add packages/exporter/scripts/local-project-storage.mjs packages/exporter/scripts/solara-request-handler.mjs packages/exporter/src/request-handler.test.mjs apps/studio/src/lib/localStorage.ts apps/studio/src/App.tsx apps/studio/src/features/Dashboard.tsx
git commit -m "Agrega apertura de carpeta de tienda en Explorer"
```

---

### Task 6: Sentinel de migración de proyectos a disco

**Files:**
- Modify: `apps/studio/src/lib/repository.ts` (tabla Dexie v4 + funciones)
- Modify: `apps/studio/src/lib/repository.test.ts` (tests)
- Modify: `apps/studio/src/App.tsx` (marcar pending/done en ambos bucles de migración)

**Interfaces:**
- Consumes: `persistToDisk(project, expectedVersion)` de `localProjectRepository` (sin cambios).
- Produces: `ProjectMigrationRecord { projectId: string; status: "pending" | "done"; updatedAt: string }`; funciones `markProjectMigration(projectId, status)` y `getProjectMigration(projectId)`.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `apps/studio/src/lib/repository.test.ts` (el archivo ya importa `fake-indexeddb/auto` y `database`):

```ts
describe("sentinel de migración a disco", () => {
  beforeEach(async () => {
    await database.migrations.clear();
  });

  it("registra el estado pending y done por proyecto", async () => {
    await markProjectMigration("store-sentinel", "pending");
    expect((await getProjectMigration("store-sentinel"))?.status).toBe("pending");
    await markProjectMigration("store-sentinel", "done");
    expect((await getProjectMigration("store-sentinel"))?.status).toBe("done");
  });

  it("no mezcla registros de proyectos distintos", async () => {
    await markProjectMigration("store-a", "done");
    await markProjectMigration("store-b", "pending");
    expect((await getProjectMigration("store-a"))?.status).toBe("done");
    expect((await getProjectMigration("store-b"))?.status).toBe("pending");
  });
});
```

Y agregar `markProjectMigration`, `getProjectMigration` al import de `./repository` (línea 8 del test).

- [ ] **Step 2: Ejecutar para verificar que fallan**

Run: `corepack pnpm --filter @solara/studio test`
Expected: FAIL — `database.migrations` no existe en la versión actual de la base (error al abrir o tabla indefinida).

- [ ] **Step 3: Implementar**

1. En `apps/studio/src/lib/repository.ts`:

- Agregar la interfaz después de `RecoveryDraft` (línea 56):

```ts
export interface ProjectMigrationRecord {
  projectId: string;
  status: "pending" | "done";
  updatedAt: string;
}
```

- En la clase `SolaraDatabase` (línea 67), agregar la tabla:

```ts
  migrations!: EntityTable<ProjectMigrationRecord, "projectId">;
```

- En el constructor, después de `this.version(3)` (línea 93):

```ts
    this.version(4).stores({
      projects: "id, status, updatedAt, name",
      assetCache: "hash, cacheKey, recipeVersion, createdAt, lastUsedAt",
      recoveryDrafts: "projectId, updatedAt",
      migrations: "projectId, status, updatedAt",
    });
```

- Agregar las funciones (junto a las otras funciones del repositorio):

```ts
export async function markProjectMigration(
  projectId: string,
  status: ProjectMigrationRecord["status"],
): Promise<void> {
  await database.migrations.put({ projectId, status, updatedAt: new Date().toISOString() });
}

export async function getProjectMigration(
  projectId: string,
): Promise<ProjectMigrationRecord | undefined> {
  return database.migrations.get(projectId);
}
```

2. En `apps/studio/src/App.tsx`:

- Agregar al import de `./lib/repository` (línea 14): `getProjectMigration` y `markProjectMigration`.
- En el primer bucle de migración (línea 106), reemplazar:

```ts
            for (const stored of browserProjects.projects) {
              const diskProject = diskById.get(stored.id);
              if (!diskProject) {
                await persistToDisk(stored.project, null);
                continue;
              }
              if (JSON.stringify(stored.project) !== JSON.stringify(diskProject.project)) {
                await saveRecoveryDraft(stored.project, diskProject.diskVersion ?? 0);
              }
            }
```

por:

```ts
            for (const stored of browserProjects.projects) {
              const diskProject = diskById.get(stored.id);
              if (!diskProject) {
                await markProjectMigration(stored.id, "pending");
                await persistToDisk(stored.project, null);
                await markProjectMigration(stored.id, "done");
                continue;
              }
              if (await getProjectMigration(diskProject.id)) {
                await markProjectMigration(diskProject.id, "done");
              }
              if (JSON.stringify(stored.project) !== JSON.stringify(diskProject.project)) {
                await saveRecoveryDraft(stored.project, diskProject.diskVersion ?? 0);
              }
            }
```

- En el segundo bucle (línea 156), reemplazar:

```ts
          for (const stored of browserResult.projects) {
            await persistToDisk(stored.project, null);
          }
```

por:

```ts
          for (const stored of browserResult.projects) {
            await markProjectMigration(stored.id, "pending");
            await persistToDisk(stored.project, null);
            await markProjectMigration(stored.id, "done");
          }
```

- [ ] **Step 4: Ejecutar los tests para verificar que pasan**

Run: `corepack pnpm --filter @solara/studio test` y `corepack pnpm --filter @solara/studio typecheck`
Expected: PASS en ambos (incluye el test existente de migración de base de datos Dexie en línea 121: la versión 4 agrega una tabla nueva sin alterar las existentes).

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/lib/repository.ts apps/studio/src/lib/repository.test.ts apps/studio/src/App.tsx
git commit -m "Agrega sentinel de migración de proyectos a disco"
```

---

### Task 7: Registro de módulos con tipo discriminado

**Files:**
- Modify: `packages/modules/src/index.ts`
- Test: `packages/modules/src/index.test.ts`

**Interfaces:**
- Consumes: `officialModules` y `catalogModernModules` (arrays `as const` ya existentes).
- Produces: `AnyModule`, `ModuleId = AnyModule["manifest"]["id"]`, `ModuleById = { [Id in ModuleId]: Extract<AnyModule, { manifest: { id: Id } }> }`, `getTypedModule<Id extends ModuleId>(id): ModuleById[Id] | undefined`. `RegisteredModule = ModuleDefinition<any>` se conserva intacto para no romper `renderSections`.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `packages/modules/src/index.test.ts`:

```ts
import { expectTypeOf } from "vitest";

describe("registro de módulos tipado", () => {
  it("resuelve el módulo exacto por id", () => {
    const hero = getTypedModule("catalog-hero");
    expect(hero?.manifest.id).toBe("catalog-hero");
    expect(getTypedModule("no-existe")).toBeUndefined();
  });

  it("afina el tipo por id del módulo", () => {
    const hero = getTypedModule("catalog-hero");
    expectTypeOf(hero).toMatchTypeOf<{ manifest: { id: "catalog-hero" } } | undefined>();
    expectTypeOf(hero).not.toMatchTypeOf<{ manifest: { id: "split-hero" } }>();
    expectTypeOf(getTypedModule("split-hero")).toMatchTypeOf<
      { manifest: { id: "split-hero" } } | undefined
    >();
  });

  it("mantiene ids únicos en el registro", () => {
    const ids = [...officialModules, ...catalogModernModules].map(
      (definition) => definition.manifest.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("catalog-hero");
  });
});
```

Y agregar `getTypedModule`, `officialModules`, `catalogModernModules` al import de `./index` del test.

- [ ] **Step 2: Ejecutar para verificar que fallan**

Run: `corepack pnpm --filter @solara/modules test` y `corepack pnpm --filter @solara/modules typecheck`
Expected: FAIL — `getTypedModule` no existe.

- [ ] **Step 3: Implementar**

En `packages/modules/src/index.ts`, después de la definición de `RegisteredModule` (línea 87):

```ts
export type AnyLegacyModule = (typeof officialModules)[number];
export type AnyCatalogModernModule = (typeof catalogModernModules)[number];
export type AnyModule = AnyLegacyModule | AnyCatalogModernModule;
export type ModuleId = AnyModule["manifest"]["id"];
export type ModuleById = { [Id in ModuleId]: Extract<AnyModule, { manifest: { id: Id } }> };

export function getTypedModule<Id extends ModuleId>(id: Id): ModuleById[Id] | undefined {
  return moduleRegistry[id] as ModuleById[Id] | undefined;
}
```

Exportar los nuevos tipos y la función en el `export { ... }` del archivo.

- [ ] **Step 4: Ejecutar los tests para verificar que pasan**

Run: `corepack pnpm --filter @solara/modules test` y `corepack pnpm --filter @solara/modules typecheck`
Expected: PASS. Además `corepack pnpm --filter @solara/exporter test` debe seguir pasando (el registro runtime no cambió).

- [ ] **Step 5: Commit**

```bash
git add packages/modules/src/index.ts packages/modules/src/index.test.ts
git commit -m "Tipa el registro de módulos por id sin romper el registry runtime"
```

---

### Task 8: Presupuesto medido de fixtures

**Files:**
- Create: `packages/project-schema/src/fixture-budget.test.ts`

**Interfaces:**
- Consumes: `catalogModernStore` (`./catalog-modern-fixture`), `catalogScaleStore` (`./scale-fixture`), `referenceStore` (`./fixture`).
- Produces: techo de 8 MiB por fixture grande y 1 MiB para la pequeña; medición reportada por consola.

- [ ] **Step 1: Escribir el test**

Crear `packages/project-schema/src/fixture-budget.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { catalogModernStore } from "./catalog-modern-fixture";
import { referenceStore } from "./fixture";
import { catalogScaleStore } from "./scale-fixture";

function serializedBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

describe("presupuesto de fixtures locales", () => {
  it("mide la fixture visual demo y fija un techo de 8 MiB", () => {
    const bytes = serializedBytes(catalogModernStore);
    console.info(`catalogModernStore: ${(bytes / 1024).toFixed(1)} KiB`);
    expect(bytes).toBeLessThan(8 * 1024 * 1024);
  });

  it("mide la fixture de escala y fija un techo de 8 MiB", () => {
    const bytes = serializedBytes(catalogScaleStore);
    console.info(`catalogScaleStore: ${(bytes / 1024).toFixed(1)} KiB`);
    expect(bytes).toBeLessThan(8 * 1024 * 1024);
  });

  it("mide la fixture pequeña de referencia y fija un techo de 1 MiB", () => {
    const bytes = serializedBytes(referenceStore);
    console.info(`referenceStore: ${(bytes / 1024).toFixed(1)} KiB`);
    expect(bytes).toBeLessThan(1024 * 1024);
  });
});
```

- [ ] **Step 2: Ejecutar para verificar que pasa y registrar la medición**

Run: `corepack pnpm --filter @solara/project-schema test`
Expected: PASS — anotar los KiB reportados de `catalogModernStore` y `catalogScaleStore` (se usan en la Task 13 para documentar la decisión de conservar data URLs).

- [ ] **Step 3: Commit**

```bash
git add packages/project-schema/src/fixture-budget.test.ts
git commit -m "Agrega presupuesto de tamaño a las fixtures locales"
```

---

### Task 9: Dividir Builder.tsx

**Files:**
- Create: `apps/studio/src/features/builder/SettingsInspector.tsx`, `apps/studio/src/features/builder/RepeaterEditor.tsx`, `apps/studio/src/features/builder/HeroSlidesEditor.tsx`
- Modify: `apps/studio/src/features/Builder.tsx` (imports y remoción de los bloques movidos)

**Interfaces:**
- Consumes: props actuales de cada función dentro de `Builder.tsx` (se conservan textuales).
- Produces: `SettingsInspector(props)`, `RepeaterEditor(props)`, `HeroSlidesEditor(props)` exportados desde los archivos nuevos; `Builder.tsx` mantiene su export público `Builder` y su comportamiento byte a byte.

- [ ] **Step 1: Mover SettingsInspector**

- Crear `apps/studio/src/features/builder/SettingsInspector.tsx` con el contenido textual de la función `SettingsInspector` (líneas 395–606 de `Builder.tsx`), declarada como `export function SettingsInspector(...)`.
- Copiar los imports que esa función necesita (tipos de `@solara/modules`/`@solara/module-sdk`, helpers de `components/Ui`, iconos de `@phosphor-icons/react`) desde el encabezado de `Builder.tsx`; eliminar esos imports del archivo original si dejan de usarse allí.
- En `Builder.tsx`, reemplazar el bloque movido por `import { SettingsInspector } from "./builder/SettingsInspector";` y eliminar la definición local.

- [ ] **Step 2: Mover RepeaterEditor**

- Crear `apps/studio/src/features/builder/RepeaterEditor.tsx` con el contenido textual de `RepeaterEditor` (líneas 607–819).
- Ajustar imports igual que en Step 1 (comparte tipos con `SettingsInspector`; si ambos usan los mismos tipos de props, mantenerlos duplicados en cada archivo para que sean autocontenidos).
- En `Builder.tsx`, importar y eliminar la definición local.

- [ ] **Step 3: Mover HeroSlidesEditor**

- Crear `apps/studio/src/features/builder/HeroSlidesEditor.tsx` con `HeroSlidesEditor` (líneas 820 en adelante hasta el final del archivo, antes de cualquier export).
- En `Builder.tsx`, importar y eliminar la definición local.

- [ ] **Step 4: Verificar que no cambió el comportamiento**

Run: `corepack pnpm --filter @solara/studio typecheck` y `corepack pnpm --filter @solara/studio test`
Expected: PASS. Luego verificación E2E del builder (se ejecuta en el cierre de fase): `corepack pnpm test:e2e` con Chromium.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/features/Builder.tsx apps/studio/src/features/builder/
git commit -m "Divide Builder en inspector y editores por responsabilidad"
```

---

### Task 10: Dividir Catalog.tsx

**Files:**
- Create: `apps/studio/src/features/catalog/CatalogToolbar.tsx`, `apps/studio/src/features/catalog/CategoryTree.tsx`
- Modify: `apps/studio/src/features/Catalog.tsx`

**Interfaces:**
- Consumes: props actuales del JSX que se mueve (se conservan textuales).
- Produces: `CatalogToolbar(props)` y `CategoryTree(props)` exportados; `Catalog.tsx` conserva `export function Catalog(...)` y el comportamiento. Los helpers puros `categoryTree` (línea 68) y `categoryLabel` (línea 87) pasan a `CategoryTree.tsx`.

- [ ] **Step 1: Extraer el árbol de categorías**

- Crear `apps/studio/src/features/catalog/CategoryTree.tsx`:
  - Mover los helpers `categoryTree` y `categoryLabel` (líneas 68–90) como funciones locales del archivo nuevo.
  - Mover el JSX del árbol de categorías (la sección colapsable que renderiza el árbol con cantidades directas/heredadas y el bloqueo de ciclos; localizarla por el título "Categorías" dentro del JSX de `Catalog`) a un componente `export function CategoryTree(props)`.
  - Copiar imports necesarios (`Category`, `StoreProjectV1` de `@solara/project-schema`, helpers de `components/Ui`).
- En `Catalog.tsx`, importar `CategoryTree` desde `./catalog/CategoryTree` y reemplazar el bloque movido por `<CategoryTree {...} />` con las mismas props; eliminar los helpers locales.

- [ ] **Step 2: Extraer la toolbar**

- Crear `apps/studio/src/features/catalog/CatalogToolbar.tsx`:
  - Mover el JSX de la toolbar de catálogo (buscador, filtros, selección y paginación; marcadores `data-testid="select-filtered-products"` línea 703 y `data-testid="apply-bulk-status"` línea 742, paginación `data-testid="next-catalog-page"` línea 1060) a `export function CatalogToolbar(props)`.
  - Copiar imports necesarios.
- En `Catalog.tsx`, importar y reemplazar el bloque movido; conservar el estado y los callbacks (productos seleccionados, búsqueda, página) en `Catalog` y pasarlos como props.

- [ ] **Step 3: Verificar que no cambió el comportamiento**

Run: `corepack pnpm --filter @solara/studio typecheck` y `corepack pnpm --filter @solara/studio test`
Expected: PASS. La verificación E2E de catálogo (spec `tests/e2e/catalog-modern.spec.ts` y ediciones de catálogo) corre en el cierre de fase.

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src/features/Catalog.tsx apps/studio/src/features/catalog/CatalogToolbar.tsx apps/studio/src/features/catalog/CategoryTree.tsx
git commit -m "Divide Catalog en toolbar y árbol de categorías"
```

---

### Task 11: Dividir Dashboard.tsx

**Files:**
- Create: `apps/studio/src/features/dashboard/ProjectCard.tsx`, `apps/studio/src/features/dashboard/DashboardToolbar.tsx`
- Modify: `apps/studio/src/features/Dashboard.tsx`

**Interfaces:**
- Consumes: props actuales del JSX movido.
- Produces: `ProjectCard(props)` y `DashboardToolbar(props)` exportados; `Dashboard` conserva su export y comportamiento. `statusLabel` (línea 60) y helpers de ordenamiento/filtrado pasan a los archivos que los usen.

- [ ] **Step 1: Extraer la tarjeta de proyecto**

- Crear `apps/studio/src/features/dashboard/ProjectCard.tsx`:
  - Mover la tarjeta de proyecto (grilla/lista: nombre, estado, productos, categorías, fecha, acciones "Abrir", "Respaldar", "Duplicar", "Archivar/Restaurar", "Abrir sitio", "Descargar respaldo", "Abrir carpeta") a `export function ProjectCard(props)`.
  - Mover `statusLabel` y el helper de formateo de fechas que use.
  - Copiar imports (`StoredProject` de `../../lib/repository`, iconos).
- En `Dashboard.tsx`, importar `ProjectCard` y reemplazar el bloque de la tarjeta; pasar las mismas props (incluida `onOpenFolder` si existe).

- [ ] **Step 2: Extraer la toolbar**

- Crear `apps/studio/src/features/dashboard/DashboardToolbar.tsx`:
  - Mover buscador tolerante a acentos, filtro por estado, orden y alternancia grilla/lista a `export function DashboardToolbar(props)`.
- En `Dashboard.tsx`, importar y reemplazar.

- [ ] **Step 3: Verificar que no cambió el comportamiento**

Run: `corepack pnpm --filter @solara/studio typecheck` y `corepack pnpm --filter @solara/studio test`
Expected: PASS. La spec E2E de dashboard (inicio, selección de tiendas en `tests/e2e/`) corre en el cierre de fase.

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src/features/Dashboard.tsx apps/studio/src/features/dashboard/
git commit -m "Divide Dashboard en tarjeta y toolbar"
```

---

### Task 12: Dividir styles.css por @import con cascada preservada

**Files:**
- Create: `apps/studio/src/base/base.css`, `apps/studio/src/base/feedback.css`, `apps/studio/src/dashboard/cosmic.css`, `apps/studio/src/editorial/editorial.css`
- Modify: `apps/studio/src/styles.css`

**Interfaces:**
- Produces: `styles.css` queda como punto de entrada con 4 `@import` en el mismo orden de cascada actual (base → cosmic → editorial → feedback). Cada archivo nuevo conserva el encabezado de biome y los comentarios de sección.

- [ ] **Step 1: Cortar por secciones**

Secciones actuales de `apps/studio/src/styles.css` (82.6 KB):
- Líneas 1–556 (legacy Studio + dashboard legacy) → `apps/studio/src/base/base.css`
- Líneas 557–3603 (`/* Cosmic dashboard ... */`) → `apps/studio/src/dashboard/cosmic.css`
- Líneas 3604–4581 (`/* Phase 4: warm editorial system */`) → `apps/studio/src/editorial/editorial.css`
- Líneas 4582–fin (`/* Keep global feedback ... */`) → `apps/studio/src/base/feedback.css`

Cada archivo nuevo comienza con:

```css
/* biome-ignore-all lint/style/noDescendingSpecificity: legacy and cosmic dashboard shells share selectors by design. */
```

seguido del comentario de sección original (si existía) y el contenido de su rango textual.

- [ ] **Step 2: Reescribir styles.css como punto de entrada**

`apps/studio/src/styles.css` queda con exactamente:

```css
/* biome-ignore-all lint/style/noDescendingSpecificity: legacy and cosmic dashboard shells share selectors by design. */
@import "./base/base.css";
@import "./dashboard/cosmic.css";
@import "./editorial/editorial.css";
@import "./base/feedback.css";
```

Vite procesa los `@import` en orden en el build; el orden de cascada queda idéntico al archivo original. No cambiar selectores, valores ni orden dentro de los rangos.

- [ ] **Step 3: Verificar build, budgets y E2E visual**

Run: `corepack pnpm --filter @solara/studio build` y `corepack pnpm check:budgets`
Expected: PASS con los mismos tamaños (CSS gzip 13.061 B) porque el bundle final es el mismo conjunto de reglas.

Luego: `corepack pnpm test:e2e` (Chromium) para confirmar que el dashboard y el estudio renderizan igual.

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src/styles.css apps/studio/src/base/ apps/studio/src/dashboard/ apps/studio/src/editorial/
git commit -m "Divide el CSS del estudio por secciones con cascada preservada"
```

---

### Task 13: Documentación y cierre

**Files:**
- Modify: `docs/TECHNICAL_DEBT.md`, `docs/HANDOFF.md`, `docs/DATA_MODEL.md`, `docs/INTEGRATIONS.md`, `docs/ARCHITECTURE.md`

**Interfaces:**
- Consumes: los resultados de todas las tasks anteriores (nombres de endpoint, tabla de migración, mediciones de la Task 8).

- [ ] **Step 1: Actualizar TECHNICAL_DEBT.md**

Marcar como resueltas (con referencia a la task) las filas: extracción ZIP síncrona (Task 1), fault injection de escritura (Task 2), matriz de reparse points (Task 3), sentinel de migración (Task 6), `ModuleDefinition<any>` (Task 7, con el tipo discriminado opt-in), fixtures/data URLs (Task 8: decisión de conservar data URLs con medición registrada — escribir los KiB medidos), manifest recovery-required (Task 4), endpoint Explorer (Task 5), archivos grandes (Tasks 9–12). Conservar como pendientes documentadas: matriz OS real (disco lleno/permisos a nivel de volumen) como job de release, Node 22 vs 24, WhatsApp/Merchant, y la nota de `StoreProjectV1` alias (decisión de mantener con TSDoc).

- [ ] **Step 2: Actualizar DATA_MODEL.md e INTEGRATIONS.md**

- `docs/DATA_MODEL.md`: en "Persistencia y migraciones", agregar la tabla `migrations` de Dexie (sentinel `pending`/`done`) y el sidecar `recovery.json` del servidor.
- `docs/INTEGRATIONS.md`: en la tabla "Operaciones auxiliares", agregar la fila `POST /__solara/storage/projects/{projectId}/open-folder` (abre la carpeta en Explorer en Windows; en otras plataformas confirma la ruta sin abrir).

- [ ] **Step 3: Actualizar ARCHITECTURE.md y HANDOFF.md**

- `docs/ARCHITECTURE.md`: en la sección de persistencia, mencionar extracción streaming con límites y el diagnóstico persistido.
- `docs/HANDOFF.md`: agregar una sección "Resolución de deuda técnica" que resuma las 13 tasks, las verificaciones ejecutadas y los pendientes de release.

- [ ] **Step 4: Ejecutar el gate completo**

Run:
```
corepack pnpm check
corepack pnpm build
corepack pnpm check:budgets
corepack pnpm benchmark:export
corepack pnpm test:e2e
```
Expected: PASS en todos. NO ejecutar `test:e2e:release` (exige Node 22).

- [ ] **Step 5: Commit final**

```bash
git add docs/TECHNICAL_DEBT.md docs/HANDOFF.md docs/DATA_MODEL.md docs/INTEGRATIONS.md docs/ARCHITECTURE.md
git commit -m "Documenta la resolución de deuda técnica"
```

---

## Self-review

- **Cobertura:** cada fila de `docs/TECHNICAL_DEBT.md` tiene tarea (1→Task 1, 2→Task 2, 3→Task 3, 4 y 12→Task 13, 5→Tasks 9–12, 6→Task 7, 7→Task 8, 8→Task 6, 9→Task 4, 10→Task 5, 11→Task 13, 13→Tasks 2–3). Los huecos de producto (cupones, impuestos, stock, i18n, pedidos, analytics) quedan fuera por decisión explícita del usuario: "después miramos los huecos".
- **Sin placeholders:** todos los pasos tienen código o instrucciones de movimiento textuales exactas; las tasks mecánicas (9–12) definen rangos de líneas y verificaciones.
- **Consistencia de tipos:** `streamZip` devuelve `{ files, bytes }` y `extractSiteArchive` lo propaga; `parseProjectArchive(archivePath, expectedProjectId, limits)` es la única firma nueva; `openFolder`/`openFolderInExplorer`/`openLocalProjectFolder` usan los mismos nombres en storage, handler y cliente.
