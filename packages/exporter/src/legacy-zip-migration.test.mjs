import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { runLegacyZipMigration } from "../scripts/legacy-zip-migration.mjs";
import { createLocalProjectStorage } from "../scripts/local-project-storage.mjs";

const projectId = "store-legacy";

function legacyArchive(projectIdValue = projectId) {
  return zipSync({
    "manifest.json": strToU8(
      JSON.stringify({ format: "solara-project", version: 2, projectId: projectIdValue }),
    ),
    "project.json": strToU8(
      JSON.stringify({ schemaVersion: 2, id: projectIdValue, name: "Antigua", slug: "antigua" }),
    ),
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
    lastValidSite: {
      version: 3,
      key: "antigua-2026-08-07T00-00-00-000Z-v000003",
      directoryPath: "proyectos/store-legacy/sitios/antigua-2026-08-07T00-00-00-000Z-v000003",
    },
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
        await readFile(
          join(storeRoot, "actual", "antigua-2026-08-07T00-00-00-000Z-v000003.solara.json"),
          "utf8",
        ),
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
      await writeFile(
        join(storeRoot, "manifest.json"),
        `${JSON.stringify(legacyManifest(), null, 2)}\n`,
        "utf8",
      );
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
      const jsonPath = join(
        storeRoot,
        "actual",
        "antigua-2026-08-07T00-00-00-000Z-v000003.solara.json",
      );
      expect(JSON.parse(await readFile(jsonPath, "utf8")).project.id).toBe(projectId);
      expect(second.recovery.length).toBeGreaterThanOrEqual(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("no escribe la marca cuando el directorio de proyectos no se puede leer", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-migration-scan-"));
    try {
      const projectsFile = join(root, "proyectos");
      await writeFile(projectsFile, "no es un directorio");
      const statePath = join(root, "migration.json");
      const result = await runLegacyZipMigration({
        applicationRoot: root,
        projectsRoot: projectsFile,
        migrationStatePath: statePath,
      });
      expect(result).toEqual({ converted: [], failed: [] });
      await expect(readFile(statePath, "utf8")).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("no migra tiendas con rutas o claves inseguras", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-migration-unsafe-"));
    try {
      const zipRoot = join(root, "proyectos", "ruta--insegura");
      await mkdir(join(zipRoot, "actual"), { recursive: true });
      await writeFile(
        join(zipRoot, "manifest.json"),
        `${JSON.stringify(
          {
            ...legacyManifest(),
            projectId: "store-ruta",
            current: { ...legacyManifest().current, archivePath: "../boom.solara.zip" },
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
      const keyRoot = join(root, "proyectos", "clave--insegura");
      await mkdir(join(keyRoot, "actual"), { recursive: true });
      await writeFile(
        join(keyRoot, "manifest.json"),
        `${JSON.stringify(
          {
            ...legacyManifest(),
            projectId: "store-clave",
            current: {
              ...legacyManifest().current,
              archivePath: "actual/seguro.solara.zip",
              key: "../../boom",
            },
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
      await writeFile(join(keyRoot, "actual", "seguro.solara.zip"), legacyArchive("store-clave"));

      const storage = createLocalProjectStorage({ applicationRoot: root });
      const listing = await storage.list();
      expect(listing.projects).toHaveLength(0);
      expect(listing.recovery.length).toBe(2);

      const marker = JSON.parse(
        await readFile(join(root, ".solara-runtime", "migration.json"), "utf8"),
      );
      expect(marker.projectIds).toEqual([]);
      expect([...marker.failed].sort()).toEqual(["clave--insegura", "ruta--insegura"]);
      await expect(readFile(join(root, "boom.solara.json"), "utf8")).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
