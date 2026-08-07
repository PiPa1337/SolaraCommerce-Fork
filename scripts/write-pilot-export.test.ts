import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { expect, test } from "vitest";
import { readProjectArchive } from "../apps/studio/src/lib/projectArchive";
import { exportProject } from "../packages/exporter/src/index";

const root = resolve(import.meta.dirname, "..");
const outputRoot = resolve(root, ".release");
const outputDirectory = resolve(outputRoot, "pilot-site");

test("exporta production desde el respaldo elegido para el piloto", () => {
  const archivePath = process.env.SOLARA_PILOT_PROJECT_ARCHIVE;
  if (!archivePath) {
    throw new Error(
      "Definí SOLARA_PILOT_PROJECT_ARCHIVE con la ruta a un respaldo .solara.zip antes de exportar el piloto.",
    );
  }

  const source = resolve(archivePath);
  if (!existsSync(source)) {
    throw new Error(`No existe el respaldo del piloto: ${source}`);
  }

  const project = readProjectArchive(new Uint8Array(readFileSync(source)));
  const exported = exportProject(project, { mode: "production" });
  const repeated = exportProject(project, { mode: "production" });
  expect(repeated.files).toEqual(exported.files);

  mkdirSync(outputRoot, { recursive: true });
  rmSync(outputDirectory, { recursive: true, force: true });

  for (const [path, content] of exported.files) {
    const destination = resolve(outputDirectory, path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, content);
  }

  expect(exported.files.has("index.html")).toBe(true);
  expect(exported.files.has("sitemap.xml")).toBe(true);
  expect(exported.files.has("google-merchant.xml")).toBe(true);
  console.log({ source, output: outputDirectory, files: exported.files.size });
});
