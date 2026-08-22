/**
 * Guard de imagenes: los fixtures PNG grandes estan prohibidos. Toda imagen
 * de demo debe estar en WebP optimizado (ver docs/UI_SCALE.md). Los unicos
 * PNG permitidos son los iconos de branding en public/branding/.
 */
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const fixturesDir = resolve("apps/studio/public/fixtures");
const MAX_BYTES = 200 * 1024;
const issues = [];

for (const file of readdirSync(fixturesDir)) {
  if (!file.endsWith(".png")) continue;
  const size = statSync(join(fixturesDir, file)).size;
  if (size > MAX_BYTES) {
    issues.push(
      `${file}: ${Math.round(size / 1024)}KB supera el limite de ${MAX_BYTES / 1024}KB. Converti a WebP responsive (ver docs/UI_SCALE.md).`,
    );
  }
}

if (issues.length > 0) {
  console.error("Fixtures sin optimizar detectadas:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log("Fixtures optimizadas OK.");
}
