import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createLocalProjectStorage } from "../scripts/local-project-storage.mjs";
import { assertNoReparsePoints } from "../scripts/portable-layout.mjs";

const execFileAsync = promisify(execFile);

describe.runIf(process.platform === "win32")("reparse points en Windows", () => {
  it("rechaza un junction dentro de proyectos/", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-reparse-"));
    try {
      const outside = join(root, "afuera");
      const projects = join(root, "proyectos");
      const escaped = join(projects, "escapada");
      await mkdir(outside, { recursive: true });
      await mkdir(projects, { recursive: true });
      try {
        await execFileAsync("cmd", ["/c", "mklink", "/J", escaped, outside]);
      } catch {
        return; // el entorno no permite crear junctions; no es un fallo del servicio.
      }
      const storage = createLocalProjectStorage({ applicationRoot: root });
      const listing = await storage.list();
      expect(listing.projects).toHaveLength(0);
      expect(listing.recovery).toHaveLength(0);
      // `list()`/`findManifest` saltan las entradas que no son directorios: un
      // junction no se descubre y no admite escrituras (las escrituras fluyen
      // sólo por manifests descubiertos). `assertNoReparsePoints` directo sí lo
      // rechaza. Si se cambia este comportamiento, romper intencionalmente este
      // test y actualizar la fila P1 de docs/TECHNICAL_DEBT.md.
      await expect(assertNoReparsePoints(projects, escaped)).rejects.toThrow(/enlace simbólico/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe.runIf(process.platform !== "win32")("symlinks en POSIX", () => {
  it("rechaza un symlink dentro de proyectos/", async () => {
    const root = await mkdtemp(join(tmpdir(), "solara-reparse-"));
    try {
      const outside = join(root, "afuera");
      const projects = join(root, "proyectos");
      const escaped = join(projects, "escapada");
      await mkdir(outside, { recursive: true });
      await mkdir(projects, { recursive: true });
      await symlink(outside, escaped, "dir");
      const storage = createLocalProjectStorage({ applicationRoot: root });
      const listing = await storage.list();
      expect(listing.projects).toHaveLength(0);
      expect(listing.recovery).toHaveLength(0);
      await expect(assertNoReparsePoints(projects, escaped)).rejects.toThrow(/enlace simbólico/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
