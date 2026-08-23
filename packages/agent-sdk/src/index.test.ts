import { describe, expect, it } from "vitest";
import { AgentClient, createResponseTransport } from "./index";

describe("SDK del agente", () => {
  it("mantiene el transporte tipado por método", async () => {
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
    expect(calls.map((call) => call.method)).toEqual([
      "health",
      "protocol.describe",
      "stores.list",
    ]);
  });
});
