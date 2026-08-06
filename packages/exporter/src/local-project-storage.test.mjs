import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createLocalProjectStorage } from "../scripts/local-project-storage.mjs";

const projectId = "store-storage-test";

function projectArchive(name = "Prueba") {
  return zipSync({
    "manifest.json": strToU8(JSON.stringify({ format: "solara-project", version: 2, projectId })),
    "project.json": strToU8(
      JSON.stringify({ schemaVersion: 2, id: projectId, name, slug: name.toLowerCase() }),
    ),
  });
}

function siteArchive(body = "<main>sitio</main>") {
  return zipSync({ "index.html": strToU8(`<!doctype html>${body}`) });
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
      await upload(storage, transaction.transactionId, "project", projectArchive());
      await upload(storage, transaction.transactionId, "site", siteArchive());
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
      await upload(storage, first.transactionId, "project", projectArchive());
      await upload(storage, first.transactionId, "site", siteArchive("<main>v1</main>"));
      const firstReceipt = await storage.commit(first.transactionId);

      const second = await storage.beginSave({
        projectId,
        name: "Prueba",
        slug: "prueba",
        projectUpdatedAt: "2026-08-06T11:00:00.000Z",
        expectedVersion: 1,
      });
      await upload(storage, second.transactionId, "project", projectArchive("Prueba nueva"));
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
            `${firstReceipt.key}.solara.zip`,
          ),
        ),
      ).toBeTruthy();
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
      await upload(storage, first.transactionId, "project", projectArchive());
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
      await upload(storage, malicious.transactionId, "project", projectArchive());
      await upload(
        storage,
        malicious.transactionId,
        "site",
        zipSync({ "../fuera.txt": strToU8("no") }),
      );
      await expect(storage.commit(malicious.transactionId)).rejects.toThrow(/ruta insegura/i);
      expect((await storage.list()).projects[0].version).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
