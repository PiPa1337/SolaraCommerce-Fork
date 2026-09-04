/**
 * Regresión brand-appear: el logo del navbar y la media del hero pasaban de
 * "nada" a "aparecido" de golpe (y en el preview, de icono roto + alt gigante
 * a imagen). Ahora aparecen con la coreografía de su sección cuando la imagen
 * termina de cargar: el runtime marca `data-solara-loaded` y el CSS anima con
 * duración/easing/distancia/intensidad del panel Movimiento (`none` = apagado).
 */
import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";

function projectWithBrandMotion(headerPreset: "fade" | "none") {
  const project = structuredClone(catalogModernV2Store);
  const logo = project.assets.find((asset) => asset.kind === "image");
  if (!logo) throw new Error("Fixture sin asset de imagen para el logo");
  project.identity.logoAssetId = logo.id;
  for (const section of project.sections) {
    if (section.moduleId === "catalog-header") {
      section.motion = {
        ...section.motion,
        preset: headerPreset,
        intensity: headerPreset === "none" ? 0 : 4,
        duration: headerPreset === "none" ? 0 : 0.45,
        distance: headerPreset === "none" ? 0 : 18,
      };
    }
    if (section.moduleId === "catalog-hero") {
      section.motion = { ...section.motion, preset: "fade-up" };
    }
  }
  return project;
}

const exportedAppear = exportProject(projectWithBrandMotion("fade"), { mode: "production" });
const exportedPlain = exportProject(projectWithBrandMotion("none"), { mode: "production" });

function serve(exported: typeof exportedAppear) {
  let server: Server;
  let serverUrl: string;
  return {
    async start() {
      server = createServer((request, response) => {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
        const path =
          requested === ""
            ? "index.html"
            : requested.endsWith("/")
              ? `${requested}index.html`
              : requested;
        const content = exported.files.get(path);
        if (content === undefined) {
          response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
          return;
        }
        const extension = path.split(".").pop();
        const contentType =
          extension === "html"
            ? "text/html; charset=utf-8"
            : extension === "css"
              ? "text/css; charset=utf-8"
              : extension === "js"
                ? "text/javascript; charset=utf-8"
                : extension === "webp"
                  ? "image/webp"
                  : extension === "avif"
                    ? "image/avif"
                    : extension === "jpg" || extension === "jpeg"
                      ? "image/jpeg"
                      : extension === "png"
                        ? "image/png"
                        : "application/octet-stream";
        response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
        response.end(content);
      });
      await new Promise<void>((resolveListening) => {
        server.listen(0, "127.0.0.1", resolveListening);
      });
      const address = server.address();
      if (address === null || typeof address === "string") {
        throw new Error("El servidor de pruebas no tiene una dirección TCP.");
      }
      serverUrl = `http://127.0.0.1:${address.port}`;
    },
    url(path: string) {
      return new URL(path, serverUrl).toString();
    },
    async stop() {
      await new Promise<void>((resolveClosing, reject) => {
        server.close((error) => (error ? reject(error) : resolveClosing()));
      });
    },
  };
}

test("el logo aparece al cargar con el preset del header", async ({ page }) => {
  const site = serve(exportedAppear);
  await site.start();
  try {
    await page.goto(site.url("/"));
    await expect(
      page.locator('[data-solara-module="catalog-header"][data-motion-visible="true"]'),
    ).toBeAttached();
    const logo = page
      .locator('[data-solara-module="catalog-header"] img.solara-logo')
      .first();
    await expect(logo).toHaveAttribute("data-solara-loaded", "true");
    await expect(logo).toBeVisible();
    // La animación tarda duración de la sección: esperar el estado final.
    await expect
      .poll(() => logo.evaluate((element) => getComputedStyle(element).opacity), {
        timeout: 10_000,
      })
      .toBe("1");
  } finally {
    await site.stop();
  }
});

test("la hero-media aparece al cargar con el preset del hero", async ({ page }) => {
  const site = serve(exportedAppear);
  await site.start();
  try {
    await page.goto(site.url("/"));
    await expect(
      page.locator('[data-solara-module="catalog-hero"][data-motion-visible="true"]'),
    ).toBeAttached();
    const media = page.locator("[data-hero-media]").first();
    await expect(media).toHaveAttribute("data-solara-loaded", "true");
    await expect(media).toBeVisible();
    await expect
      .poll(() => media.evaluate((element) => getComputedStyle(element).opacity), {
        timeout: 10_000,
      })
      .toBe("1");
  } finally {
    await site.stop();
  }
});

test("con preset none el logo queda visible sin marca de load", async ({ page }) => {
  const site = serve(exportedPlain);
  await site.start();
  try {
    await page.goto(site.url("/"));
    const logo = page
      .locator('[data-solara-module="catalog-header"] img.solara-logo')
      .first();
    await expect(logo).toBeVisible();
    await expect(logo).not.toHaveAttribute("data-solara-loaded", "true");
    expect(await logo.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
  } finally {
    await site.stop();
  }
});
