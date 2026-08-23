import {
  AGENT_PROTOCOL,
  AGENT_PROTOCOL_VERSION,
  AgentRequestSchema,
  protocolError,
  protocolOk,
} from "@solara/agent-contracts";
import { agentError, createAgentController, dispatchAgentMethod } from "@solara/agent-control";

const MCP_VERSION = "2024-11-05";

const toolDefinitions = [
  {
    name: "solara_health",
    description: "Comprueba que SolaraCommerce está disponible y puede escribir.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    method: "health",
  },
  {
    name: "solara_stores_list",
    description: "Lista tiendas y reportes de recuperación sin abrir el catálogo completo.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    method: "stores.list",
  },
  {
    name: "solara_store_get",
    description: "Obtiene el resumen o el catálogo acotado de una tienda.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["storeId"],
      properties: { storeId: { type: "string" }, include: { enum: ["summary", "catalog"] } },
    },
    method: "stores.get",
  },
  {
    name: "solara_plan_create",
    description: "Valida y prepara operaciones tipadas sin escribir en disco.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["operations"],
      properties: {
        storeId: { type: "string" },
        baseVersion: { type: ["integer", "null"] },
        idempotencyKey: { type: "string" },
        operations: { type: "array", maxItems: 500 },
      },
    },
    method: "plans.create",
  },
  {
    name: "solara_plan_commit",
    description: "Relee la versión, valida, exporta y publica una transacción atómica.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["planId"],
      properties: { planId: { type: "string" }, idempotencyKey: { type: "string" } },
    },
    method: "plans.commit",
  },
  {
    name: "solara_asset_stage",
    description:
      "Valida una imagen por bytes, MIME, firma, hash y dimensiones antes de adjuntarla.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["name", "mimeType", "source"],
      properties: {
        name: { type: "string" },
        alt: { type: "string" },
        mimeType: { enum: ["image/png", "image/jpeg", "image/webp", "image/gif"] },
        source: { type: "object" },
      },
    },
    method: "assets.stage",
  },
];

function mcpResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function mcpError(id, error) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: -32000,
      message: error.message,
      data: { code: error.code, details: error.details },
    },
  };
}

function writeLine(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

/**
 * Host único para Electron portable. stdout queda reservado al protocolo;
 * cualquier diagnóstico debe ir por el logger de main o por stderr.
 */
export async function runAgentHost({
  storage,
  applicationRoot,
  appVersion = "0.1.0",
  mode = "mcp",
}) {
  const controller = createAgentController({ storage, applicationRoot });

  const handleJsonl = async (payload) => {
    let request;
    try {
      request = AgentRequestSchema.parse(payload);
    } catch (error) {
      const id = payload && typeof payload === "object" && "id" in payload ? payload.id : "invalid";
      writeLine(
        protocolError(
          typeof id === "string" || typeof id === "number" ? id : "invalid",
          "REQUEST_INVALID",
          error instanceof Error ? error.message : String(error),
        ),
      );
      return;
    }
    try {
      writeLine(
        protocolOk(
          request.id,
          await dispatchAgentMethod(controller, request.method, request.params),
        ),
      );
    } catch (error) {
      const detail = agentError(error);
      writeLine(protocolError(request.id, detail.code, detail.message, detail.details));
    }
  };

  const handleMcp = async (payload) => {
    if (!payload || payload.jsonrpc !== "2.0" || typeof payload.method !== "string") return;
    if (
      payload.method === "notifications/initialized" ||
      payload.method.startsWith("notifications/")
    )
      return;
    try {
      if (payload.method === "initialize") {
        writeLine(
          mcpResult(payload.id, {
            protocolVersion: MCP_VERSION,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "solara-commerce-agent", version: appVersion },
            instructions: "Usá planes tipados; no hay acceso a HTML, JS ni parches arbitrarios.",
          }),
        );
        return;
      }
      if (payload.method === "ping") {
        writeLine(mcpResult(payload.id, {}));
        return;
      }
      if (payload.method === "tools/list") {
        writeLine(
          mcpResult(payload.id, { tools: toolDefinitions.map(({ method, ...tool }) => tool) }),
        );
        return;
      }
      if (payload.method === "tools/call") {
        const name = payload.params?.name;
        const tool = toolDefinitions.find((candidate) => candidate.name === name);
        if (!tool)
          throw Object.assign(new Error(`Herramienta MCP desconocida: ${String(name)}.`), {
            code: "METHOD_NOT_FOUND",
          });
        const result = await dispatchAgentMethod(
          controller,
          tool.method,
          payload.params?.arguments ?? {},
        );
        writeLine(
          mcpResult(payload.id, {
            content: [{ type: "text", text: JSON.stringify(result) }],
            structuredContent: result,
            isError: false,
          }),
        );
        return;
      }
      throw Object.assign(new Error(`Método MCP desconocido: ${payload.method}.`), {
        code: "METHOD_NOT_FOUND",
      });
    } catch (error) {
      writeLine(mcpError(payload.id, agentError(error)));
    }
  };

  // Electron en Windows puede exponer stdin como un stream sin readline/TTY
  // estable. Escuchar data/end directamente evita que el iterador de readline
  // cierre el host antes de entregar la primera línea al protocolo.
  await new Promise((resolveInput) => {
    process.stdin.setEncoding("utf8");
    let buffer = "";
    let chain = Promise.resolve();
    const handleLine = (line) => {
      if (!line.trim()) return;
      let payload;
      try {
        payload = JSON.parse(line);
      } catch {
        writeLine(
          protocolError("invalid", "JSON_INVALID", "Cada línea debe ser un objeto JSON válido."),
        );
        return;
      }
      chain = chain.then(() => (mode === "jsonl" ? handleJsonl(payload) : handleMcp(payload)));
    };
    process.stdin.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      lines.forEach(handleLine);
    });
    process.stdin.once("end", () => {
      if (buffer.trim()) handleLine(buffer);
      void chain.finally(resolveInput);
    });
    process.stdin.resume();
  });
}

export { AGENT_PROTOCOL, AGENT_PROTOCOL_VERSION };
