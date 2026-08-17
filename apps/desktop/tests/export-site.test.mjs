import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { writeExportFiles } from "../src/export-site.mjs";

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
