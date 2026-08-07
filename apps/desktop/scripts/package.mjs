/** Ejecuta electron-builder usando cachés dentro del workspace portable. */

import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(desktopRoot, "../..");
const builderEntry = resolve(desktopRoot, "node_modules/electron-builder/out/cli/cli.js");
const cacheRoot = resolve(repositoryRoot, ".release/electron-builder-cache");
await mkdir(cacheRoot, { recursive: true });

const result = spawnSync(
  process.execPath,
  [builderEntry, "--config", "electron-builder.yml", "--win", "dir"],
  {
    cwd: desktopRoot,
    env: {
      ...process.env,
      ELECTRON_BUILDER_CACHE: cacheRoot,
    },
    stdio: "inherit",
  },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
