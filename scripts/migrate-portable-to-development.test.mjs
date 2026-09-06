import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { referenceStore } from "../packages/project-schema/src/fixture.ts";
import {
  applyLedgerDecisions,
  archiveMigrationFromSnapshot,
  auditManagedRoot,
  createDefinitiveMigrationSnapshot,
  createVerifiedSnapshot,
  estimateRequiredSpace,
  estimateStoragePlacement,
  inventoryTree,
  parseJsonTextAllowBom,
  performMigrationCutover,
  prepareStagingFromSnapshot,
  transactionalCutoverForTest,
  validateManagedStore,
  verifyInheritedFiles,
  verifyMigrationFromBaseline,
  verifySnapshotAgainstBaseline,
} from "./migrate-portable-to-development.mjs";

async function writeValidStore(applicationRoot, folder = "fixture-store") {
  const storeRoot = join(applicationRoot, "proyectos", folder);
  const currentRelative = "actual/current.solara.json";
  const currentPath = join(storeRoot, "actual", "current.solara.json");
  const project = structuredClone(referenceStore);
  const envelope = {
    format: "solara-project",
    version: 2,
    projectId: project.id,
    exportedAt: "2026-09-05T00:00:00.000Z",
    project,
  };
  const bytes = Buffer.from(JSON.stringify(envelope), "utf8");
  await mkdir(join(storeRoot, "actual"), { recursive: true });
  await writeFile(currentPath, bytes);
  await writeFile(
    join(storeRoot, "manifest.json"),
    JSON.stringify({
      format: "solara-local-project",
      manifestVersion: 2,
      projectId: project.id,
      storeName: project.name,
      slug: project.slug,
      schemaVersion: 2,
      status: "site-outdated",
      current: {
        version: 1,
        key: "migration-fixture-v000001",
        projectPath: currentRelative,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        savedAt: "2026-09-05T00:00:00.000Z",
        projectUpdatedAt: project.updatedAt,
      },
    }),
    "utf8",
  );
  return { storeRoot, currentPath };
}

function fingerprintBaseline(baseline) {
  return createHash("sha256").update(JSON.stringify(baseline)).digest("hex");
}

describe("migración portable: auditoría", () => {
  it("valida un store administrado usando StoreProjectV2Schema", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-migration-valid-"));
    try {
      const { storeRoot } = await writeValidStore(root);
      const result = await validateManagedStore(storeRoot, root, { semantic: true });
      expect(result.healthy).toBe(true);
      expect(result.projectId).toBe(referenceStore.id);
      expect(result.issues).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rechaza un hash actual alterado", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-migration-hash-"));
    try {
      const { storeRoot, currentPath } = await writeValidStore(root);
      await writeFile(currentPath, "corrupto", "utf8");
      const result = await validateManagedStore(storeRoot, root, { semantic: false });
      expect(result.healthy).toBe(false);
      expect(result.issues.some((entry) => entry.code === "current-hash-mismatch")).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rechaza current.projectPath que intenta salir del store", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-migration-path-"));
    try {
      const { storeRoot } = await writeValidStore(root);
      const manifestPath = join(storeRoot, "manifest.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      manifest.current.projectPath = "../escape.solara.json";
      await writeFile(manifestPath, JSON.stringify(manifest), "utf8");
      const result = await validateManagedStore(storeRoot, root, { semantic: false });
      expect(result.healthy).toBe(false);
      expect(result.issues[0]?.code).toBe("manifest-invalid");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("acepta JSON con BOM, como server.json de Windows", () => {
    expect(parseJsonTextAllowBom(`\uFEFF{"processId":28868,"port":4173}`)).toEqual({
      processId: 28868,
      port: 4173,
    });
  });

  it("no convierte LEEME.md del root administrado en un error de fuente", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-migration-readme-"));
    try {
      await writeValidStore(root);
      await writeFile(join(root, "proyectos", "LEEME.md"), "documentación", "utf8");
      const result = await auditManagedRoot(join(root, "proyectos"), root, "fixture", {
        hashAll: false,
        semantic: true,
      });
      expect(result.stores).toHaveLength(1);
      expect(result.unrecognized).toContainEqual({
        folder: "LEEME.md",
        issue: "not-directory",
        severity: "warning",
      });
      expect(result.unrecognized.some((entry) => entry.severity === "error")).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("trata la deriva física de lastValidSite como advertencia y conserva el store sano", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-migration-site-drift-"));
    try {
      const { storeRoot } = await writeValidStore(root);
      const siteRelative = "proyectos/fixture-store/sitios/production";
      const siteRoot = join(root, ...siteRelative.split("/"));
      await mkdir(siteRoot, { recursive: true });
      await writeFile(join(siteRoot, "index.html"), "<h1>actual</h1>", "utf8");
      await writeFile(join(siteRoot, "post-process.txt"), "agregado después", "utf8");

      const manifestPath = join(storeRoot, "manifest.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      manifest.lastValidSite = {
        directoryPath: siteRelative,
        files: 1,
        bytes: 1,
        sha256: "0".repeat(64),
      };
      await writeFile(manifestPath, JSON.stringify(manifest), "utf8");

      const result = await validateManagedStore(storeRoot, root, { semantic: true });
      expect(result.healthy).toBe(true);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ severity: "warning", code: "site-file-count-mismatch" }),
          expect.objectContaining({ severity: "warning", code: "site-byte-count-mismatch" }),
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("migración portable: espacio y verificación", () => {
  it("crea un snapshot exacto, hasheado y sin sobrescribir destinos existentes", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-migration-snapshot-"));
    try {
      const source = join(root, "source");
      const snapshot = join(root, "snapshot");
      await mkdir(join(source, "nested"), { recursive: true });
      await writeFile(join(source, "a.txt"), "uno", "utf8");
      await writeFile(join(source, "nested", "b.txt"), "dos", "utf8");

      const result = await createVerifiedSnapshot({
        destinationRoot: snapshot,
        entries: [{ key: "source:test", source, destinationRelative: "fuentes/test" }],
      });

      expect(result.ok).toBe(true);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toMatchObject({
        key: "source:test",
        ok: true,
        sourceFileCount: 2,
        destinationFileCount: 2,
      });
      expect(result.entries[0].sourceInventory.files.every((entry) => typeof entry.sha256 === "string")).toBe(true);
      expect(await readFile(join(snapshot, "fuentes", "test", "nested", "b.txt"), "utf8")).toBe("dos");

      await expect(
        createVerifiedSnapshot({
          destinationRoot: snapshot,
          entries: [{ key: "source:test", source, destinationRelative: "fuentes/test" }],
        }),
      ).rejects.toThrow("ya existe");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("resuelve un projectId duplicado cuando una fuente queda activa y las demás archivadas", () => {
    const ledger = [
      { sourceKey: "portable:stylo", projectId: "store-stylo-lashes", proposedAction: "review", decisionRequired: true },
      { sourceKey: "normal:stylo", projectId: "store-stylo-lashes", proposedAction: "review", decisionRequired: true },
      { sourceKey: "temporal:stylo", projectId: "store-stylo-lashes", proposedAction: "archive", decisionRequired: false },
    ];
    const duplicates = [{ projectId: "store-stylo-lashes", sources: ledger.map((entry) => entry.sourceKey) }];
    const result = applyLedgerDecisions(ledger, duplicates, {
      entries: [
        { sourceKey: "portable:stylo", action: "migrate-active" },
        { sourceKey: "normal:stylo", action: "archive" },
      ],
    });

    expect(result.unresolvedDuplicateProjectIds).toEqual([]);
    expect(result.ledger.find((entry) => entry.sourceKey === "portable:stylo")).toMatchObject({
      proposedAction: "migrate-active",
      decisionRequired: false,
    });
    expect(result.ledger.find((entry) => entry.sourceKey === "normal:stylo")).toMatchObject({
      proposedAction: "archive",
      decisionRequired: false,
    });
  });

  it("propaga el destino registrado para una fuente resuelta", () => {
    const ledger = [
      {
        sourceKey: "portable:stylo",
        projectId: "store-stylo-lashes",
        proposedAction: "review",
        decisionRequired: true,
        destination: null,
      },
    ];
    const result = applyLedgerDecisions(ledger, [], {
      entries: [
        {
          sourceKey: "portable:stylo",
          action: "migrate-active",
          destination: "proyectos/stylo-lashes--migrated",
        },
      ],
    });

    expect(result.ledger[0]).toMatchObject({
      proposedAction: "migrate-active",
      decisionRequired: false,
      destination: "proyectos/stylo-lashes--migrated",
    });
  });

  it("bloquea el plan cuando snapshots, staging y rollback no caben", () => {
    const result = estimateRequiredSpace({
      sourceSnapshotBytes: 10 * 1024 ** 3,
      stagingBytes: 9 * 1024 ** 3,
      rollbackBytes: 1 * 1024 ** 3,
      freeBytes: 16 * 1024 ** 3,
      compressionRatio: 0.75,
    });
    expect(result.sufficient).toBe(false);
    expect(result.requiredAdditionalBytes).toBeGreaterThan(result.freeBytes);
  });

  it("permite ubicar snapshots en otro volumen sin exigir que entren en el disco del repo", () => {
    const result = estimateStoragePlacement({
      sourceSnapshotBytes: 10 * 1024 ** 3,
      stagingBytes: 9 * 1024 ** 3,
      rollbackBytes: 1 * 1024 ** 3,
      archiveBytes: 512 * 1024 ** 2,
      localFreeBytes: 16 * 1024 ** 3,
      snapshotFreeBytes: 100 * 1024 ** 3,
      compressionRatio: 0.75,
    });

    expect(result.mode).toBe("split-volume");
    expect(result.archiveBytes).toBe(512 * 1024 ** 2);
    expect(result.local.sufficient).toBe(true);
    expect(result.snapshots.sufficient).toBe(true);
    expect(result.sufficient).toBe(true);
  });

  it("verifica todo lo heredado y permite archivos nuevos", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-migration-verify-"));
    try {
      const source = join(root, "source");
      const destination = join(root, "destination");
      await mkdir(join(source, "nested"), { recursive: true });
      await writeFile(join(source, "a.txt"), "uno", "utf8");
      await writeFile(join(source, "nested", "b.txt"), "dos", "utf8");
      const baseline = await inventoryTree(source, { hashFiles: true });
      await cp(source, destination, { recursive: true });
      await writeFile(join(destination, "nuevo.txt"), "creado después", "utf8");

      const valid = await verifyInheritedFiles(baseline, destination);
      expect(valid.ok).toBe(true);
      expect(valid.verified).toBe(2);

      await writeFile(join(destination, "a.txt"), "alterado", "utf8");
      const invalid = await verifyInheritedFiles(baseline, destination);
      expect(invalid.ok).toBe(false);
      expect(invalid.failures).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "a.txt", reason: "hash-mismatch" })]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("la verificación final cubre todo el ledger aunque decisions omita entradas automáticas", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-migration-ledger-coverage-"));
    try {
      const sourceA = join(root, "source-a");
      const sourceB = join(root, "source-b");
      const destinationA = join(root, "destination-a");
      await mkdir(sourceA, { recursive: true });
      await mkdir(sourceB, { recursive: true });
      await writeFile(join(sourceA, "a.txt"), "uno", "utf8");
      await writeFile(join(sourceB, "b.txt"), "dos", "utf8");
      await cp(sourceA, destinationA, { recursive: true });

      const sourceAInventory = await inventoryTree(sourceA, { hashFiles: true });
      const sourceBInventory = await inventoryTree(sourceB, { hashFiles: true });
      const baseline = {
        sources: {
          portable: {
            stores: [
              { sourceKey: "portable:a", projectId: null, inventory: sourceAInventory },
              { sourceKey: "portable:b", projectId: null, inventory: sourceBInventory },
            ],
          },
          normal: { stores: [] },
          looseEvidence: null,
        },
        ledger: [
          {
            sourceKey: "portable:a",
            proposedAction: "archive",
            decisionRequired: false,
            destination: null,
          },
          {
            sourceKey: "portable:b",
            proposedAction: "archive",
            decisionRequired: false,
            destination: null,
          },
        ],
      };
      const result = await verifyMigrationFromBaseline(baseline, {
        entries: [
          {
            sourceKey: "portable:a",
            action: "archive",
            destination: destinationA,
          },
        ],
      });

      expect(result.ok).toBe(false);
      expect(result.results).toHaveLength(2);
      expect(result.results.find((entry) => entry.sourceKey === "portable:a")?.ok).toBe(true);
      expect(result.results.find((entry) => entry.sourceKey === "portable:b")).toMatchObject({
        ok: false,
        error: "destination ausente.",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("incluye el runtime portable archivado en la verificación final", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-migration-runtime-coverage-"));
    try {
      const runtimeSource = join(root, "runtime-source");
      const runtimeDestination = join(root, "runtime-destination");
      await mkdir(runtimeSource, { recursive: true });
      await writeFile(join(runtimeSource, "evidence.json"), "{}", "utf8");
      const runtimeInventory = await inventoryTree(runtimeSource, { hashFiles: true });
      await cp(runtimeSource, runtimeDestination, { recursive: true });

      const baseline = {
        sources: {
          portable: { stores: [] },
          normal: { stores: [] },
          looseEvidence: null,
          portableRuntime: runtimeInventory,
          normalRuntime: { exists: false, files: [], fileCount: 0, bytes: 0, issues: [] },
        },
        ledger: [
          {
            sourceKey: "portable-runtime:.solara-runtime",
            proposedAction: "archive",
            decisionRequired: false,
            destination: null,
          },
        ],
      };
      const result = await verifyMigrationFromBaseline(baseline, {
        entries: [
          {
            sourceKey: "portable-runtime:.solara-runtime",
            action: "archive",
            destination: runtimeDestination,
          },
        ],
      });

      expect(result.ok).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toMatchObject({
        sourceKey: "portable-runtime:.solara-runtime",
        ok: true,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("migración portable: cutover transaccional", () => {
  it("liga el snapshot definitivo al baseline hasheado y detecta deriva posterior", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-migration-definitive-"));
    try {
      const snapshotRoot = join(root, "snapshot");
      const portableRoot = join(snapshotRoot, "portable");
      const { storeRoot } = await writeValidStore(portableRoot, "fixture-store");
      const sourceInventory = await inventoryTree(storeRoot, { hashFiles: true });
      const baseline = {
        errors: [],
        blockers: [],
        readyForDefinitiveSnapshot: true,
        sources: {
          portable: {
            stores: [
              {
                sourceKey: "portable:fixture-store",
                projectId: referenceStore.id,
                inventory: sourceInventory,
              },
            ],
          },
          normal: { stores: [] },
          looseEvidence: null,
          portableRuntime: { exists: false, files: [], fileCount: 0, bytes: 0, issues: [] },
        },
        ledger: [
          {
            sourceKey: "portable:fixture-store",
            proposedAction: "migrate-active",
            destination: "proyectos/fixture-store",
          },
        ],
      };
      const decisions = { recoveryDraftsReviewed: true, entries: [] };

      const result = await createDefinitiveMigrationSnapshot({
        decisions,
        destinationRoot: snapshotRoot,
        auditSources: async (options) => {
          expect(options.hashAll).toBe(true);
          return baseline;
        },
        snapshotFactory: async (options) => ({
          destinationRoot: snapshotRoot,
          metadata: {
            ...options.additionalMetadata,
            phase: options.phase,
            ledgerSources: {
              "portable:fixture-store": "portable/proyectos/fixture-store",
            },
          },
        }),
      });

      expect(result.baselineSha256).toBe(fingerprintBaseline(baseline));
      expect(result.baselineBinding.ok).toBe(true);
      expect(result.snapshot.metadata).toMatchObject({
        phase: "01-FUENTE-DEFINITIVA",
        baselineSha256: fingerprintBaseline(baseline),
      });

      await writeFile(join(storeRoot, "manifest.json"), "alterado", "utf8");
      await expect(verifySnapshotAgainstBaseline(result.snapshot, baseline)).rejects.toThrow(
        "no coincide con el baseline",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prepara staging activo desde el snapshot y lo valida semánticamente", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-migration-stage-"));
    try {
      const snapshotRoot = join(root, "snapshot");
      const portableRoot = join(snapshotRoot, "portable");
      const { storeRoot } = await writeValidStore(portableRoot, "fixture-store");
      const sourceInventory = await inventoryTree(storeRoot, { hashFiles: true });
      const baseline = {
        sources: {
          portable: {
            stores: [
              {
                sourceKey: "portable:fixture-store",
                projectId: referenceStore.id,
                inventory: sourceInventory,
              },
            ],
          },
          normal: { stores: [] },
          looseEvidence: null,
          portableRuntime: { exists: false, files: [], fileCount: 0, bytes: 0, issues: [] },
        },
        ledger: [
          {
            sourceKey: "portable:fixture-store",
            proposedAction: "migrate-active",
            destination: "proyectos/fixture-store",
          },
        ],
      };
      const snapshot = {
        destinationRoot: snapshotRoot,
        metadata: {
          phase: "01-FUENTE-DEFINITIVA",
          baselineSha256: fingerprintBaseline(baseline),
          ledgerSources: {
            "portable:fixture-store": "portable/proyectos/fixture-store",
          },
        },
      };
      const decisions = {
        recoveryDraftsReviewed: true,
        entries: [
          {
            sourceKey: "portable:fixture-store",
            action: "migrate-active",
            destination: "proyectos/fixture-store",
          },
        ],
      };
      const stageRoot = join(root, "stage");

      const result = await prepareStagingFromSnapshot({
        snapshot,
        baseline,
        decisions,
        stageRoot,
        repoRoot: root,
      });

      expect(result.ok).toBe(true);
      expect(result.entries).toHaveLength(1);
      expect(await readFile(join(stageRoot, "proyectos", "fixture-store", "manifest.json"), "utf8")).toContain(
        '"format":"solara-local-project"',
      );
      expect(result.entries[0].semantic.healthy).toBe(true);
      const stageManifest = JSON.parse(await readFile(join(stageRoot, "migration-staging-manifest.json"), "utf8"));
      expect(stageManifest.baselineSha256).toBe(fingerprintBaseline(baseline));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("archiva evidencia desde el snapshot de forma verificada e idempotente", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-migration-archive-"));
    try {
      const snapshotRoot = join(root, "snapshot");
      const runtimeRoot = join(snapshotRoot, "portable", ".solara-runtime");
      const archiveRoot = join(root, "archive", ".solara-runtime");
      await mkdir(runtimeRoot, { recursive: true });
      await writeFile(join(runtimeRoot, "evidence.json"), '{"ok":true}', "utf8");
      const runtimeInventory = await inventoryTree(runtimeRoot, { hashFiles: true });
      const baseline = {
        sources: {
          portable: { stores: [] },
          normal: { stores: [] },
          looseEvidence: null,
          portableRuntime: runtimeInventory,
        },
        ledger: [
          {
            sourceKey: "portable-runtime:.solara-runtime",
            proposedAction: "archive",
            destination: archiveRoot,
          },
        ],
      };
      const snapshot = {
        destinationRoot: snapshotRoot,
        metadata: {
          phase: "01-FUENTE-DEFINITIVA",
          baselineSha256: fingerprintBaseline(baseline),
          ledgerSources: {
            "portable-runtime:.solara-runtime": "portable/.solara-runtime",
          },
        },
      };
      const decisions = {
        entries: [
          {
            sourceKey: "portable-runtime:.solara-runtime",
            action: "archive",
            destination: archiveRoot,
          },
        ],
      };

      const first = await archiveMigrationFromSnapshot({ snapshot, baseline, decisions, repoRoot: root });
      const second = await archiveMigrationFromSnapshot({ snapshot, baseline, decisions, repoRoot: root });

      expect(first.ok).toBe(true);
      expect(first.entries[0].status).toBe("copied");
      expect(second.ok).toBe(true);
      expect(second.entries[0].status).toBe("already-verified");
      expect(await readFile(join(archiveRoot, "evidence.json"), "utf8")).toBe('{"ok":true}');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rechaza el cutover cuando el servidor normal sigue activo", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-migration-server-active-"));
    try {
      await expect(
        performMigrationCutover({
          baseline: {},
          decisions: { recoveryDraftsReviewed: true },
          rollback: join(root, "rollback"),
          checkNormalManagedServer: async () => ({ active: true, state: "active-managed" }),
        }),
      ).rejects.toThrow("servidor normal sigue activo");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rechaza staging y destino en volúmenes distintos antes de mover datos", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-migration-volume-"));
    try {
      const stageRoot = join(root, "stage");
      await mkdir(join(stageRoot, "proyectos"), { recursive: true });
      await expect(
        performMigrationCutover({
          baseline: {},
          decisions: { recoveryDraftsReviewed: true },
          stageRoot,
          target: join(root, "target-proyectos"),
          rollback: join(root, "rollback"),
          checkNormalManagedServer: async () => ({ active: false, state: "absent" }),
          volumeKey: (pathname) => (pathname.includes(`${join("stage", "proyectos")}`) ? "stage-volume" : "target-volume"),
        }),
      ).rejects.toThrow("mismo volumen");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restaura el destino anterior si falla la verificación final del cutover real", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-migration-real-rollback-"));
    try {
      const stageRoot = join(root, "stage");
      const stagingProjects = join(stageRoot, "proyectos");
      const target = join(root, "target-proyectos");
      const rollback = join(root, "rollback");
      const baseline = { ledger: [] };
      await mkdir(stagingProjects, { recursive: true });
      await mkdir(target, { recursive: true });
      await writeFile(join(stagingProjects, "state.txt"), "nuevo", "utf8");
      await writeFile(join(target, "state.txt"), "anterior", "utf8");
      await writeFile(
        join(stageRoot, "migration-staging-manifest.json"),
        JSON.stringify({ baselineSha256: fingerprintBaseline(baseline) }),
        "utf8",
      );

      await expect(
        performMigrationCutover({
          baseline,
          decisions: { recoveryDraftsReviewed: true },
          stageRoot,
          target,
          rollback,
          checkNormalManagedServer: async () => ({ active: false, state: "absent" }),
          volumeKey: () => "same-volume",
          validateMigration: async () => {
            throw new Error("verificación final inducida");
          },
        }),
      ).rejects.toThrow("verificación final inducida");

      expect(await readFile(join(target, "state.txt"), "utf8")).toBe("anterior");
      expect(await readFile(join(stagingProjects, "state.txt"), "utf8")).toBe("nuevo");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("valida una sola vez dentro de la transacción y conserva el rollback al completar", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-migration-real-success-"));
    try {
      const stageRoot = join(root, "stage");
      const stagingProjects = join(stageRoot, "proyectos");
      const target = join(root, "target-proyectos");
      const rollback = join(root, "rollback");
      const baseline = { ledger: [] };
      let validations = 0;
      await mkdir(stagingProjects, { recursive: true });
      await mkdir(target, { recursive: true });
      await writeFile(join(stagingProjects, "state.txt"), "nuevo", "utf8");
      await writeFile(join(target, "state.txt"), "anterior", "utf8");
      await writeFile(
        join(stageRoot, "migration-staging-manifest.json"),
        JSON.stringify({ baselineSha256: fingerprintBaseline(baseline) }),
        "utf8",
      );

      const result = await performMigrationCutover({
        baseline,
        decisions: { recoveryDraftsReviewed: true },
        stageRoot,
        target,
        rollback,
        checkNormalManagedServer: async () => ({ active: false, state: "absent" }),
        volumeKey: () => "same-volume",
        validateMigration: async () => {
          validations += 1;
          return { ok: true, results: [] };
        },
      });

      expect(validations).toBe(1);
      expect(result.verification).toEqual({ ok: true, results: [] });
      expect(await readFile(join(target, "state.txt"), "utf8")).toBe("nuevo");
      expect(await readFile(join(rollback, "state.txt"), "utf8")).toBe("anterior");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restaura el destino anterior si la validación del nuevo staging falla", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-migration-rollback-"));
    try {
      const staging = join(root, "staging");
      const target = join(root, "proyectos");
      const rollback = join(root, "rollback");
      await mkdir(staging, { recursive: true });
      await mkdir(target, { recursive: true });
      await writeFile(join(staging, "state.txt"), "nuevo", "utf8");
      await writeFile(join(target, "state.txt"), "anterior", "utf8");

      await expect(
        transactionalCutoverForTest({
          staging,
          target,
          rollback,
          validate: async () => {
            throw new Error("fallo inducido");
          },
        }),
      ).rejects.toThrow("fallo inducido");

      expect(await readFile(join(target, "state.txt"), "utf8")).toBe("anterior");
      expect(await readFile(join(staging, "state.txt"), "utf8")).toBe("nuevo");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
