import { execSync, spawn } from "node:child_process";
import { resolve } from "node:path";
import { mapFilesToPackages } from "./test-affected-map.mjs";

// test-affected.mjs — ejecuta solo tests de paquetes afectados por git diff
// Uso: node scripts/test-affected.mjs [--base=origin/main] [--all]
// - Por defecto compara el worktree contra HEAD (cambios sin commitear).
//   Con --base=X compara además X...HEAD (útil en CI contra la rama base).
// - Sin git o con --all, corre tests con concurrencia acotada (todos)
// - Con cambios, mapea archivos a paquetes (ver test-affected-map.mjs) y corre
//   solo esos via "pnpm --filter". Con [] (solo infra/docs) no corre tests de
//   paquete: sale verde sin trabajo pesado.
// Reutiliza artefactos deterministas y evita trabajo redundante.
const args = process.argv.slice(2);
const shouldRunAll = args.includes("--all") || args.includes("--full");
let baseRef = "HEAD";
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
const changed = getChangedFiles();
const pkgs = mapFilesToPackages(changed);
let cmd, cmdArgs;
if (!pkgs) {
  console.log("[affected] Cambios amplios o sin git → pnpm -r con concurrencia acotada (todos)");
  cmd = "corepack";
  cmdArgs = ["pnpm", "-r", "--workspace-concurrency=2", "--if-present", "test"];
} else if (pkgs.length === 0) {
  console.log("[affected] Solo infra/docs → sin tests de paquete (verde)");
  process.exit(0);
} else {
  console.log(`[affected] Paquetes afectados: ${pkgs.join(", ")} → pnpm --filter ... test`);
  // Construir pnpm --filter args: "pnpm --filter pkg1 --filter pkg2 test"
  cmd = "corepack";
  cmdArgs = ["pnpm"];
  for (const p of pkgs) cmdArgs.push("--filter", p);
  cmdArgs.push("test");
}
const executable = process.platform === "win32" && cmd === "corepack" ? process.execPath : cmd;
const finalArgs =
  process.platform === "win32" && cmd === "corepack"
    ? [
        resolve(process.execPath, "..", "node_modules", "corepack", "dist", "corepack.js"),
        ...cmdArgs,
      ]
    : cmdArgs;
const child = spawn(executable, finalArgs, { stdio: "inherit" });
child.on("close", (code) => process.exit(code ?? 1));
child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});
