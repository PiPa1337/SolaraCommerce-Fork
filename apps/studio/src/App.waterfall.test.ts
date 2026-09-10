import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("App debe paralelizar getLocalStorageStatus y purgeRolledBackDemoRecords", async () => {
  const src = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
  // debe contener Promise.all para paralelizar los dos inicios
  expect(src).toContain("Promise.all");
  // no debe tener el patrón secuencial antiguo await purgePromise; const detectedStorage = await storagePromise
  // buscamos el patrón viejo exacto
  expect(src).not.toMatch(/await purgePromise;\s+const detectedStorage = await storagePromise/);
});

test("la splash conserva su timing normal y agrega tres segundos de margen", () => {
  const src = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

  expect(src).toContain("const APP_BOOT_SPLASH_EXTRA_MS = 3_000;");
  expect(src).toContain(
    "const splashExtraDuration = reducedMotion ? 0 : APP_BOOT_SPLASH_EXTRA_MS;",
  );
  expect(src).toContain("Math.max(0, fieldRevealDuration - elapsed) + splashExtraDuration");
});
