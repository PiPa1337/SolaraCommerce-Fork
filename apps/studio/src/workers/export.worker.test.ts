import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { beforeAll, describe, expect, it } from "vitest";

interface SentExportMessage {
  id: string;
  ok?: boolean;
  kind?: "export-stage";
  stage?: string;
  error?: string;
  result?: {
    files?: unknown;
    audit?: Array<{ severity: string }>;
    optimization?: { score: number; counts: { critical: number } };
    criticalCount?: number;
  };
}

interface WorkerStub {
  onmessage: ((event: { data: unknown }) => void) | undefined;
  postMessage: (message: unknown) => void;
}

let send: (data: unknown) => SentExportMessage[];

function withBrokenDescription(project: typeof catalogModernStore): typeof catalogModernStore {
  const clone = structuredClone(project);
  if (clone.products[0]) clone.products[0] = { ...clone.products[0], description: "" };
  return clone;
}

beforeAll(async () => {
  const stub: WorkerStub = {
    onmessage: undefined,
    postMessage: () => undefined,
  };
  (globalThis as Record<string, unknown>).self = stub;
  // El worker no exporta nada; se carga por efecto y se usa su onmessage.
  // @ts-expect-error: archivo de worker sin exports (script, no módulo).
  await import("./export.worker");
  if (!stub.onmessage) throw new Error("El worker no registró onmessage.");
  const handler = stub.onmessage;
  send = (data) => {
    const messages: SentExportMessage[] = [];
    stub.postMessage = (message) => {
      messages.push(message as SentExportMessage);
    };
    handler({ data });
    return messages;
  };
});

describe("export.worker", () => {
  it("emite las etapas en orden y entrega files, audit, optimization y criticalCount", () => {
    const messages = send({
      id: "site-1",
      type: "site",
      project: catalogModernStore,
      mode: "draft",
      options: { publicAiContext: false, optimizationProfile: "safe" },
    });
    expect(messages).toHaveLength(4);
    expect(messages.slice(0, 3).map((message) => message.stage)).toEqual([
      "validate",
      "render",
      "package",
    ]);
    for (const message of messages.slice(0, 3)) {
      expect(message).toMatchObject({ id: "site-1", kind: "export-stage" });
      expect(message.ok).toBeUndefined();
    }
    const final = messages[3];
    expect(final).toMatchObject({ id: "site-1", ok: true });
    const audit = final.result?.audit ?? [];
    expect(final.result?.files).toBeInstanceOf(Map);
    expect(final.result?.optimization?.score).toBeGreaterThanOrEqual(0);
    expect(final.result?.criticalCount).toBe(
      audit.filter((issue) => issue.severity === "critical").length,
    );
  });

  it("reporta el mismo conteo de críticos que la auditoría para el mismo proyecto", () => {
    const site = send({
      id: "site-2",
      type: "site",
      project: catalogModernStore,
      mode: "draft",
      options: { publicAiContext: false },
    }).at(-1);
    const audit = send({
      id: "audit-1",
      type: "audit",
      project: catalogModernStore,
      publicAiContext: false,
    }).at(-1);
    expect(site?.ok).toBe(true);
    expect(audit?.ok).toBe(true);
    expect(audit?.result?.criticalCount).toBeDefined();
    expect(site?.result?.criticalCount).toBe(audit?.result?.criticalCount);
  });

  it("contabiliza los críticos del proyecto en el resultado del sitio", () => {
    const broken = withBrokenDescription(catalogModernStore);
    const messages = send({
      id: "site-3",
      type: "site",
      project: broken,
      mode: "draft",
      options: { publicAiContext: false },
    });
    expect(messages.at(-1)?.ok).toBe(true);
    expect(messages.at(-1)?.result?.criticalCount).toBeGreaterThanOrEqual(1);
  });

  it("bloquea la producción con críticos y devuelve el error", () => {
    const broken = withBrokenDescription(catalogModernStore);
    const messages = send({
      id: "site-4",
      type: "site",
      project: broken,
      mode: "production",
      options: { publicAiContext: false },
    });
    const final = messages.at(-1);
    expect(final?.ok).toBe(false);
    expect(final?.error).toContain("críticos");
  });
});
