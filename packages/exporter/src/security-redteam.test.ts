// @ts-nocheck

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { safeUrl, sanitizeRichText } from "@solara/module-sdk";
import { describe, expect, it } from "vitest";
import { createLocalProjectStorage } from "../scripts/local-project-storage.mjs";
import { resolvePortablePath } from "../scripts/portable-layout.mjs";
import {
  createSolaraRequestHandler,
  resolveStaticFile,
} from "../scripts/solara-request-handler.mjs";

describe("security: path traversal", () => {
  it("bloquea ../", () => {
    expect(() => resolvePortablePath("/tmp/root", "../../../etc/passwd")).toThrow();
    expect(() => resolvePortablePath("/tmp/root", "/absolute")).toThrow();
  });
  it("bloquea null bytes", () => {
    expect(() => resolvePortablePath("/tmp/root", "a\u0000b")).toThrow();
  });
});
describe("security: safeUrl", () => {
  it("bloquea javascript:", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("#");
  });
});
describe("security: sanitizeRichText", () => {
  it("elimina script/svg/on* y javascript href", () => {
    expect(sanitizeRichText("<p>Hola</p><script>alert(1)</script>")).not.toContain("<script>");
    expect(sanitizeRichText('<svg onload="alert(1)">')).not.toContain("svg");
    expect(sanitizeRichText('<p onclick="alert(1)">x</p>')).toBe("<p>x</p>");
    expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
  });
});
describe("security: CSV formula", () => {
  it("neutraliza =,+,-,@", async () => {
    const { exportProductsCsv, importProductsCsv } = await import("@solara/core");
    const { referenceStore } = await import("@solara/project-schema/fixture");
    const prod = JSON.parse(JSON.stringify(referenceStore.products[0]));
    const malicious = "=2+5+cmd|' /C calc'!A0";
    prod.title = malicious;
    const csv = exportProductsCsv([prod]);
    expect(csv).toContain("'=2+5");
    const imported = importProductsCsv(csv);
    expect(imported[0].title).toBe(malicious);
  });
});
describe("security: handler auth", () => {
  it("bloquea shutdown sin cookie", async () => {
    const root = await mkdtemp(join(tmpdir(), "sec-"));
    const handler = createSolaraRequestHandler({
      applicationRoot: root,
      shutdownToken: "tok123",
      origin: "http://127.0.0.1:4174",
      onShutdown: () => {},
    });
    const res = await handler.handle({
      method: "POST",
      pathname: "/__solara/shutdown",
      headers: { cookie: "" },
      body: null,
    });
    expect(res.status).toBe(403);
    await rm(root, { recursive: true, force: true });
  });
  it("bloquea storage sin cookie", async () => {
    const root = await mkdtemp(join(tmpdir(), "sec2-"));
    const handler = createSolaraRequestHandler({
      applicationRoot: root,
      shutdownToken: "tok123",
      origin: "http://127.0.0.1:4174",
      onShutdown: () => {},
    });
    const res = await handler.handle({
      method: "GET",
      pathname: "/__solara/storage/projects",
      headers: {},
      body: null,
    });
    expect(res.status).toBe(403);
    await rm(root, { recursive: true, force: true });
  });
  it("bloquea Origin distinto", async () => {
    const root = await mkdtemp(join(tmpdir(), "sec3-"));
    const handler = createSolaraRequestHandler({
      applicationRoot: root,
      shutdownToken: "tok123",
      origin: "http://127.0.0.1:4174",
      onShutdown: () => {},
    });
    const res = await handler.handle({
      method: "GET",
      pathname: "/__solara/storage/projects",
      headers: { origin: "http://evil.com", cookie: "solara_shutdown=tok123" },
      body: null,
    });
    expect(res.status).toBe(403);
    await rm(root, { recursive: true, force: true });
  });
});
describe("security: safeStaticPath", () => {
  it("bloquea ..%2f", async () => {
    const root = await mkdtemp(join(tmpdir(), "sec-static-"));
    await writeFile(join(root, "index.html"), "ok");
    expect(resolveStaticFile(root, "/..%2f..%2fetc/passwd")).toBeUndefined();
    expect(resolveStaticFile(root, "/%2e%2e/%2e%2e/etc/passwd")).toBeUndefined();
    await rm(root, { recursive: true, force: true });
  });
});
describe("security: postMessage", () => {
  it("runtime solo acepta parent", async () => {
    const { STOREFRONT_RUNTIME_JS } = await import("@solara/storefront-runtime");
    expect(STOREFRONT_RUNTIME_JS).toContain("event.source !== parent");
  });
});
describe("security: import .solara.json", () => {
  it("rechaza projectId traversal", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "sec-import-"));
    const storage = createLocalProjectStorage({ applicationRoot: tmp });
    await expect(
      storage.beginSave({
        projectId: "../evil",
        name: "x",
        slug: "x",
        projectUpdatedAt: new Date().toISOString(),
        expectedVersion: null,
      }),
    ).rejects.toThrow(/ID de tienda inválido/);
    await rm(tmp, { recursive: true, force: true });
  });
});
describe("security: Windows reserved names", () => {
  it("bloquea CON, PRN, AUX, NUL, COM1", () => {
    expect(() => resolvePortablePath("/tmp/root", "CON")).toThrow();
    expect(() => resolvePortablePath("/tmp/root", "CON.txt")).toThrow();
    expect(() => resolvePortablePath("/tmp/root", "aux")).toThrow();
    expect(() => resolvePortablePath("/tmp/root", "COM1")).toThrow();
    expect(() => resolvePortablePath("/tmp/root", "LPT1")).toThrow();
    expect(() => resolvePortablePath("/tmp/root", "nul")).toThrow();
  });
  it("bloquea site map con CON", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "sec-reserved-"));
    expect(() => resolvePortablePath(tmp, "CON")).toThrow();
    await rm(tmp, { recursive: true, force: true });
  });
});
describe("security: CSRF form without Origin", () => {
  it("bloquea shutdown via form sin Origin pero con cookie y Referer same-site distinto puerto", async () => {
    const root = await mkdtemp(join(tmpdir(), "sec-csrf-"));
    const handler = createSolaraRequestHandler({
      applicationRoot: root,
      shutdownToken: "tok123",
      origin: "http://127.0.0.1:4174",
      onShutdown: () => {},
    });
    // Form POST sin Origin, con Referer de atacante same-site (mismo host, distinto puerto)
    const res = await handler.handle({
      method: "POST",
      pathname: "/__solara/shutdown",
      headers: { cookie: "solara_shutdown=tok123", referer: "http://127.0.0.1:3000/evil.html" },
      body: null,
    });
    expect(res.status).toBe(403);
    await rm(root, { recursive: true, force: true });
  });
  it("bloquea storage POST sin Origin pero con Referer atacante", async () => {
    const root = await mkdtemp(join(tmpdir(), "sec-csrf2-"));
    const handler = createSolaraRequestHandler({
      applicationRoot: root,
      shutdownToken: "tok123",
      origin: "http://127.0.0.1:4174",
      onShutdown: () => {},
    });
    const res = await handler.handle({
      method: "POST",
      pathname: "/__solara/storage/saves",
      headers: {
        cookie: "solara_shutdown=tok123",
        referer: "http://127.0.0.1:3000/",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        projectId: "x",
        name: "x",
        slug: "x",
        projectUpdatedAt: new Date().toISOString(),
        expectedVersion: null,
      }),
    });
    expect(res.status).toBe(403);
    await rm(root, { recursive: true, force: true });
  });
});
describe("security: double encoding", () => {
  it("bloquea %252e%252e%252f (doble codificado) via safeStaticPath", async () => {
    const root = await mkdtemp(join(tmpdir(), "sec-double-"));
    await writeFile(join(root, "index.html"), "ok");
    expect(resolveStaticFile(root, "/%252e%252e/%252e%252e/etc/passwd")).toBeUndefined();
    await rm(root, { recursive: true, force: true });
  });
});
describe("security: safeUrl con whitespace", () => {
  it("bloquea javascript con prefijo whitespace y control chars", () => {
    expect(safeUrl("   javascript:alert(1)")).toBe("#");
    expect(safeUrl("\tjavascript:alert(1)")).toBe("#");
    expect(safeUrl("\njavascript:alert(1)")).toBe("#");
    expect(safeUrl("&#106;avascript:alert(1)")).toBe("#");
  });
});
