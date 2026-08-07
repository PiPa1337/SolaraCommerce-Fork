import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createLocalProjectStorage } from "../../../packages/exporter/scripts/local-project-storage.mjs";
import {
  ensurePortableLayout,
  resolvePortableLayout,
  resolvePortablePath,
} from "../../../packages/exporter/scripts/portable-layout.mjs";
import { createSolaraRequestHandler } from "../../../packages/exporter/scripts/solara-request-handler.mjs";

async function temporaryRoot(name) {
  return mkdtemp(join(tmpdir(), `${name}-`));
}

test("el layout empaquetado permanece junto al ejecutable en rutas movibles", async () => {
  const root = await temporaryRoot("Solara Portable á");
  try {
    const executable = join(root, "carpeta con espacios", "SolaraCommerce.exe");
    const layout = resolvePortableLayout({ mode: "packaged", executablePath: executable });
    assert.equal(layout.portableRoot, join(root, "carpeta con espacios"));
    assert.equal(layout.projectsRoot, join(layout.portableRoot, "proyectos"));
    await ensurePortableLayout(layout, { appVersion: "test" });
    const instance = JSON.parse(await readFile(join(layout.runtimeRoot, "instance.json"), "utf8"));
    assert.deepEqual(instance, {
      format: "solara-portable-instance",
      version: 1,
      appVersion: "test",
      layoutVersion: 1,
    });
    assert.equal(
      resolvePortablePath(layout.portableRoot, "proyectos/demo"),
      join(layout.projectsRoot, "demo"),
    );
    assert.throws(() => resolvePortablePath(layout.portableRoot, "C:/otra-carpeta"));
    assert.throws(() => resolvePortablePath(layout.portableRoot, "../fuera"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("HTTP y solara comparten sesión, archivos y autorización", async () => {
  const root = await temporaryRoot("Solara Handler");
  try {
    const layout = resolvePortableLayout({ cwd: root });
    await ensurePortableLayout(layout);
    const staticRoot = join(root, "studio");
    await mkdir(staticRoot, { recursive: true });
    await writeFile(join(staticRoot, "index.html"), "<title>portable</title>", "utf8");
    const handler = createSolaraRequestHandler({
      staticRoot,
      applicationRoot: root,
      managed: true,
      origin: "http://127.0.0.1:4100",
      protocolOrigin: "solara://studio",
      allowProtocolOrigin: true,
    });
    const httpSession = await handler.handle({
      method: "GET",
      pathname: "/__solara/session",
      headers: { origin: "http://127.0.0.1:4100" },
    });
    const protocolSession = await handler.handle({
      method: "GET",
      pathname: "/__solara/session",
      headers: { origin: "solara://studio" },
    });
    assert.equal(httpSession.status, 200);
    assert.deepEqual(
      JSON.parse(String(httpSession.body)),
      JSON.parse(String(protocolSession.body)),
    );
    const httpStatic = await handler.handle({
      method: "GET",
      pathname: "/",
      headers: { origin: "http://127.0.0.1:4100" },
    });
    const protocolStatic = await handler.handle({
      method: "GET",
      pathname: "/",
      headers: { origin: "solara://studio" },
    });
    assert.equal(httpStatic.status, 200);
    assert.equal(
      Buffer.from(httpStatic.body).toString(),
      Buffer.from(protocolStatic.body).toString(),
    );
    const denied = await handler.handle({
      method: "GET",
      pathname: "/__solara/storage/status",
      headers: { origin: "http://evil.invalid" },
    });
    assert.equal(denied.status, 403);
    await handler.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("un manifest V1 no migrable se reporta como recuperación", async () => {
  const root = await temporaryRoot("Solara Manifest");
  try {
    // El archivePath absoluto es incidental: la migración legacy descarta este
    // manifest V1 antes de tocar la ruta, por lo que el motivo real de la
    // recuperación es la incompatibilidad del manifest.
    const projectRoot = join(root, "proyectos", "demo--12345678");
    await mkdir(projectRoot, { recursive: true });
    await writeFile(
      join(projectRoot, "manifest.json"),
      JSON.stringify({
        format: "solara-local-project",
        manifestVersion: 1,
        projectId: "demo123",
        storeName: "Demo",
        slug: "demo",
        schemaVersion: 2,
        status: "synced",
        current: {
          version: 1,
          key: "demo-v1",
          archivePath: "C:/fuera/project.solara",
          sha256: "0",
          savedAt: new Date().toISOString(),
          projectUpdatedAt: new Date().toISOString(),
        },
      }),
      "utf8",
    );
    const storage = createLocalProjectStorage({ applicationRoot: root });
    const listing = await storage.list();
    assert.equal(listing.projects.length, 0);
    assert.equal(listing.recovery.length, 1);
    assert.match(listing.recovery[0].message, /incompatible/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
