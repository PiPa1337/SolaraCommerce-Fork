import { readdir, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { exportProject } from "@solara/exporter";
import { createHash } from "node:crypto";

async function reexportRoot(projectsRoot: string) {
  console.log(`\n=== ${projectsRoot} ===`);
  const entries = await readdir(projectsRoot, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const manifestPath = join(projectsRoot, e.name, "manifest.json");
    try {
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      const projectPath = join(projectsRoot, e.name, manifest.current.projectPath);
      const bytes = await readFile(projectPath, "utf8");
      const project = JSON.parse(bytes).project ?? JSON.parse(bytes);
      const result = exportProject(project, { mode: "production" as const });
      // Escribir sitio en sitios/<key>
      const siteDir = join(projectsRoot, e.name, "sitios", manifest.current.key);
      // El sitio ya existe, lo regeneramos sobrescribiendo archivos clave (css)
      // Para simplificar, escribimos todos los archivos del result que no sean solara.json
      let written = 0;
      for (const [rel, content] of result.files) {
        if (rel.endsWith(".solara.json")) continue;
        // Solo sobrescribir si es css o html para aplicar el hero fix (más rápido)
        if (!rel.endsWith(".css") && !rel.endsWith(".html") && !rel.startsWith("assets/")) continue;
        const dest = join(siteDir, rel);
        await mkdir(join(dest, ".."), { recursive: true });
        if (typeof content === "string") await writeFile(dest, content, "utf8");
        else await writeFile(dest, content);
        written++;
      }
      // Actualizar el css del storefront que está en assets/storefront.*.css
      console.log(`- ${e.name} (${manifest.storeName}): ${written} archivos CSS/HTML actualizados`);
    } catch (err) {
      console.error(`  !! ${e.name}:`, (err as Error).message);
    }
  }
}

async function main() {
  await reexportRoot(resolve("proyectos"));
  await reexportRoot(resolve(".release/portable/SolaraCommerce-Portable/proyectos"));
  console.log("Done hero re-export");
}
void main();
