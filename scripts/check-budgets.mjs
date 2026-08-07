import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const assetsDirectory = new URL("../apps/studio/dist/assets/", import.meta.url);
const directoryPath = fileURLToPath(assetsDirectory);

if (!existsSync(directoryPath)) {
  console.error("No existe apps/studio/dist. Ejecutá pnpm build antes de revisar budgets.");
  process.exit(1);
}

const files = readdirSync(directoryPath);
const javascriptCandidates = files.filter((file) => /^index-[^./]+\.js$/.test(file));
const stylesheet = files.find((file) => /^index-[^./]+\.css$/.test(file));
if (javascriptCandidates.length === 0 || !stylesheet) {
  console.error("No se encontraron los bundles iniciales de Studio.");
  process.exit(1);
}

// Vite puede separar Preview/SEO en chunks `index-*`; el entry inicial es el
// mayor de esos chunks y no debe elegirse por el orden del sistema de archivos.
const javascript = javascriptCandidates.reduce((largest, file) =>
  readFileSync(new URL(`./${file}`, assetsDirectory)).byteLength >
  readFileSync(new URL(`./${largest}`, assetsDirectory)).byteLength
    ? file
    : largest,
);

// Topes en bytes crudos (sin compresión), fijados con margen sobre la medición
// de la Task 6 (Step 1): JS inicial 589.731 B, CSS inicial 68.769 B. Un servidor
// web puede comprimir; estos topes bloquean crecimientos accidentales del bundle
// de Studio.
const checks = [
  {
    label: "Studio JavaScript inicial crudo",
    file: javascript,
    limit: 700 * 1024,
  },
  {
    label: "Studio CSS inicial crudo",
    file: stylesheet,
    limit: 84 * 1024,
  },
];

let failed = false;
for (const check of checks) {
  const bytes = readFileSync(new URL(`./${check.file}`, assetsDirectory)).byteLength;
  const status = bytes <= check.limit ? "OK" : "EXCEDE";
  console.log(`${status} ${check.label}: ${bytes} B / ${check.limit} B`);
  if (bytes > check.limit) failed = true;
}

if (failed) process.exit(1);
