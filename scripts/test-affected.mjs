import { execSync, spawn } from "node:child_process";

// test-affected.mjs — ejecuta solo tests de paquetes afectados por git diff
// Uso: node scripts/test-affected.mjs [--base=origin/main] [--all]
// - Sin git o con --all, corre "pnpm -r --parallel test" (todos)
// - Con cambios, mapea archivos a paquetes y corre solo esos via "pnpm --filter"
// Reutiliza artefactos deterministas y evita trabajo redundante.
const args = process.argv.slice(2);
const shouldRunAll = args.includes("--all") || args.includes("--full");
let baseRef = "origin/main";
for (const a of args) {
  if (a.startsWith("--base=")) baseRef = a.slice(7);
}
function getChangedFiles() {
  if (shouldRunAll) return null;
  try {
    // Intentar con baseRef, si falla usar HEAD
    let out = "";
    try {
      out = execSync(`git diff --name-only ${baseRef}...HEAD`, { encoding: "utf8", stdio: "pipe" });
    } catch {
      out = execSync("git diff --name-only HEAD", { encoding: "utf8", stdio: "pipe" });
    }
    const files = out
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    // También incluir unstaged/staged
    try {
      const unstaged = execSync("git diff --name-only", { encoding: "utf8", stdio: "pipe" });
      files.push(
        ...unstaged
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    } catch {}
    try {
      const staged = execSync("git diff --name-only --cached", { encoding: "utf8", stdio: "pipe" });
      files.push(
        ...staged
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    } catch {}
    return [...new Set(files)];
  } catch {
    return null;
  }
}
function mapFilesToPackages(files) {
  if (!files || files.length === 0) return null;
  // Si tocan root config, correr todo
  const rootTouched = files.some(
    (f) =>
      f === "package.json" ||
      f === "pnpm-workspace.yaml" ||
      f === "tsconfig.base.json" ||
      f.startsWith("scripts/"),
  );
  if (rootTouched) return null;
  const pkgs = new Set();
  for (const f of files) {
    if (f.startsWith("packages/project-schema/")) pkgs.add("@solara/project-schema");
    else if (f.startsWith("packages/core/")) pkgs.add("@solara/core");
    else if (f.startsWith("packages/module-sdk/")) pkgs.add("@solara/module-sdk");
    else if (f.startsWith("packages/modules/")) pkgs.add("@solara/modules");
    else if (f.startsWith("packages/exporter/")) pkgs.add("@solara/exporter");
    else if (f.startsWith("packages/storefront-runtime/")) pkgs.add("@solara/storefront-runtime");
    else if (f.startsWith("packages/site-optimizer/")) pkgs.add("@solara/site-optimizer");
    else if (f.startsWith("apps/studio/")) pkgs.add("@solara/studio");
    else if (f.startsWith("apps/desktop/")) pkgs.add("@solara/desktop");
    else if (f.startsWith("tests/")) return null; // tests tocan muchos paquetes
  }
  if (pkgs.size === 0) return null;
  // Si muchos paquetes afectados (>4), correr todo es más rápido que filtrar
  if (pkgs.size > 4) return null;
  return [...pkgs];
}
const changed = getChangedFiles();
const pkgs = mapFilesToPackages(changed);
let cmd, cmdArgs;
if (!pkgs) {
  console.log("[affected] Cambios amplios o sin git → pnpm -r --parallel test (todos)");
  cmd = "corepack";
  cmdArgs = ["pnpm", "-r", "--parallel", "--if-present", "test"];
} else {
  console.log(`[affected] Paquetes afectados: ${pkgs.join(", ")} → pnpm --filter ... test`);
  // Construir pnpm --filter args: "pnpm --filter pkg1 --filter pkg2 test"
  cmd = "corepack";
  cmdArgs = ["pnpm"];
  for (const p of pkgs) cmdArgs.push("--filter", p);
  cmdArgs.push("test");
}
const child = spawn(cmd, cmdArgs, { shell: true, stdio: "inherit" });
child.on("close", (code) => process.exit(code ?? 1));
child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});
