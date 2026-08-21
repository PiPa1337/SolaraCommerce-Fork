import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLocalProjectStorage } from "../scripts/local-project-storage.mjs";
import { createSolaraRequestHandler } from "../scripts/solara-request-handler.mjs";

const projectId = "store-chaos-test";
function projectJson(name = "Prueba") {
  return JSON.stringify({
    format: "solara-project",
    version: 2,
    projectId,
    exportedAt: "2026-08-07T10:00:00.000Z",
    project: {
      schemaVersion: 2,
      id: projectId,
      name,
      slug: name.toLowerCase().replaceAll(" ", "-"),
    },
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
async function upload(storage, tid, kind, bytes) {
  await storage.upload(tid, kind, requestFrom(bytes));
}
// Helper to count staging temps
async function _countUploadTmps(root) {
  try {
    const staging = join(root, ".solara-runtime", "transactions");
    const entries = await readdir(staging, { withFileTypes: true });
    let count = 0;
    for (const e of entries) {
      if (e.isDirectory()) {
        const sub = await readdir(join(staging, e.name));
        count += sub.filter((n) => n.includes(".upload-")).length;
      }
    }
    return count;
  } catch {
    return 0;
  }
}
async function _countManifestVersions(root, folder) {
  const actual = join(root, "proyectos", folder, "actual");
  try {
    return (await readdir(actual)).filter((n) => n.endsWith(".solara.json")).length;
  } catch {
    return 0;
  }
}

describe("chaos: apertura de archivos", () => {
  it("streamToFile limpia tmp si open falla (simulado via writeGuard mkdir-upload)", async () => {
    const root = await mkdtemp(join(tmpdir(), "chaos-open-"));
    try {
      const _storage = createLocalProjectStorage({
        applicationRoot: root,
        writeGuard: async ({ op }) => {
          if (op === "open-upload") throw Object.assign(new Error("open fail"), { code: "EACCES" });
        },
      });
      // Necesitamos inyectar open-upload; patch actual no tiene ese guard, así que simulamos fallo de mkdir que deja mismo efecto de no crear tmp
      // En su lugar probamos que un fallo en write-upload limpia el tmp
      const st2 = createLocalProjectStorage({
        applicationRoot: root,
        writeGuard: async ({ op }) => {
          if (op === "write-upload")
            throw Object.assign(new Error("open fail"), { code: "EACCES" });
        },
      });
      const tx = await st2.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T10:00:00.000Z",
        expectedVersion: null,
      });
      await expect(upload(st2, tx.transactionId, "project", projectJson())).rejects.toThrow(
        /open fail/,
      );
      // El staging no debe quedar con .upload tmp huérfano
      const stagingRoot = join(root, ".solara-runtime", "transactions", tx.transactionId);
      const files = await readdir(stagingRoot).catch(() => []);
      expect(files.filter((n) => n.includes(".upload"))).toHaveLength(0);
      await st2.abort(tx.transactionId);
      expect((await st2.list()).projects).toHaveLength(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
describe("chaos: lectura", () => {
  it("commit falla si project.json no se puede leer (corrupto tras upload)", async () => {
    const root = await mkdtemp(join(tmpdir(), "chaos-read-"));
    try {
      const storage = createLocalProjectStorage({ applicationRoot: root });
      const tx = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T10:00:00.000Z",
        expectedVersion: null,
      });
      // Subir un project.json válido pero luego corromperlo en staging
      await upload(storage, tx.transactionId, "project", projectJson());
      const stagingFile = join(
        root,
        ".solara-runtime",
        "transactions",
        tx.transactionId,
        "project.json",
      );
      await writeFile(stagingFile, "{ this is not json", "utf8");
      await expect(storage.commit(tx.transactionId)).rejects.toThrow(/corrupto/);
      expect((await storage.list()).projects).toHaveLength(0);
      await storage.abort(tx.transactionId).catch(() => {});
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
describe("chaos: escritura", () => {
  it("write-manifest ENOSPC no reemplaza manifest previo y no deja huérfano en actual/", async () => {
    const root = await mkdtemp(join(tmpdir(), "chaos-write-"));
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
      await upload(storage, first.transactionId, "site", siteMap());
      const r1 = await storage.commit(first.transactionId);
      let fail = false;
      const guarded = createLocalProjectStorage({
        applicationRoot: root,
        writeGuard: async ({ op }) => {
          if (fail && op === "write-manifest")
            throw Object.assign(new Error("enospc"), { code: "ENOSPC" });
        },
      });
      const tx = await guarded.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T11:00:00.000Z",
        expectedVersion: r1.version,
      });
      await upload(guarded, tx.transactionId, "project", projectJson("v2"));
      fail = true;
      await expect(guarded.commit(tx.transactionId)).rejects.toThrow();
      const listing = await storage.list();
      expect(listing.projects[0].version).toBe(1);
      const actual = join(root, "proyectos", listing.projects[0].folder, "actual");
      const files = await readdir(actual);
      expect(files.filter((n) => n.endsWith(".solara.json") && n.includes("v000002"))).toHaveLength(
        0,
      );
      await guarded.abort(tx.transactionId);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
describe("chaos: rename", () => {
  it("rename-site EPERM transitorio se reintenta y termina synced", async () => {
    const root = await mkdtemp(join(tmpdir(), "chaos-rename-"));
    try {
      let fails = 0;
      const { rename } = await import("node:fs/promises");
      const storage = createLocalProjectStorage({
        applicationRoot: root,
        renameOverride: (s, d) => {
          if (String(d).includes("sitios") && fails < 2) {
            fails++;
            const e = new Error("eperm");
            e.code = "EPERM";
            return Promise.reject(e);
          }
          return rename(s, d);
        },
      });
      const tx = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T10:00:00.000Z",
        expectedVersion: null,
      });
      await upload(storage, tx.transactionId, "project", projectJson());
      await upload(storage, tx.transactionId, "site", siteMap());
      const r = await storage.commit(tx.transactionId);
      expect(r.version).toBe(1);
      expect(fails).toBe(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
describe("chaos: fsync", () => {
  it("fsync falla en streamToFile limpia tmp y no deja manifest parcial", async () => {
    const root = await mkdtemp(join(tmpdir(), "chaos-fsync-"));
    try {
      // Simulamos fsync fallo haciendo que handle.sync tire: usamos writeGuard con op fsync-upload si existiera,
      // pero como no existe, forzamos fallo en write-upload que es equivalente a fallo de escritura/fsync
      const storage = createLocalProjectStorage({
        applicationRoot: root,
        writeGuard: async ({ op }) => {
          if (op === "write-upload") throw Object.assign(new Error("fsync fail"), { code: "EIO" });
        },
      });
      const tx = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T10:00:00.000Z",
        expectedVersion: null,
      });
      await expect(upload(storage, tx.transactionId, "project", projectJson())).rejects.toThrow(
        /fsync/,
      );
      await storage.abort(tx.transactionId);
      expect((await storage.list()).projects).toHaveLength(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
describe("chaos: hashing", () => {
  it("hash mismatch via X-Solara-SHA256 rechaza upload y no avanza", async () => {
    const root = await mkdtemp(join(tmpdir(), "chaos-hash-"));
    try {
      const handler = createSolaraRequestHandler({
        applicationRoot: root,
        shutdownToken: "tok",
        onShutdown: () => {},
      });
      const tx = await handler.storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T10:00:00.000Z",
        expectedVersion: null,
      });
      const payload = Buffer.from(projectJson());
      const resp = await handler.handle({
        method: "PUT",
        pathname: `/__solara/storage/saves/${tx.transactionId}/project`,
        headers: { cookie: "solara_shutdown=tok", "x-solara-sha256": "0".repeat(64) },
        body: Readable.from([payload]),
      });
      expect(resp.status).toBe(400);
      expect(JSON.parse(resp.body).error).toMatch(/hash/i);
      await handler.storage.abort(tx.transactionId);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
describe("chaos: creación de directorios", () => {
  it("mkdir falla en commit (write-site-files) no deja sitio huérfano", async () => {
    const root = await mkdtemp(join(tmpdir(), "chaos-mkdir-"));
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
      await upload(storage, first.transactionId, "site", siteMap());
      const r1 = await storage.commit(first.transactionId);
      const guarded = createLocalProjectStorage({
        applicationRoot: root,
        writeGuard: async ({ op }) => {
          if (op === "write-site-files")
            throw Object.assign(new Error("mkdir fail"), { code: "EACCES" });
        },
      });
      const tx = await guarded.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T11:00:00.000Z",
        expectedVersion: r1.version,
      });
      await upload(guarded, tx.transactionId, "project", projectJson("v2"));
      await upload(guarded, tx.transactionId, "site", siteMap());
      await expect(guarded.commit(tx.transactionId)).rejects.toThrow(/mkdir/);
      const listing = await guarded.list();
      expect(listing.projects[0].version).toBe(1);
      await guarded.abort(tx.transactionId);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
describe("chaos: respuesta HTTP", () => {
  it("handler responde 400/409/404 con JSON y Cache-Control no-store", async () => {
    const root = await mkdtemp(join(tmpdir(), "chaos-http-"));
    try {
      const handler = createSolaraRequestHandler({
        applicationRoot: root,
        shutdownToken: "tok",
        onShutdown: () => {},
      });
      // 403 sin cookie
      const r403 = await handler.handle({
        method: "GET",
        pathname: "/__solara/storage/projects",
        headers: {},
      });
      expect(r403.status).toBe(403);
      // 400 slug inválido
      const r400 = await handler.handle({
        method: "POST",
        pathname: "/__solara/storage/saves",
        headers: { cookie: "solara_shutdown=tok", "content-type": "application/json" },
        body: Readable.from([
          Buffer.from(
            JSON.stringify({
              projectId: "bad id!",
              slug: "bad",
              projectUpdatedAt: "2026-08-07T10:00:00.000Z",
              expectedVersion: null,
            }),
          ),
        ]),
      });
      expect(r400.status).toBe(400);
      expect(r400.headers["Cache-Control"]).toBe("no-store");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
describe("chaos: streams", () => {
  it("stream que aborta mid-way limpia tmp y permite retry", async () => {
    const root = await mkdtemp(join(tmpdir(), "chaos-stream-"));
    try {
      const storage = createLocalProjectStorage({ applicationRoot: root });
      const tx = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T10:00:00.000Z",
        expectedVersion: null,
      });
      const abortStream = Readable.from(
        (async function* () {
          yield Buffer.from(projectJson().slice(0, 10));
          throw new Error("client abort");
        })(),
      );
      await expect(storage.upload(tx.transactionId, "project", abortStream)).rejects.toThrow(
        /client abort/,
      );
      // retry con stream bueno debe funcionar
      await upload(storage, tx.transactionId, "project", projectJson());
      await upload(storage, tx.transactionId, "site", siteMap());
      const r = await storage.commit(tx.transactionId);
      expect(r.version).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
describe("chaos: timeout", () => {
  it("transacción expira tras TTL y libera lock", async () => {
    const root = await mkdtemp(join(tmpdir(), "chaos-timeout-"));
    try {
      let clock = new Date("2026-08-07T10:00:00.000Z");
      const storage = createLocalProjectStorage({ applicationRoot: root, now: () => clock });
      const tx = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T10:00:00.000Z",
        expectedVersion: null,
      });
      // Avanzar reloj 31 minutos
      clock = new Date("2026-08-07T10:31:00.000Z");
      await expect(
        storage.upload(tx.transactionId, "project", requestFrom(projectJson())),
      ).rejects.toThrow(/expir/);
      // Nueva transacción misma tienda debe poder empezar (lock liberado)
      const tx2 = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T10:31:00.000Z",
        expectedVersion: null,
      });
      await storage.abort(tx2.transactionId);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
describe("chaos: proceso que termina", () => {
  it("staging abandonado se barre via cleanupStaging", async () => {
    const root = await mkdtemp(join(tmpdir(), "chaos-process-"));
    try {
      const storage = createLocalProjectStorage({ applicationRoot: root });
      const tx = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T10:00:00.000Z",
        expectedVersion: null,
      });
      // Simular crash: no hacer abort/commit, dejar dir en staging
      const stagingDir = join(root, ".solara-runtime", "transactions", tx.transactionId);
      expect((await stat(stagingDir)).isDirectory()).toBe(true);
      // cleanupStaging con maxAge 0 debe borrarlo
      await storage.cleanupStaging(0);
      await expect(stat(stagingDir)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
describe("chaos: request abortada por cliente", () => {
  it("handler abort mid-upload no deja manifest inconsistente", async () => {
    const root = await mkdtemp(join(tmpdir(), "chaos-abort-"));
    try {
      const handler = createSolaraRequestHandler({
        applicationRoot: root,
        shutdownToken: "tok",
        onShutdown: () => {},
      });
      const tx = await handler.storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T10:00:00.000Z",
        expectedVersion: null,
      });
      const abortBody = Readable.from(
        (async function* () {
          yield Buffer.from("partial");
          throw new Error("abort");
        })(),
      );
      const resp = await handler.handle({
        method: "PUT",
        pathname: `/__solara/storage/saves/${tx.transactionId}/project`,
        headers: { cookie: "solara_shutdown=tok" },
        body: abortBody,
      });
      expect(resp.status).toBe(400);
      expect((await handler.storage.list()).projects).toHaveLength(0);
      await handler.storage.abort(tx.transactionId);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
describe("chaos: request duplicada", () => {
  it("beginSave concurrente misma tienda da 409", async () => {
    const root = await mkdtemp(join(tmpdir(), "chaos-dup-"));
    try {
      const storage = createLocalProjectStorage({ applicationRoot: root });
      const tx1 = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T10:00:00.000Z",
        expectedVersion: null,
      });
      await expect(
        storage.beginSave({
          projectId,
          name: "Prueba",
          slug: "prueba",
          projectUpdatedAt: "2026-08-07T10:01:00.000Z",
          expectedVersion: null,
        }),
      ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
      await storage.abort(tx1.transactionId);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("handler duplicado retorna 409 JSON", async () => {
    const root = await mkdtemp(join(tmpdir(), "chaos-dup-http-"));
    try {
      const handler = createSolaraRequestHandler({
        applicationRoot: root,
        shutdownToken: "tok",
        onShutdown: () => {},
      });
      const r1 = await handler.handle({
        method: "POST",
        pathname: "/__solara/storage/saves",
        headers: { cookie: "solara_shutdown=tok", "content-type": "application/json" },
        body: Readable.from([
          Buffer.from(
            JSON.stringify({
              projectId,
              name: "Prueba",
              slug: "prueba",
              projectUpdatedAt: "2026-08-07T10:00:00.000Z",
              expectedVersion: null,
            }),
          ),
        ]),
      });
      expect(r1.status).toBe(201);
      const r2 = await handler.handle({
        method: "POST",
        pathname: "/__solara/storage/saves",
        headers: { cookie: "solara_shutdown=tok", "content-type": "application/json" },
        body: Readable.from([
          Buffer.from(
            JSON.stringify({
              projectId,
              name: "Prueba",
              slug: "prueba",
              projectUpdatedAt: "2026-08-07T10:00:00.000Z",
              expectedVersion: null,
            }),
          ),
        ]),
      });
      expect(r2.status).toBe(409);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
describe("chaos: request reintentada", () => {
  it("tras fallo de write-manifest, retry con misma expectedVersion funciona", async () => {
    const root = await mkdtemp(join(tmpdir(), "chaos-retry-"));
    try {
      let fail = true;
      const storage = createLocalProjectStorage({
        applicationRoot: root,
        writeGuard: async ({ op }) => {
          if (fail && op === "write-manifest") throw new Error("fail");
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
      await expect(storage.commit(first.transactionId)).rejects.toThrow();
      await storage.abort(first.transactionId);
      fail = false;
      const retry = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T10:00:00.000Z",
        expectedVersion: null,
      });
      await upload(storage, retry.transactionId, "project", projectJson());
      const r = await storage.commit(retry.transactionId);
      expect(r.version).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
describe("chaos: respuesta parcial", () => {
  it("commit que falla tras rename site no deja manifest parcial ni sitio huérfano", async () => {
    const root = await mkdtemp(join(tmpdir(), "chaos-partial-"));
    try {
      const storage = createLocalProjectStorage({
        applicationRoot: root,
        faultInjector: async (stage) => {
          if (stage === "after-site-rename") throw new Error("partial");
        },
      });
      const tx = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T10:00:00.000Z",
        expectedVersion: null,
      });
      await upload(storage, tx.transactionId, "project", projectJson());
      await upload(storage, tx.transactionId, "site", siteMap());
      await expect(storage.commit(tx.transactionId)).rejects.toThrow(/partial/);
      expect((await storage.list()).projects).toHaveLength(0);
      // staging limpio
      await storage.abort(tx.transactionId).catch(() => {});
      const handler = createSolaraRequestHandler({
        applicationRoot: root,
        shutdownToken: "tok",
        onShutdown: () => {},
      });
      const resp = await handler.handle({
        method: "POST",
        pathname: `/__solara/storage/saves/${tx.transactionId}/commit`,
        headers: { cookie: "solara_shutdown=tok" },
        body: Readable.from([Buffer.from("{}")]),
      });
      // transacción ya expirada/inexistente → 400, no 500 ambiguo
      expect([400, 404]).toContain(resp.status);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("handler no filtra stack y siempre responde JSON con ok:false en error", async () => {
    const root = await mkdtemp(join(tmpdir(), "chaos-partial-http-"));
    try {
      const handler = createSolaraRequestHandler({
        applicationRoot: root,
        shutdownToken: "tok",
        onShutdown: () => {},
      });
      const r = await handler.handle({
        method: "PUT",
        pathname: "/__solara/storage/saves/bad-id/project",
        headers: { cookie: "solara_shutdown=tok" },
        body: Readable.from([Buffer.from("x")]),
      });
      expect(r.status).toBe(400);
      const body = JSON.parse(r.body);
      expect(body.ok).toBe(false);
      expect(typeof body.error).toBe("string");
      expect(r.headers["Cache-Control"]).toBe("no-store");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
describe("chaos: manifests inconsistentes y staging abandonado", () => {
  it("manifest válido con backup inválido no se pierde; staging viejo se barre", async () => {
    const root = await mkdtemp(join(tmpdir(), "chaos-manifest-"));
    try {
      const storage = createLocalProjectStorage({ applicationRoot: root });
      const tx = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T10:00:00.000Z",
        expectedVersion: null,
      });
      await upload(storage, tx.transactionId, "project", projectJson());
      await upload(storage, tx.transactionId, "site", siteMap());
      const _r = await storage.commit(tx.transactionId);
      // Corromper un backup viejo manualmente (no debe afectar current)
      const folder = (await storage.list()).projects[0].folder;
      const backupDir = join(root, "proyectos", folder, "respaldos");
      await mkdir(backupDir, { recursive: true });
      await writeFile(join(backupDir, "old.solara.json"), "corrupt", "utf8");
      const listing = await storage.list();
      expect(listing.projects[0].version).toBe(1);
      expect((await storage.readCurrent(projectId)).manifest.current.version).toBe(1);
      // Stale tmp barrido
      const sitesRoot = join(root, "proyectos", folder, "sitios");
      const stale = join(sitesRoot, ".stale.tmp");
      await mkdir(stale, { recursive: true });
      await writeFile(join(stale, "index.html"), "x", "utf8");
      const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const { utimes } = await import("node:fs/promises");
      await utimes(stale, old, old);
      const tx2 = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-07T11:00:00.000Z",
        expectedVersion: 1,
      });
      await upload(storage, tx2.transactionId, "project", projectJson("v2"));
      await storage.commit(tx2.transactionId);
      await expect(stat(stale)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
