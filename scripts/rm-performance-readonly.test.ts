import { afterEach, describe, expect, it } from "vitest";
import {
  type ReadOnlyManagedProject,
  startStudioServer,
  stopStudioServer,
} from "../tests/e2e/studio-server";

const managedProject: ReadOnlyManagedProject = {
  projectId: "store-rm-descartables",
  name: "RM Descartables",
  slug: "rm-descartables",
  version: 31,
  updatedAt: "2026-09-01T05:20:39.161Z",
  savedAt: "2026-09-01T05:21:18.588Z",
  folder: "rm-descartables--704e2877",
  currentBytes: new Uint8Array([123, 125]),
};

let server: Awaited<ReturnType<typeof startStudioServer>> | undefined;

afterEach(async () => {
  if (!server) return;
  await stopStudioServer(server.server);
  server = undefined;
});

describe("servidor administrado read-only del audit", () => {
  it("rechaza escrituras de persistencia, migración, backup y commit", async () => {
    server = await startStudioServer({ managedProject });
    const attempts: Array<{ method: "POST" | "PUT"; path: string }> = [
      { method: "POST", path: "/__solara/storage/projects/store-rm-descartables/save" },
      { method: "PUT", path: "/__solara/storage/projects/store-rm-descartables/current" },
      { method: "POST", path: "/__solara/storage/migrations/retire-legacy-demo" },
      { method: "POST", path: "/__solara/storage/backups" },
      { method: "POST", path: "/__solara/storage/commit" },
    ];

    for (const attempt of attempts) {
      const response = await fetch(`${server.url}${attempt.path}`, {
        method: attempt.method,
        body: "{}",
        headers: { "Content-Type": "application/json" },
      });
      expect(response.status, `${attempt.method} ${attempt.path}`).toBe(405);
      expect(response.headers.get("allow")).toBe("GET");
      await expect(response.json()).resolves.toMatchObject({ ok: false });
    }

    expect(server.writeAttempts).toEqual(attempts);
  });
});
