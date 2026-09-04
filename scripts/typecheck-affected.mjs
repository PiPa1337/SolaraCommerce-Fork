import { execSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { mapFilesToPackages } from "./test-affected-map.mjs";

// typecheck-affected.mjs — typecheck solo de paquetes afectados por git diff.
// Comparte el mapeo con test-affected.mjs (ver test-affected-map.mjs).
// Por defecto compara el worktree contra HEAD (cambios sin commitear).
const args = process.argv.slice(2);
const shouldRunAll = args.includes("--all") || args.includes("--full");
let baseRef = "HEAD";
for (const a of args) {
  if (a.startsWith("--base=")) baseRef = a.slice(7);
}

function getChangedFiles() {
  if (shouldRunAll) return null;
  try {
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

const pkgs = mapFilesToPackages(getChangedFiles());

function spawnCorepack(cmdArgs) {
  const executable = process.platform === "win32" ? process.execPath : "corepack";
  const finalArgs =
    process.platform === "win32"
      ? [
          resolve(process.execPath, "..", "node_modules", "corepack", "dist", "corepack.js"),
          ...cmdArgs,
        ]
      : cmdArgs;
  const cmd = process.platform === "win32" ? executable : "corepack";
  return spawnSync(cmd, finalArgs, { stdio: "inherit" });
}

if (!pkgs) {
  console.log("[typecheck:affected] Cambios amplios → typecheck con concurrencia acotada (todos)");
  const r = spawnCorepack(["pnpm", "-r", "--workspace-concurrency=2", "--if-present", "typecheck"]);
  process.exit(r.status ?? 1);
}
if (pkgs.length === 0) {
  console.log("[typecheck:affected] Solo infra/docs → sin typecheck de paquete (verde)");
  process.exit(0);
}
console.log(`[typecheck:affected] Paquetes: ${pkgs.join(", ")}`);
const cmdArgs = ["pnpm"];
for (const p of pkgs) cmdArgs.push("--filter", p);
cmdArgs.push("typecheck");
const r = spawnCorepack(cmdArgs);
process.exit(r.status ?? 1);
