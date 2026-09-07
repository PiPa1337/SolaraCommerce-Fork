import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSolaraRequestHandler } from "./solara-request-handler.mjs";

describe("managed session identity", () => {
  it("expone el sessionId exacto de la instancia administrada", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-session-handler-"));
    let handler;
    try {
      handler = createSolaraRequestHandler({
        applicationRoot: root,
        shutdownToken: "token-test-123456",
        sessionId: "session-handler-0001",
        origin: "http://127.0.0.1:4173",
        onShutdown: () => {},
      });
      const response = await handler.handle({
        method: "GET",
        pathname: "/__solara/session",
        headers: {},
      });
      expect(response.status).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        managed: true,
        sessionId: "session-handler-0001",
      });
    } finally {
      await handler?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
