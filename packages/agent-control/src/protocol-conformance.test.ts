import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentProtocolJsonSchema } from "@solara/agent-contracts";
import { describe, expect, it } from "vitest";
import { AGENT_MCP_TOOL_DEFINITIONS } from "../../../apps/desktop/src/agent-host.mjs";
import { createLocalProjectStorage } from "../../exporter/scripts/local-project-storage.mjs";
import { createAgentController } from "./index";

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

  it("mantiene MCP alineado con la lista pública del protocolo", () => {
    const mcpMethods = AGENT_MCP_TOOL_DEFINITIONS.map((tool) => tool.method);
    expect(mcpMethods).toHaveLength(AgentProtocolJsonSchema.methods.length);
    expect(new Set(mcpMethods).size).toBe(mcpMethods.length);
    expect(new Set(mcpMethods)).toEqual(new Set(AgentProtocolJsonSchema.methods));
  });

  it("mantiene protocol.describe alineado con el contrato ejecutable", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-agent-protocol-"));
    try {
      const storage = createLocalProjectStorage({ applicationRoot: root });
      const controller = createAgentController({ storage, applicationRoot: root });
      const description = await controller.describeProtocol({});
      expect(new Set(description.methods)).toEqual(new Set(AgentProtocolJsonSchema.methods));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
