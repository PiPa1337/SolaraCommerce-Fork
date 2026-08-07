/**
 * Prepara el bundle Electron. Studio se copia dentro del mismo app.asar para
 * que la carpeta portable no dependa del checkout original ni de una URL HTTP.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(desktopRoot, "../..");
const studioIndex = resolve(repositoryRoot, "apps/studio/dist/index.html");

if (!existsSync(studioIndex)) {
  const command = process.platform === "win32" ? "corepack.cmd" : "corepack";
  const result = spawnSync(command, ["pnpm", "--filter", "@solara/studio", "build"], {
    cwd: repositoryRoot,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const output = resolve(desktopRoot, "dist");
const viteEntry = resolve(desktopRoot, "node_modules/vite/bin/vite.js");
const result = spawnSync(
  process.execPath,
  [viteEntry, "build", "--configLoader", "runner", "--config", "vite.config.mjs"],
  {
    cwd: desktopRoot,
    stdio: "inherit",
  },
);
if (result.status !== 0) process.exit(result.status ?? 1);
await rm(resolve(output, "studio"), { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(repositoryRoot, "apps/studio/dist"), resolve(output, "studio"), {
  recursive: true,
});
