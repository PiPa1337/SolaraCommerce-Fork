import { AgentProtocolJsonSchema } from "@solara/agent-contracts";
import { describe, expect, it } from "vitest";
import { AgentClient, createResponseTransport } from "./index";

describe("SDK del agente", () => {
  it("expone wrappers para los 34 métodos públicos del protocolo", async () => {
    const calls: Array<{ method: string; params: unknown }> = [];
    const client = new AgentClient(
      createResponseTransport(async (method, params) => {
        calls.push({ method, params });
        return { protocol: "solara-agent", version: 1, id: 1, ok: true, result: { method } };
      }),
    );
    await client.health();
    await client.describeProtocol();
    await client.listStores();
    await client.getStore({ storeId: "store-demo", include: "summary" });
    await client.restoreStore({ storeId: "store-demo" });
    await client.getTemplate({ templateId: "catalog-modern" });
    await client.previewTemplateUpgrade({ templateId: "catalog-modern" });
    await client.commitTemplateUpgrade({
      previewId: "preview-1",
      baseVersion: 1,
      confirmation: "ACTUALIZAR_PLANTILLA",
    });
    await client.previewRollout({
      kind: "site-rebuild",
      target: { status: "active", excludeProtected: true },
    });
    await client.commitRollout({ previewId: "preview-1", async: false });
    await client.getRollout({ rolloutId: "rollout-1" });
    await client.rollbackRollout({
      rolloutId: "rollout-1",
      storeId: "store-demo",
      expectedVersion: 1,
    });
    await client.createPlan({
      operations: [
        { type: "store.archive", storeId: "store-demo", confirmation: "ARCHIVAR_TIENDA" },
      ],
    });
    await client.getPlan({ planId: "plan-1", includeProject: false });
    await client.commitPlan({ planId: "plan-1", async: false });
    await client.createAndCommitPlan({
      operations: [
        { type: "store.archive", storeId: "store-demo", confirmation: "ARCHIVAR_TIENDA" },
      ],
    });
    await client.discardPlan({ planId: "plan-1" });
    await client.heartbeatPlan({ planId: "plan-1" });
    await client.getJob({ jobId: "job-1" });
    await client.listAudit({ limit: 50 });
    await client.stageAsset({
      name: "demo.png",
      alt: "Demo",
      mimeType: "image/png",
      source: { kind: "base64", data: "AA==" },
    });
    await client.generatePlaceholderAsset({
      name: "placeholder.png",
      alt: "Placeholder",
      width: 512,
      height: 512,
      pattern: "stripes",
      seed: "demo",
    });
    await client.beginAssetUpload({ name: "demo.png", alt: "Demo", mimeType: "image/png" });
    await client.uploadAssetChunk({ uploadId: "upload-1", sequence: 0, data: "AA==" });
    await client.finishAssetUpload({ uploadId: "upload-1" });
    await client.qaRunExport({ storeId: "store-demo", projectData: { id: "store-demo" } });
    await client.qaRunGates({ suite: "quick" });
    await client.qaDetectFlaky({ testFile: "packages/core/src/index.test.ts", runs: 5 });
    await client.qaWriteTest({
      filePath: "packages/core/src/generated.test.ts",
      content: "import { it } from 'vitest';",
    });
    await client.qaReadBacklog();
    await client.qaLogProgress({ entry: "avance" });
    await client.qaUpdateState({ patch: { nextItem: "P1" } });
    await client.qaRunCycle();
    await client.qaStatus();

    expect(calls.map((call) => call.method)).toEqual(AgentProtocolJsonSchema.methods);
  });
});
