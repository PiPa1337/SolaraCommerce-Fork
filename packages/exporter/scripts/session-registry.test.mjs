import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ensureLocalLayout, resolveLocalLayout } from "./local-layout.mjs";
import {
  isLocalSessionRecord,
  LOCAL_SESSION_FORMAT,
  LOCAL_SESSION_VERSION,
  listSessionRecords,
  removeSessionRecord,
  sessionRecordPath,
  writeSessionRecord,
} from "./session-registry.mjs";

function record(root, overrides = {}) {
  return {
    format: LOCAL_SESSION_FORMAT,
    version: LOCAL_SESSION_VERSION,
    sessionId: "session-test-0001",
    processId: 1234,
    port: 4173,
    projectRoot: root,
    startedAt: "2026-09-06T15:00:00.000Z",
    managed: true,
    shutdownToken: "token-test-1234567890",
    ...overrides,
  };
}

describe("local session registry", () => {
  it("escribe, lista y elimina registros válidos dentro de instances/", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-session-registry-"));
    try {
      const layout = resolveLocalLayout({ applicationRoot: root });
      await ensureLocalLayout(layout, { appVersion: "test" });
      const value = record(root);
      const pathname = await writeSessionRecord(layout, value);
      expect(pathname).toBe(join(layout.instancesRoot, `${value.sessionId}.json`));
      expect(JSON.parse(await readFile(pathname, "utf8"))).toEqual(value);
      await expect(listSessionRecords(layout)).resolves.toEqual([value]);
      await removeSessionRecord(layout, value.sessionId);
      await expect(listSessionRecords(layout)).resolves.toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rechaza registros de otro checkout o con identidad inválida", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-session-registry-"));
    try {
      const layout = resolveLocalLayout({ applicationRoot: root });
      await ensureLocalLayout(layout, { appVersion: "test" });
      expect(isLocalSessionRecord(record(root), { applicationRoot: root })).toBe(true);
      expect(
        isLocalSessionRecord(record(root, { projectRoot: join(root, "otro") }), {
          applicationRoot: root,
        }),
      ).toBe(false);
      expect(
        isLocalSessionRecord(record(root, { sessionId: "../fuera" }), { applicationRoot: root }),
      ).toBe(false);
      expect(
        isLocalSessionRecord(record(root, { shutdownToken: "corto" }), { applicationRoot: root }),
      ).toBe(false);
      await expect(
        writeSessionRecord(layout, record(root, { projectRoot: join(root, "otro") })),
      ).rejects.toThrow("registro de sesión local es inválido");
      expect(() => sessionRecordPath(layout, "../fuera")).toThrow(
        "identificador de sesión local es inválido",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("ignora JSON corrupto y puede limpiar sólo registros inválidos", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-session-registry-"));
    try {
      const layout = resolveLocalLayout({ applicationRoot: root });
      await ensureLocalLayout(layout, { appVersion: "test" });
      await mkdir(layout.instancesRoot, { recursive: true });
      const corrupt = join(layout.instancesRoot, "corrupt.json");
      const invalid = join(layout.instancesRoot, "invalid.json");
      await writeFile(corrupt, "{no-json", "utf8");
      await writeFile(invalid, JSON.stringify(record(root, { managed: false })), "utf8");
      await expect(listSessionRecords(layout)).resolves.toEqual([]);
      await expect(readFile(corrupt, "utf8")).resolves.toBe("{no-json");
      await expect(listSessionRecords(layout, { cleanInvalid: true })).resolves.toEqual([]);
      await expect(readFile(corrupt, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      await expect(readFile(invalid, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
