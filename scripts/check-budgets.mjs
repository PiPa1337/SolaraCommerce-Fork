import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const assetsDirectory = new URL("../apps/studio/dist/assets/", import.meta.url);
const directoryPath = fileURLToPath(assetsDirectory);

if (!existsSync(directoryPath)) {
  console.error("No existe apps/studio/dist. Ejecutá pnpm build antes de revisar budgets.");
  process.exit(1);
}

const files = readdirSync(directoryPath);
const javascript = files.find((file) => /^index-[^./]+\.js$/.test(file));
const stylesheet = files.find((file) => /^index-[^./]+\.css$/.test(file));
if (!javascript || !stylesheet) {
  console.error("No se encontraron los bundles iniciales de Studio.");
  process.exit(1);
}

const checks = [
  {
    label: "Studio JavaScript inicial gzip",
    file: javascript,
    limit: 260 * 1024,
  },
  {
    label: "Studio CSS inicial gzip",
    file: stylesheet,
    limit: 100 * 1024,
  },
];

let failed = false;
for (const check of checks) {
  const bytes = gzipSync(readFileSync(new URL(`./${check.file}`, assetsDirectory))).byteLength;
  const status = bytes <= check.limit ? "OK" : "EXCEDE";
  console.log(`${status} ${check.label}: ${bytes} B / ${check.limit} B`);
  if (bytes > check.limit) failed = true;
}

if (failed) process.exit(1);
