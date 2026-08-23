import { describe, expect, it } from "vitest";
import {
  AgentOperationSchema,
  AgentProtocolJsonSchema,
  AgentRequestSchema,
  AssetUploadChunkParamsSchema,
  PlanCreateParamsSchema,
} from "./index";

describe("contrato del agente", () => {
  it("acepta el flujo tipado de tienda nueva", () => {
    const parsed = PlanCreateParamsSchema.parse({
      operations: [
        { type: "store.create", name: "Lunaria", slug: "lunaria" },
        { type: "product.create", slug: "taza", title: "Taza", priceCents: 1200 },
      ],
    });
    expect(parsed.operations).toHaveLength(2);
    expect(AgentOperationSchema.parse(parsed.operations[1]).type).toBe("product.create");
  });

  it("rechaza comandos arbitrarios y requests sin método", () => {
    expect(() => AgentOperationSchema.parse({ type: "project.patch", path: "x" })).toThrow();
    expect(() => AgentRequestSchema.parse({ id: 1 })).toThrow();
  });

  it("publica límites y métodos de recuperación del protocolo", () => {
    expect(AgentProtocolJsonSchema.methods).toContain("jobs.get");
    expect(AgentProtocolJsonSchema.methods).toContain("assets.upload.finish");
    expect(() => AssetUploadChunkParamsSchema.parse({ uploadId: "u", sequence: 0 })).toThrow();
  });
});
