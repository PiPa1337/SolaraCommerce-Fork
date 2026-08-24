import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createExportDestination, writeExportFiles } from "../src/export-site.mjs";

test("crea una carpeta hija fechada y no reutiliza una exportación existente", async () => {
  const parent = await mkdtemp(join(tmpdir(), "solara-export-parent-"));
  try {
    const now = new Date("2026-08-24T12:34:56");
    const first = await createExportDestination(parent, {
      storeSlug: "Mi tienda",
      mode: "production",
      now,
    });
    const second = await createExportDestination(parent, {
      storeSlug: "Mi tienda",
      mode: "production",
      now,
    });
    assert.match(first, /mi-tienda-production-20260824-123456$/);
    assert.match(second, /mi-tienda-production-20260824-123456-2$/);
    assert.notEqual(first, second);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("escribe HTML, carpetas y binarios del sitio exportado", async () => {
  const root = await mkdtemp(join(tmpdir(), "solara-export-site-"));
  try {
    const result = await writeExportFiles(root, [
      { path: "index.html", data: "<h1>Solara</h1>" },
      { path: "assets/campaign.mp4", data: new Uint8Array([0, 1, 2, 255]) },
    ]);

    assert.equal(result.filesWritten, 2);
    assert.equal(await readFile(join(root, "index.html"), "utf8"), "<h1>Solara</h1>");
    assert.deepEqual([...(await readFile(join(root, "assets/campaign.mp4")))], [0, 1, 2, 255]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rechaza rutas que intentan salir de la carpeta seleccionada", async () => {
  const root = await mkdtemp(join(tmpdir(), "solara-export-path-"));
  try {
    await assert.rejects(
      writeExportFiles(root, [{ path: "../fuera.txt", data: "no" }]),
      /ruta insegura|salir/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
