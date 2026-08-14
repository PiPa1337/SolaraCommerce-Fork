import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const assetsDirectory = fileURLToPath(new URL("../apps/studio/dist/assets/", import.meta.url));
const stylesheets = readdirSync(assetsDirectory).filter((file) => /^index-[^./]+\.css$/.test(file));
if (stylesheets.length === 0) {
  console.error("No se encontró el CSS inicial de Studio.");
  process.exit(1);
}

let removed = 0;
for (const stylesheet of stylesheets) {
  const path = `${assetsDirectory}${stylesheet}`;
  const css = readFileSync(path, "utf8");
  const seen = new Set();
  const deduped = css.replace(/[^{}]+\{[^{}]*\}/g, (rule) => {
    const key = rule;
    if (seen.has(key)) {
      removed += 1;
      return "";
    }
    seen.add(key);
    return rule;
  });
  if (deduped !== css) writeFileSync(path, deduped, "utf8");
}
console.log(`Dedup CSS Studio: ${removed} reglas duplicadas exactas eliminadas.`);
