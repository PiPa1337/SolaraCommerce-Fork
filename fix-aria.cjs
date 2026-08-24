const fs = require("node:fs");
const p = "packages/modules/src/definitions.ts";
let s = fs.readFileSync(p, "utf8");
s = s.replace(
  'aria-label="Slides del hero"',
  `aria-label="\${escapeAttribute(copy.accessibility.heroSlides)}"`,
);
fs.writeFileSync(p, s);
console.log("done");
