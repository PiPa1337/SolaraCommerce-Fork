import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLocalProjectStorage } from "../scripts/local-project-storage.mjs";

const projectId = "store-redteam";
function projectJson(name = "Prueba", updatedAt = "2026-08-07T10:00:00.000Z") {
  return JSON.stringify({
    format: "solara-project",
    version: 2,
    projectId,
    exportedAt: "2026-08-07T10:00:00.000Z",
    project: { schemaVersion: 2, id: projectId, name, slug: name.toLowerCase(), updatedAt },
  });
}
function siteMap(entries = [{ path: "index.html", encoding: "utf8", data: "<main>sitio</main>" }]) {
  return JSON.stringify(entries);
}
function requestFrom(bytes) {
  return Readable.from([Buffer.from(bytes)]);
}
async function upload(storage, tx, kind, bytes) {
  await storage.upload(tx, kind, requestFrom(bytes));
}

describe("red-team persistencia", () => {
  it("INV1: concurrent beginSave es rechazado con 409 (no last-writer-wins)", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-redteam-concurrent-"));
    try {
      const storage = createLocalProjectStorage({ applicationRoot: root });
      const p1 = storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-06T10:00:00.000Z",
        expectedVersion: null,
      });
      const p2 = storage.beginSave({
        projectId,
        name: "Prueba2",
        slug: "prueba",
        projectUpdatedAt: "2026-08-06T10:01:00.000Z",
        expectedVersion: null,
      });
      const results = await Promise.allSettled([p1, p2]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason.code).toBe("VERSION_CONFLICT");
      // el commit del ganador debe ser version 1
      await upload(storage, fulfilled[0].value.transactionId, "project", projectJson("Prueba1"));
      const receipt = await storage.commit(fulfilled[0].value.transactionId);
      expect(receipt.version).toBe(1);
      // limpiar
      for (const r of fulfilled) {
        try {
          await storage.abort(r.value.transactionId);
        } catch {}
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("INV1: commit rechaza si manifest cambió entre beginSave y commit (defensa en profundidad)", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-redteam-commit409-"));
    try {
      const storage = createLocalProjectStorage({ applicationRoot: root });
      const first = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-06T10:00:00.000Z",
        expectedVersion: null,
      });
      await upload(storage, first.transactionId, "project", projectJson("Prueba1"));
      await storage.commit(first.transactionId);
      // crear segunda transacción con expectedVersion stale (0) simulando race antes del commit anterior
      // para simular, creamos un storage con fault que nos permite manipular metadata directamente
      // en su lugar, probamos que un beginSave con expectedVersion viejo es rechazado
      await expect(
        storage.beginSave({
          projectId,
          name: "Prueba",
          slug: "prueba",
          projectUpdatedAt: "2026-08-06T11:00:00.000Z",
          expectedVersion: 0,
        }),
      ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
      // y que un commit con previous stale sería rechazado si lograra crearse (simulamos via segundo storage instance que no ve el lock)
      // Creamos una transacción válida y luego modificamos el manifest externamente antes de commitear
      const second = await storage.beginSave({
        projectId,
        name: "Prueba2",
        slug: "prueba",
        projectUpdatedAt: "2026-08-06T12:00:00.000Z",
        expectedVersion: 1,
      });
      await upload(storage, second.transactionId, "project", projectJson("Prueba2"));
      // simular cambio externo: crear tercera transacción y commitearla directamente en disco via otra instancia
      const other = createLocalProjectStorage({ applicationRoot: root });
      const third = await other.beginSave({
        projectId,
        name: "Prueba3",
        slug: "prueba",
        projectUpdatedAt: "2026-08-06T13:00:00.000Z",
        expectedVersion: 1,
      });
      await upload(other, third.transactionId, "project", projectJson("Prueba3"));
      await other.commit(third.transactionId);
      // ahora second tiene previous version 1 pero current es 2 -> debe rechazar
      await expect(storage.commit(second.transactionId)).rejects.toMatchObject({
        code: "VERSION_CONFLICT",
      });
      const listing = await storage.list();
      expect(listing.projects[0].version).toBe(2);
      expect(listing.projects[0].name).toBe("Prueba3");
      try {
        await storage.abort(second.transactionId);
      } catch {}
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("INV2: nunca reemplazar sitio válido con incompleto (site sin index.html)", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-redteam-site-"));
    try {
      const storage = createLocalProjectStorage({ applicationRoot: root });
      const first = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-06T10:00:00.000Z",
        expectedVersion: null,
      });
      await upload(storage, first.transactionId, "project", projectJson("Prueba1"));
      await upload(
        storage,
        first.transactionId,
        "site",
        siteMap([{ path: "index.html", encoding: "utf8", data: "<main>v1</main>" }]),
      );
      const r1 = await storage.commit(first.transactionId);
      expect(r1.status).toBe("synced");
      const second = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-06T11:00:00.000Z",
        expectedVersion: 1,
      });
      await upload(storage, second.transactionId, "project", projectJson("Prueba2"));
      await upload(
        storage,
        second.transactionId,
        "site",
        siteMap([{ path: "sin-index.html", encoding: "utf8", data: "x" }]),
      );
      await expect(storage.commit(second.transactionId)).rejects.toThrow(/index\.html/i);
      const listing = await storage.list();
      expect(listing.projects[0].version).toBe(1);
      expect(listing.projects[0].siteVersion).toBe(1);
      try {
        await storage.abort(second.transactionId);
      } catch {}
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("INV4: operación fallida atómica no deja respaldo huérfano ni manifest corrupto", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-redteam-atomic-"));
    try {
      const storage = createLocalProjectStorage({
        applicationRoot: root,
        writeGuard: async ({ op }) => {
          if (op === "write-manifest") {
            const e = new Error("ENOSPC");
            e.code = "ENOSPC";
            throw e;
          }
        },
      });
      const good = createLocalProjectStorage({ applicationRoot: root });
      const first = await good.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-06T10:00:00.000Z",
        expectedVersion: null,
      });
      await upload(good, first.transactionId, "project", projectJson("Prueba1"));
      await upload(good, first.transactionId, "site", siteMap());
      await good.commit(first.transactionId);
      const tx = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-06T11:00:00.000Z",
        expectedVersion: 1,
      });
      await upload(storage, tx.transactionId, "project", projectJson("Prueba2"));
      await expect(storage.commit(tx.transactionId)).rejects.toThrow(/ENOSPC/);
      const listing = await good.list();
      expect(listing.projects[0].version).toBe(1);
      // no debe quedar .solara.json huérfano con version 2
      const folder = listing.projects[0].folder;
      const actualFiles = await readdir(join(root, "proyectos", folder, "actual"));
      expect(actualFiles.filter((f) => f.endsWith(".solara.json"))).toHaveLength(1);
      expect(actualFiles[0]).toContain("v000001");
      try {
        await storage.abort(tx.transactionId);
      } catch {}
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
