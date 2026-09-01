import { readdir, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { exportProject } from "../packages/exporter/src/index.ts";

async function reexportRoot(projectsRoot: string) {
  console.log(`\n=== ${projectsRoot} ===`);
  let entries;
  try {
    entries = await readdir(projectsRoot, { withFileTypes: true });
  } catch {
    console.log("No existe", projectsRoot);
    return;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const manifestPath = join(projectsRoot, e.name, "manifest.json");
    try {
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      const projectPath = join(projectsRoot, e.name, manifest.current.projectPath);
      const bytes = await readFile(projectPath, "utf8");
      const parsed = JSON.parse(bytes);
      const project = parsed.project ?? parsed;
      const result = exportProject(project, { mode: "production" as const });
      const siteDir = join(projectsRoot, e.name, "sitios", manifest.current.key);
      let written = 0;
      for (const [rel, content] of result.files) {
        if (rel.endsWith(".solara.json")) continue;
        if (!rel.endsWith(".css") && !rel.endsWith(".html") && !rel.startsWith("assets/")) continue;
        const dest = join(siteDir, rel);
        await mkdir(dirname(dest), { recursive: true });
        if (typeof content === "string") await writeFile(dest, content, "utf8");
        else await writeFile(dest, content);
        written++;
      }
      console.log(`- ${e.name} (${manifest.storeName}): ${written} CSS/HTML actualizados`);
      // Verificar que el CSS contiene el media query
      const cssFiles = [...result.files.keys()].filter((k) => k.endsWith(".css"));
      for (const cssPath of cssFiles) {
        const cssContent = result.files.get(cssPath);
        if (typeof cssContent === "string" && cssContent.includes("1920px") && cssContent.includes("1080px")) {
          console.log(`  ✓ CSS ${cssPath} contiene fix 1920x1080`);
        }
      }
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
main().catch((e) => { console.error(e); process.exit(1); });
