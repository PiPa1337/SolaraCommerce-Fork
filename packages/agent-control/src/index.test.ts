import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createLocalProjectStorage } from "../../exporter/scripts/local-project-storage.mjs";
import { readProjectArchive } from "../../exporter/src/index";
import { createAgentController } from "./index";

const onePixelPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("control nativo del agente", () => {
  it("crea, stagea, adjunta y publica una tienda sin copiar el demo", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-agent-control-"));
    try {
      const storage = createLocalProjectStorage({
        applicationRoot: root,
        projectsRoot: join(root, "proyectos"),
        stagingRoot: join(root, ".solara-runtime", "transactions"),
      });
      const controller = createAgentController({ storage, applicationRoot: root });
      const staged = await controller.stageAsset({
        name: "taza.png",
        alt: "Taza",
        mimeType: "image/png",
        source: { kind: "base64", data: onePixelPng },
      });
      const plan = await controller.createPlan({
        idempotencyKey: "agent-test-create-001",
        operations: [
          {
            type: "store.create",
            storeId: "store-agent-test",
            name: "Tienda de prueba",
            slug: "tienda-prueba",
          },
          {
            type: "product.create",
            productId: "product-taza",
            slug: "taza",
            title: "Taza",
            description: "Taza",
            priceCents: 1500,
            imageIds: [staged.assetId],
          },
          {
            type: "asset.attach",
            assetId: staged.assetId,
            target: "product",
            productId: "product-taza",
          },
        ],
      });
      const receipt = await controller.commitPlan({
        planId: plan.planId,
        idempotencyKey: "agent-test-create-001",
      });
      expect(receipt.storeId).toBe("store-agent-test");
      const current = await storage.readCurrent("store-agent-test");
      if (!current) throw new Error("Falta el respaldo del test.");
      const project = readProjectArchive(Buffer.from(current.bytes).toString("utf8"));
      expect(project.name).toBe("Tienda de prueba");
      expect(project.products).toHaveLength(1);
      expect(project.products[0]?.imageIds).toContain(staged.assetId);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("recupera planes, sube assets por chunks, mantiene lock y ejecuta jobs", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-agent-durable-"));
    try {
      const storage = createLocalProjectStorage({
        applicationRoot: root,
        projectsRoot: join(root, "proyectos"),
        stagingRoot: join(root, ".solara-runtime", "transactions"),
      });
      const first = createAgentController({ storage, applicationRoot: root });
      const upload = await first.beginAssetUpload({
        name: "marca.png",
        alt: "Marca",
        mimeType: "image/png",
        expectedBytes: Buffer.from(onePixelPng, "base64").byteLength,
      });
      await first.uploadAssetChunk({
        uploadId: upload.uploadId,
        sequence: 0,
        data: onePixelPng,
      });
      const staged = await first.finishAssetUpload({ uploadId: upload.uploadId });
      const plan = await first.createPlan({
        idempotencyKey: "durable-agent-plan-001",
        operations: [
          { type: "store.create", storeId: "store-durable", name: "Durable", slug: "durable" },
          {
            type: "product.create",
            productId: "product-durable",
            slug: "producto",
            title: "Producto",
            priceCents: 100,
            imageIds: [staged.assetId],
          },
          {
            type: "asset.attach",
            assetId: staged.assetId,
            target: "product",
            productId: "product-durable",
          },
        ],
      });
      expect(plan.diff.products.created).toContain("product-durable");

      const recovered = createAgentController({ storage, applicationRoot: root });
      expect((await recovered.getPlan({ planId: plan.planId })).planId).toBe(plan.planId);
      const job = await recovered.commitPlan({
        planId: plan.planId,
        idempotencyKey: "durable-agent-plan-001",
        async: true,
      });
      let finalJob = await recovered.getJob({ jobId: job.jobId });
      for (
        let attempt = 0;
        attempt < 100 && ["queued", "running"].includes(finalJob.status);
        attempt += 1
      ) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        finalJob = await recovered.getJob({ jobId: job.jobId });
      }
      expect(finalJob.status).toBe("succeeded");
      const replay = await recovered.commitPlan({
        planId: plan.planId,
        idempotencyKey: "durable-agent-plan-001",
      });
      expect(replay.version).toBe(finalJob.result.version);
      const current = await storage.readCurrent("store-durable");
      expect(current).toBeDefined();

      const update = await recovered.createPlan({
        storeId: "store-durable",
        baseVersion: 1,
        operations: [{ type: "store.updateSeo", changes: { title: "Durable nueva" } }],
      });
      const competing = createAgentController({ storage, applicationRoot: root });
      await expect(
        competing.createPlan({
          storeId: "store-durable",
          baseVersion: 1,
          operations: [{ type: "store.updateSeo", changes: { title: "Competidora" } }],
        }),
      ).rejects.toMatchObject({ code: "AGENT_LOCKED" });
      await recovered.discardPlan({ planId: update.planId });

      const readOnly = createAgentController({
        storage,
        applicationRoot: root,
        scopes: ["read"],
      });
      await expect(
        readOnly.createPlan({
          storeId: "store-durable",
          baseVersion: 1,
          operations: [{ type: "store.updateSeo", changes: { title: "No permitido" } }],
        }),
      ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
