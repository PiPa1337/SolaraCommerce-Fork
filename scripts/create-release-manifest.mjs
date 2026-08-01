import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
let sourceCommit = "unknown";
try {
  sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
} catch {
  // El manifiesto también puede generarse desde un artefacto sin .git.
}

const manifest = {
  format: "solara-release",
  version: 1,
  appVersion: packageJson.version,
  schemaVersion: 1,
  sourceCommit,
  node: process.version,
  packageManager: packageJson.packageManager,
  artifacts: ["apps/studio/dist", ".release/site.zip"],
};

const output = resolve(root, ".release/release-manifest.json");
mkdirSync(resolve(root, ".release"), { recursive: true });
writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Manifiesto de release escrito en ${output}`);
