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
});
