import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  detectPortableFirstRun,
  ensurePortableLayout,
  resolvePortableLayout,
} from "./portable-layout.mjs";

describe("detectPortableFirstRun", () => {
  it("marca primera ejecución cuando no existe instance.json en la raíz", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-layout-first-"));
    try {
      const layout = resolvePortableLayout({
        mode: "packaged",
        executablePath: join(root, "app.exe"),
      });
      const detection = await detectPortableFirstRun(layout.portableRoot, layout.instancePath);
      expect(detection.firstRun).toBe(true);
      expect(detection.instanceExists).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("no marca primera ejecución cuando instance.json ya existe", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-layout-again-"));
    try {
      const layout = resolvePortableLayout({
        mode: "packaged",
        executablePath: join(root, "app.exe"),
      });
      const ensured = await ensurePortableLayout(layout, { appVersion: "0.1.0" });
      const detection = await detectPortableFirstRun(ensured.portableRoot, ensured.instancePath);
      expect(detection.firstRun).toBe(false);
      expect(detection.instanceExists).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("tolera un runtimeRoot ausente sin instance.json", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-layout-empty-"));
    try {
      const layout = resolvePortableLayout({
        mode: "packaged",
        executablePath: join(root, "app.exe"),
      });
      await mkdir(layout.runtimeRoot, { recursive: true });
      const detection = await detectPortableFirstRun(layout.portableRoot, layout.instancePath);
      expect(detection.firstRun).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
