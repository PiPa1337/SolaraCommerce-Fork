import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
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

function siteMap(
  entries = [{ path: "index.html", encoding: "utf8", data: "<!doctype html><main>sitio</main>" }],
) {
  return JSON.stringify(entries);
}

function requestFrom(bytes) {
  return Readable.from([Buffer.from(bytes)]);
}

async function upload(storage, transactionId, kind, bytes) {
  await storage.upload(transactionId, kind, requestFrom(bytes));
}

describe("almacenamiento local de proyectos", () => {
  it("versiona el respaldo y extrae el sitio público", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-storage-"));
    try {
      const storage = createLocalProjectStorage({ applicationRoot: root });
      const transaction = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-06T10:00:00.000Z",
        expectedVersion: null,
      });
      await upload(storage, transaction.transactionId, "project", projectJson());
      await upload(storage, transaction.transactionId, "site", siteMap());
      const receipt = await storage.commit(transaction.transactionId);

      expect(receipt.version).toBe(1);
      expect(receipt.status).toBe("synced");
      const listing = await storage.list();
      expect(listing.projects).toHaveLength(1);
      expect(listing.projects[0]).toMatchObject({ projectId, version: 1, siteVersion: 1 });
      const sitePath = join(
        root,
        "proyectos",
        listing.projects[0].folder,
        "sitios",
        receipt.key,
        "index.html",
      );
      expect(await readFile(sitePath, "utf8")).toContain("sitio");
      expect((await storage.readCurrent(projectId)).manifest.current.sha256).toMatch(
        /^[a-f0-9]{64}$/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("conserva el sitio válido cuando una versión posterior sólo cambia el proyecto", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-storage-"));
    try {
      const storage = createLocalProjectStorage({ applicationRoot: root });
      const first = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-06T10:00:00.000Z",
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

      const second = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-06T11:00:00.000Z",
        expectedVersion: 1,
      });
      await upload(storage, second.transactionId, "project", projectJson("Prueba nueva"));
      const secondReceipt = await storage.commit(second.transactionId);

      expect(secondReceipt).toMatchObject({ version: 2, status: "site-outdated" });
      expect(secondReceipt.site?.key).toBe(firstReceipt.key);
      const listing = await storage.list();
      expect(listing.projects[0]).toMatchObject({ version: 2, siteVersion: 1, siteOutdated: true });
      expect(
        await stat(
          join(
            root,
            "proyectos",
            listing.projects[0].folder,
            "respaldos",
            `${firstReceipt.key}.solara.json`,
          ),
        ),
      ).toBeTruthy();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rechaza un respaldo cuyo projectId no coincide con la transacción", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-storage-"));
    try {
      const storage = createLocalProjectStorage({ applicationRoot: root });
      const transaction = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T10:00:00.000Z",
        expectedVersion: null,
      });
      await upload(
        storage,
        transaction.transactionId,
        "project",
        projectJson().replaceAll(projectId, "store-otra"),
      );
      await expect(storage.commit(transaction.transactionId)).rejects.toThrow(
        /no coincide con la tienda/i,
      );
      expect((await storage.list()).projects).toHaveLength(0);
      await storage.abort(transaction.transactionId);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rechaza conflictos de versión y rutas Zip Slip", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-storage-"));
    try {
      const storage = createLocalProjectStorage({ applicationRoot: root });
      const first = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-06T10:00:00.000Z",
        expectedVersion: null,
      });
      await upload(storage, first.transactionId, "project", projectJson());
      await storage.commit(first.transactionId);
      await expect(
        storage.beginSave({
          projectId,
          name: "Prueba",
          slug: "prueba",
          projectUpdatedAt: "2026-08-06T11:00:00.000Z",
          expectedVersion: null,
        }),
      ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });

      const malicious = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-06T12:00:00.000Z",
        expectedVersion: 1,
      });
      await upload(storage, malicious.transactionId, "project", projectJson());
      await upload(
        storage,
        malicious.transactionId,
        "site",
        siteMap([{ path: "../fuera.txt", encoding: "utf8", data: "no" }]),
      );
      await expect(storage.commit(malicious.transactionId)).rejects.toThrow(/ruta insegura/i);
      expect((await storage.list()).projects[0].version).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("conserva el manifest anterior ante una interrupción y limita el upload", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-storage-fault-"));
    try {
      let failingStage = "";
      const storage = createLocalProjectStorage({
        applicationRoot: root,
        faultInjector: async (stage) => {
          if (stage === failingStage) throw new Error(`fallo simulado: ${stage}`);
        },
      });
      const first = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-06T10:00:00.000Z",
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

      const limitedStorage = createLocalProjectStorage({
        applicationRoot: root,
        maxUploadBytes: 32,
      });
      const limited = await limitedStorage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-06T11:00:00.000Z",
        expectedVersion: firstReceipt.version,
      });
      await expect(
        upload(limitedStorage, limited.transactionId, "project", projectJson("archivo mayor")),
      ).rejects.toThrow(/límite/i);
      await limitedStorage.abort(limited.transactionId);

      const interrupted = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-06T12:00:00.000Z",
        expectedVersion: firstReceipt.version,
      });
      await upload(storage, interrupted.transactionId, "project", projectJson("v2"));
      failingStage = "before-manifest";
      await expect(storage.commit(interrupted.transactionId)).rejects.toThrow(/simulado/i);
      const listing = await storage.list();
      expect(listing.projects[0]).toMatchObject({ version: 1, siteVersion: 1 });
      expect((await storage.readCurrent(projectId)).manifest.current.version).toBe(1);
      await storage.abort(interrupted.transactionId);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

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

  it("sigue funcionando cuando la migración falla al escribir su marca", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-storage-migration-"));
    try {
      await mkdir(join(root, ".solara-runtime", "migration.json"), { recursive: true });
      const storage = createLocalProjectStorage({ applicationRoot: root });
      const listing = await storage.list();
      expect(listing.projects).toEqual([]);
      expect(listing.recovery).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rechaza un mapa de sitio con datos no textuales", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-storage-data-"));
    try {
      const storage = createLocalProjectStorage({ applicationRoot: root });
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
        siteMap([{ path: "index.html", encoding: "utf8", data: 123 }]),
      );
      await expect(storage.commit(transaction.transactionId)).rejects.toThrow(/inválidas/i);
      expect((await storage.list()).projects).toHaveLength(0);
      await storage.abort(transaction.transactionId);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rechaza un mapa de sitio con rutas duplicadas", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-storage-dupes-"));
    try {
      const storage = createLocalProjectStorage({ applicationRoot: root });
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
          { path: "index.html", encoding: "utf8", data: "<main>b</main>" },
        ]),
      );
      await expect(storage.commit(transaction.transactionId)).rejects.toThrow(/duplicadas/i);
      expect((await storage.list()).projects).toHaveLength(0);
      await storage.abort(transaction.transactionId);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

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

  it("descarta la carpeta con sidecar huérfano y sin manifest", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-storage-orphan-"));
    try {
      const storage = createLocalProjectStorage({ applicationRoot: root });
      await storage.ensureRoots();
      const orphanRoot = join(root, "proyectos", "tienda-huerfana");
      await mkdir(orphanRoot, { recursive: true });
      const sidecar = join(orphanRoot, "recovery.json");
      await writeFile(
        sidecar,
        JSON.stringify({
          format: "solara-local-recovery",
          folder: "tienda-huerfana",
          message: "diagnóstico viejo de una tienda que ya no existe",
          detectedAt: "2026-01-01T00:00:00.000Z",
        }),
        "utf8",
      );

      const listing = await storage.list();
      expect(listing.recovery).toHaveLength(0);
      await expect(readFile(sidecar, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
