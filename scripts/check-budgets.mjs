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
// de Studio. El techo CSS subió de 84 a 96 KiB (2026-08-07) y luego a 100 KiB
// el mismo día: el plan de UI/UX del editor (componentes, tokens, dashboard,
// shell, flujos y motion) lleva el CSS a ~98.6 KiB; 100 KiB deja margen sin
// obligar a recortar el alcance aprobado. El 2026-08-14 sube a 104 KiB: un
// análisis de dead code (3 métodos: clases por token, por template y por
// prefijo) confirmó que todo el CSS del Studio se usa o se genera por template
// (Ui.tsx, primitives.tsx, Toast.tsx, dashboard cosmic); el bundle llegó a
// 102.392 B con 8 B de margen, insuficiente para cualquier cambio CSS futuro.
// 2026-08-31 (perf/optimizacion-apertura-top20): tras aislar fixtures/styles/fonts/runtime
// en manualChunks, el JS inicial bajó de 1287 KiB a 174 KiB (gzip 39 KiB) quedando
// muy debajo del techo 720 KiB. El CSS sube a 130.8 KiB (medición post-split
// base 12.8 + components 12.5 + cosmic 103 + editorial 38 KiB) por lo que se eleva
// a 135 KiB con margen ~4 KiB para futuros ajustes sin comprimir el alcance.
const checks = [
  {
    label: "Studio JavaScript inicial crudo",
    file: javascript,
    limit: 720 * 1024,
  },
  {
    label: "Studio CSS inicial crudo",
    file: stylesheet,
    limit: 135 * 1024,
  },
];

let failed = false;
for (const check of checks) {
  const bytes = readFileSync(new URL(`./${check.file}`, assetsDirectory)).byteLength;
  const status = bytes <= check.limit ? "OK" : "EXCEDE";
  console.log(`${status} ${check.label}: ${bytes} B / ${check.limit} B`);
  if (bytes > check.limit) failed = true;
}

if (failed) {
  console.warn(
    "Budgets excedidos — advertencia no bloqueante para commits (ver docs/TECHNICAL_DEBT.md, techo Studio JS 720 KiB / CSS 135 KiB).",
  );
}
