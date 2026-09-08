import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const assetsDirectory = fileURLToPath(new URL("../apps/studio/dist/assets/", import.meta.url));
const stylesheets = readdirSync(assetsDirectory).filter((file) => /^index-[^./]+\.css$/.test(file));
if (stylesheets.length === 0) {
  console.error("No se encontró el CSS inicial de Studio.");
  process.exit(1);
}

let removed = 0;
// The leaf-rule regex also matches `from`/`to` blocks inside keyframes;
// protect those animation programs before deduplicating ordinary CSS rules.
const keyframeBlockPattern = /@(?:-webkit-)?keyframes[^{]+\{(?:[^{}]|\{[^{}]*\})*\}/g;

for (const stylesheet of stylesheets) {
  const path = `${assetsDirectory}${stylesheet}`;
  const css = readFileSync(path, "utf8");
  const seen = new Set();
  const keyframes = [];
  const protectedCss = css.replace(keyframeBlockPattern, (block) => {
    const token = `__solara_keyframes_${keyframes.length}__`;
    keyframes.push(block);
    return token;
  });
  const dedupedRules = protectedCss.replace(/[^{}]+\{[^{}]*\}/g, (rule) => {
    const key = rule;
    if (seen.has(key)) {
      removed += 1;
      return "";
    }
    seen.add(key);
    return rule;
  });
  const deduped = dedupedRules.replace(
    /__solara_keyframes_(\d+)__/g,
    (_token, index) => keyframes[Number(index)],
  );
  if (deduped !== css) writeFileSync(path, deduped, "utf8");
}
console.log(`Dedup CSS Studio: ${removed} reglas duplicadas exactas eliminadas.`);
