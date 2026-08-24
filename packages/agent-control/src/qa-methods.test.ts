import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createQaContext, readBacklog, writeTest } from "./qa-methods.js";

describe("QA perpetuo", () => {
  it("readBacklog lee perpetual-state.json", async () => {
    const root = await mkdtemp(join(tmpdir(), "qa-backlog-"));
    try {
      const docsDir = join(root, "docs");
      await mkdir(docsDir, { recursive: true });
      await writeFile(
        join(docsDir, "perpetual-state.json"),
        JSON.stringify({ nextItem: "P10-1" }),
        "utf8",
      );
      const scopes = new Set(["qa:write"]);
      const ctx = createQaContext(root, scopes, async () => {});
      const backlog = await readBacklog(ctx);
      expect(backlog.nextItem).toBe("P10-1");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("writeTest rechaza rutas fuera de packages/*/src/", async () => {
    const root = await mkdtemp(join(tmpdir(), "qa-write-"));
    try {
      const scopes = new Set(["qa:write"]);
      const ctx = createQaContext(root, scopes, async () => {});
      await expect(writeTest(ctx, "src/malicious.ts", "code")).rejects.toMatchObject({
        code: "QA_PATH_INVALID",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("scope qa:write es requerido", async () => {
    const root = await mkdtemp(join(tmpdir(), "qa-scope-"));
    try {
      const noScope = new Set<string>();
      const ctx = createQaContext(root, noScope, async () => {});
      await expect(readBacklog(ctx)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
