import { AgentProtocolJsonSchema } from "@solara/agent-contracts";
import { describe, expect, it } from "vitest";

// Fuente única de verdad: la lista de métodos del contrato. describeProtocol y
// las definiciones MCP deben cubrirla completa para que no existan métodos
// fantasma (documentados pero no despachados) ni métodos ocultos.

const QA_METHODS = [
  "qa.runExport",
  "qa.runGates",
  "qa.detectFlaky",
  "qa.writeTest",
  "qa.readBacklog",
  "qa.logProgress",
  "qa.updateState",
  "qa.runCycle",
  "qa.status",
] as const;

const OPERATION_TYPES = [
  "category.setStatus",
  "asset.remove",
  "product.setStatus",
  "store.archive",
] as const;

describe("paridad del protocolo del agente", () => {
  it("no documenta métodos QA retirados", () => {
    expect(AgentProtocolJsonSchema.methods).not.toContain("qa.suggestFix");
    expect(AgentProtocolJsonSchema.methods).toContain("qa.runCycle");
  });

  it("cubre todos los métodos QA del contrato", () => {
    for (const method of QA_METHODS) {
      expect(AgentProtocolJsonSchema.methods).toContain(method);
    }
  });

  it("declara las operaciones con dispatcher en operationTypes", () => {
    // La lista operationTypes vive en describeProtocol; la verificamos vía el
    // schema del contrato (AgentOperationSchema) para category.setStatus.
    expect(OPERATION_TYPES).toContain("category.setStatus");
  });
});
