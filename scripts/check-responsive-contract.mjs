import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const officialWidths = new Set([767, 768, 1199, 1200]);
const scannedFiles = [
  {
    path: "packages/modules/src/styles.ts",
    allowed: new Set([...officialWidths, 339, 599, 600]),
    label: "layout compartido",
  },
  {
    path: "packages/storefront-runtime/src/index.ts",
    allowed: new Set([...officialWidths, 520]),
    label: "runtime público",
  },
  {
    path: "packages/module-sdk/src/index.ts",
    allowed: new Set([1023]),
    label: "entrega de imágenes del module-sdk",
  },
  {
    path: "packages/exporter/src/index.ts",
    allowed: new Set([...officialWidths, 1023, 1024]),
    label: "renderer/exporter y preload de imágenes",
  },
];

const widthPattern = /(?:min|max)-width\s*:\s*(\d+)px/g;

function lineNumber(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function inspectFile(file) {
  const source = readFileSync(resolve(file.path), "utf8");
  const issues = [];
  const conditions = [];
  for (const match of source.matchAll(/@media\s*([^\{]+)\{/g)) {
    for (const widthMatch of match[1].matchAll(widthPattern)) {
      conditions.push({ widthMatch, offset: (match.index ?? 0) + (widthMatch.index ?? 0) });
    }
  }
  for (const match of source.matchAll(/matchMedia\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    for (const widthMatch of match[1].matchAll(widthPattern)) {
      conditions.push({ widthMatch, offset: (match.index ?? 0) + (widthMatch.index ?? 0) });
    }
  }
  for (const match of source.matchAll(/media="([^"]+)"/g)) {
    for (const widthMatch of match[1].matchAll(widthPattern)) {
      conditions.push({ widthMatch, offset: (match.index ?? 0) + (widthMatch.index ?? 0) });
    }
  }
  for (const match of source.matchAll(/PICTURE_[A-Z_]+_MEDIA\s*=\s*["'`]([^"'`]+)["'`]/g)) {
    for (const widthMatch of match[1].matchAll(widthPattern)) {
      conditions.push({ widthMatch, offset: (match.index ?? 0) + (widthMatch.index ?? 0) });
    }
  }
  for (const { widthMatch, offset } of conditions) {
    const width = Number(widthMatch[1]);
    if (file.allowed.has(width)) continue;
    issues.push(
      `${file.path}:${lineNumber(source, offset)} usa ${width}px en ${file.label}; ` +
        "agregalo al ledger sólo con motivo técnico y prueba de frontera, o reemplazalo por el contrato oficial.",
    );
  }
  return issues;
}

const issues = scannedFiles.flatMap(inspectFile);
if (issues.length > 0) {
  console.error("El contrato responsive encontró width breakpoints no clasificados:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log(
    "Contrato responsive verificado: Mobile 320–767, Tablet 768–1199, Desktop ≥1200; excepciones técnicas clasificadas.",
  );
}
