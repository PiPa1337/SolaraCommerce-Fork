import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { test } from "@playwright/test";

test.setTimeout(300_000);

const STUDIO_URL = "http://localhost:4173";

test("P1-L1: axe sobre el Studio (dashboard y pestañas del editor)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const findings: Array<{ area: string; impact: string; id: string; target: string }> = [];
  const check = async (area: string) => {
    // El iframe del preview embebe el sitio público (documento separado, con su
    // propio gate de axe en axe-site.spec.ts): sus landmarks no forman parte
    // del editor y no deben contaminar este análisis.
    const results = await new AxeBuilder({ page }).exclude("iframe").analyze();
    for (const violation of results.violations) {
      findings.push({
        area,
        impact: violation.impact ?? "unknown",
        id: violation.id,
        target: violation.nodes[0]?.target.join(" ") ?? "",
      });
    }
  };

  await page.goto(STUDIO_URL, { waitUntil: "load" });
  await page.getByRole("heading", { name: "Tus tiendas" }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await check("dashboard");

  await page
    .locator(".dashboard-store-card")
    .first()
    .locator(".dashboard-store-card__button")
    .dblclick();
  await page.locator(".studio-shell").waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await check("editor-guided");

  for (const tab of ["Resumen", "Catálogo", "Constructor", "Tema", "Recursos", "SEO", "Exportar"]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await page.waitForTimeout(1200);
    await check(`editor-${tab.toLowerCase()}`);
  }

  mkdirSync("test-results/qa-axe-app", { recursive: true });
  writeFileSync(
    resolve("test-results/qa-axe-app/findings.json"),
    `${JSON.stringify(findings, null, 2)}\n`,
    "utf8",
  );
  const counts = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.impact] = (acc[f.impact] ?? 0) + 1;
    return acc;
  }, {});
  const byArea = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.area] = (acc[f.area] ?? 0) + 1;
    return acc;
  }, {});
  console.log("P1-L1 axe:", JSON.stringify({ counts, byArea }));
  for (const f of findings.slice(0, 12)) console.log(" ", f.area, f.impact, f.id, f.target);
});
