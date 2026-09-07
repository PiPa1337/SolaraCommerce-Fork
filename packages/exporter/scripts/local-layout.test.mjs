import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ensureLocalLayout,
  LOCAL_INSTANCE_FORMAT,
  LOCAL_LAYOUT_VERSION,
  resolveLocalLayout,
} from "./local-layout.mjs";

describe("local layout", () => {
  it("resuelve proyectos y runtime dentro del checkout", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-local-layout-"));
    try {
      const layout = resolveLocalLayout({ applicationRoot: root });
      expect(layout.applicationRoot).toBe(root);
      expect(layout.projectsRoot).toBe(join(root, "proyectos"));
      expect(layout.runtimeRoot).toBe(join(root, ".solara-runtime"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("crea sólo el layout local esperado y registra instance.json", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-local-layout-"));
    try {
      const layout = resolveLocalLayout({ applicationRoot: root });
      const ensured = await ensureLocalLayout(layout, { appVersion: "test" });
      const instance = JSON.parse(await readFile(ensured.instancePath, "utf8"));
      expect(instance).toMatchObject({
        format: LOCAL_INSTANCE_FORMAT,
        appVersion: "test",
        layoutVersion: LOCAL_LAYOUT_VERSION,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
