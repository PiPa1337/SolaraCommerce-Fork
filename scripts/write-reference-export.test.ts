import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { expect, test } from "vitest";
import { createProjectArchive } from "../apps/studio/src/lib/projectArchive";
import { exportProject } from "../packages/exporter/src/index";
import { referenceStore } from "../packages/project-schema/src/fixture";

const root = resolve(import.meta.dirname, "..");
const outputDirectory = resolve(root, ".release/reference-site");

test("escribe el sitio de referencia para auditorías de release", () => {
  rmSync(outputDirectory, { recursive: true, force: true });
  const exported = exportProject(referenceStore, { mode: "production" });
  writeFileSync(resolve(root, ".release/site.zip"), exported.zip);
  writeFileSync(
    resolve(root, ".release/reference.solara.zip"),
    createProjectArchive(referenceStore),
  );
  for (const [path, content] of exported.files) {
    const destination = resolve(outputDirectory, path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, content);
  }

  for (const fixture of ["casa-luma-hero.png", "manta-bruma.png", "jarra-delta.png"]) {
    const destination = resolve(outputDirectory, "fixtures", fixture);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, readFileSync(resolve(root, "apps/studio/public/fixtures", fixture)));
  }

  expect(exported.files.has("index.html")).toBe(true);
  expect(exported.files.has("productos/manta-bruma/index.html")).toBe(true);
});
