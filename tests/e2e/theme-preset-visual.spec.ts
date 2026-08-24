import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { applyPreset, THEME_PRESETS } from "@solara/project-schema";
import { referenceStore } from "@solara/project-schema/fixture";
import { FIXTURE_PRODUCT_FILES } from "./fixture-server";

const resultsDir = resolve("test-results/theme-preset-visual");

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const routes = ["/", "/categorias/remeras/", "/productos/remera-esencial-de-algodon/"];

// Barrido visual por preset. Correr con SOLARA_QA_VISUAL=1.
for (const preset of THEME_PRESETS) {
  test(`theme-preset-visual: ${preset.id}`, async ({ page }) => {
    const themed = applyPreset(referenceStore, preset.id);
    const exported = exportProject(themed, { mode: "production" });

    const server = createServer((req, res) => {
      const path2 = req.url === "/" ? "/index.html" : req.url;
      const content =
        exported.files.get(path2?.replace("/", "")) ?? exported.files.get(path2?.slice(1) ?? "");
      if (content) {
        res.writeHead(200);
        res.end(content);
      } else {
        res.writeHead(404);
        res.end("not found");
      }
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    const baseUrl = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 3000}`;

    for (const vp of viewports) {
      for (const route of routes) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${baseUrl}${route}`);
        const dir = resolve(resultsDir, preset.id, vp.name);
        mkdirSync(dir, { recursive: true });
        const fileName = route.replace(/\//g, "_") || "home";
        await page.screenshot({ path: resolve(dir, `${fileName}.png`), fullPage: false });
      }
    }

    server.close();
  });
}
