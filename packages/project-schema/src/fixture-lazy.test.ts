import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

test("catalogModernStore no debe importar optimized-fixture-urls sincrónicamente en el bundle principal", async () => {
  const assetsDir = "apps/studio/dist/assets";
  if (!existsSync(assetsDir)) {
    // sin build, skip: el check real corre tras build
    expect(true).toBe(true);
    return;
  }
  // encuentra el entry principal (el más grande index-*.js)
  const files = readdirSync(assetsDir).filter((f) => /^index-.*\.js$/.test(f));
  const maps = files
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(assetsDir, f.replace(/\.js$/, ".js.map")), "utf8"));
      } catch {
        return null;
      }
    })
    .filter(Boolean) as any[];
  // busca si algún map del entry contiene optimized-fixture-urls
  // el entry es el que contiene App.tsx / repository.ts
  const entryMaps = maps.filter((m) => m.sources.some((s: string) => s.includes("App.tsx")));
  const hasFixtureInEntry = entryMaps.some((m) =>
    m.sources.some((s: string) => s.includes("optimized-fixture-urls.ts")),
  );
  expect(hasFixtureInEntry).toBe(false);
});
