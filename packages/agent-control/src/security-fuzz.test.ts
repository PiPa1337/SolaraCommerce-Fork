import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AgentOperationSchema,
  AgentRequestSchema,
  AgentResponseSchema,
  AssetStageParamsSchema,
  AssetUploadChunkParamsSchema,
  AssetUploadFinishParamsSchema,
} from "@solara/agent-contracts";
import { describe, expect, it } from "vitest";
import { createLocalProjectStorage } from "../../exporter/scripts/local-project-storage.mjs";
import { agentError, createAgentController, dispatchAgentMethod } from "./index";

async function snapshotTree(root: string): Promise<string> {
  const entries: string[] = [];

  async function visit(directory: string, prefix: string): Promise<void> {
    const children = await readdir(directory, { withFileTypes: true });
    for (const child of children.sort((left, right) => left.name.localeCompare(right.name))) {
      const relative = prefix ? `${prefix}/${child.name}` : child.name;
      const pathname = join(directory, child.name);
      if (child.isDirectory()) {
        await visit(pathname, relative);
      } else if (child.isFile()) {
        entries.push(`${relative}:${(await readFile(pathname)).toString("base64")}`);
      }
    }
  }

  await visit(root, "");
  return entries.join("\n");
}

function storageFor(root: string) {
  return createLocalProjectStorage({
    applicationRoot: root,
    projectsRoot: join(root, "proyectos"),
    stagingRoot: join(root, ".solara-runtime", "transactions"),
  });
}

describe("red team del protocolo del agente", () => {
  it("rechaza operaciones, MIME, chunks e IDs fuera del contrato", () => {
    const invalidOperations: unknown[] = [
      { type: "project.patch", path: "../../etc/passwd" },
      { type: "product.update", productId: "../escape", changes: { title: "x" } },
      { type: "product.create", slug: "No válido", title: "x", priceCents: 1 },
      { type: "theme.applyPreset", presetId: "dark" },
      { type: "store.archive", confirmation: "sí" },
      { type: "asset.attach", assetId: "asset-x", target: "javascript:alert(1)" },
    ];
    for (const candidate of invalidOperations) {
      expect(() => AgentOperationSchema.parse(candidate)).toThrow();
    }

    expect(() =>
      AssetStageParamsSchema.parse({
        name: "payload.svg",
        mimeType: "image/svg+xml",
        source: { kind: "base64", data: "AAAA" },
      }),
    ).toThrow();
    expect(() =>
      AssetUploadChunkParamsSchema.parse({
        uploadId: "../escape",
        sequence: -1,
        data: "not-base64",
      }),
    ).toThrow();
    expect(() =>
      AssetUploadChunkParamsSchema.parse({
        uploadId: "upload-ok",
        sequence: 0,
        data: "A".repeat(1_400_001),
      }),
    ).toThrow();
    expect(() =>
      AssetUploadFinishParamsSchema.parse({ uploadId: "upload-ok", sha256: "bad" }),
    ).toThrow();

    expect(() => AgentRequestSchema.parse({ id: "", method: "health" })).toThrow();
    expect(() => AgentRequestSchema.parse({ id: 1.5, method: "health" })).toThrow();
    expect(() => AgentRequestSchema.parse({ id: 1, method: "" })).toThrow();
    expect(() =>
      AgentResponseSchema.parse({ protocol: "other", version: 1, id: 1, ok: true }),
    ).toThrow();
  });

  it("no deja archivos parciales cuando falla una planificación o una carga", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-agent-fuzz-"));
    try {
      const storage = storageFor(root);
      const controller = createAgentController({ storage, applicationRoot: root });
      await controller.ready();

      const beforePlan = await snapshotTree(root);
      await expect(
        controller.createPlan({
          operations: [
            {
              type: "store.create",
              storeId: "store-fuzz",
              name: "Fuzz",
              slug: "fuzz",
              source: { kind: "clean" },
            },
            { type: "asset.attach", assetId: "asset-missing", target: "identity.logo" },
          ],
        }),
      ).rejects.toMatchObject({ code: "ASSET_NOT_STAGED" });
      expect(await snapshotTree(root)).toBe(beforePlan);

      const upload = await controller.beginAssetUpload({
        name: "fuzz.png",
        mimeType: "image/png",
        expectedBytes: 3,
      });
      const beforeDuplicate = await snapshotTree(root);
      await controller.uploadAssetChunk({ uploadId: upload.uploadId, sequence: 0, data: "AAAA" });
      const afterFirstChunk = await snapshotTree(root);
      await expect(
        controller.uploadAssetChunk({ uploadId: upload.uploadId, sequence: 0, data: "AAAA" }),
      ).rejects.toMatchObject({ code: "UPLOAD_SEQUENCE_INVALID" });
      expect(await snapshotTree(root)).toBe(afterFirstChunk);
      expect(afterFirstChunk).not.toBe(beforeDuplicate);

      const truncated = await controller.beginAssetUpload({
        name: "truncated.png",
        mimeType: "image/png",
        expectedBytes: 4,
      });
      await controller.uploadAssetChunk({
        uploadId: truncated.uploadId,
        sequence: 0,
        data: "AAAA",
      });
      const beforeFinish = await snapshotTree(root);
      await expect(
        controller.finishAssetUpload({ uploadId: truncated.uploadId }),
      ).rejects.toMatchObject({
        code: "UPLOAD_INCOMPLETE",
      });
      expect(await snapshotTree(root)).toBe(beforeFinish);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("mantiene el canal de solo lectura sin mutar disco y no expone stacks", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-agent-readonly-"));
    try {
      const storage = storageFor(root);
      const controller = createAgentController({
        storage,
        applicationRoot: root,
        scopes: ["read", "audit:read"],
      });
      await controller.ready();
      const before = await snapshotTree(root);

      await expect(
        dispatchAgentMethod(
          controller,
          "plans.create",
          {
            storeId: "missing",
            baseVersion: 1,
            operations: [{ type: "store.updateSeo", changes: { title: "No escribir" } }],
          },
          "readonly-fuzz",
        ),
      ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
      await expect(
        dispatchAgentMethod(
          controller,
          "assets.generatePlaceholder",
          { name: "no-write", seed: "fuzz" },
          "readonly-fuzz-asset",
        ),
      ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
      expect(await snapshotTree(root)).toBe(before);

      const error = agentError(new Error("fallo controlado"));
      expect(error).toEqual({ code: "AGENT_ERROR", message: "fallo controlado" });
      expect(error).not.toHaveProperty("stack");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
