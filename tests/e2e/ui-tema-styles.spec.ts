/**
 * Fix Ola 3 (2026-08-10, plan auditoría Tema) — utilidad de los tokens del
 * tema en el sitio exportado MODERNO (catalog-modern).
 *
 * La auditoría (U3/T4/T5) probó que la paleta fija --catalog-*, el radio
 * fijo, el stack de fuente fijo y el espaciado sin consumidores anulaban
 * casi todos los controles del panel Tema en la plantilla default. Este spec
 * aserTA el comportamiento CORREGIDO en el sitio público exportado y
 * servido: los 7 colores, el radio, las fuentes, el espaciado y la escala
 * producen estilos computados visibles.
 */
import { createServer } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";

test.setTimeout(process.env.CI ? 60_000 : 30_000);

const GEORGIA_STACK = 'Georgia, "Times New Roman", serif';

const PALETTE = {
  background: "#112233",
  surface: "#334455",
  text: "#ddeeff",
  muted: "#8899aa",
  accent: "#cc3355",
  accentText: "#ffeeff",
  border: "#556677",
};

type ThemeOverride = {
  colors: typeof PALETTE;
  typography: { display: string; body: string; scale: number };
  spacingScale: number;
  radius: number;
};

function exportWith(theme: ThemeOverride): {
  files: Map<string, string | Uint8Array>;
  css: string;
} {
  const store = structuredClone(catalogModernStore);
  store.theme = { ...store.theme, ...theme };
  const files = exportProject(store, { mode: "production" }).files;
  const css = String(files.get("assets/storefront.css") ?? "");
  return { files, css };
}

import { FIXTURE_PRODUCT_FILES } from "./fixture-server";

const fixtureFiles = FIXTURE_PRODUCT_FILES;
async function serve(
  files: Map<string, string | Uint8Array>,
): Promise<{ url: string; close: () => Promise<void> }> {
  const siteServer = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const path =
      requested === ""
        ? "index.html"
        : requested.endsWith("/")
          ? `${requested}index.html`
          : requested;
    const content = files.get(path) ?? fixtureFiles.get(path);
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
            : extension === "png"
              ? "image/png"
              : "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      Connection: "close",
    });
    response.end(content);
  });
  await new Promise<void>((resolveListening) =>
    siteServer.listen(0, "127.0.0.1", resolveListening),
  );
  const address = siteServer.address();
  if (address === null || typeof address === "string") {
    throw new Error("El servidor de pruebas no tiene una dirección TCP.");
  }
  const close = (): Promise<void> =>
    new Promise<void>((resolveClosing, reject) => {
      siteServer.close((error) => (error ? reject(error) : resolveClosing()));
    });
  return { url: `http://127.0.0.1:${address.port}`, close };
}

async function gotoStore(page: Page, url: string): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url);
  await expect(page.locator('[data-design-family="catalog-modern-v1"]')).toBeVisible();
}

test("colores: los 7 tokens del editor pintan las superficies modernas del sitio exportado", async ({
  page,
}) => {
  const exportResult = exportWith({
    colors: PALETTE,
    typography: { display: GEORGIA_STACK, body: GEORGIA_STACK, scale: 1 },
    spacingScale: 1,
    radius: 16,
  });

  // El CSS exportado enlaza la capa del skin con los tokens del editor.
  expect(exportResult.css).toContain("--catalog-ink:var(--solara-text");
  expect(exportResult.css).toContain("--catalog-paper:var(--solara-background");

  const site = await serve(exportResult.files);
  try {
    await gotoStore(page, site.url);
    const computed = await page
      .locator("[data-solara-store]")
      .first()
      .evaluate((root) => {
        const colorOf = (selector: string): string => {
          const element = root.querySelector(selector);
          if (!element) throw new Error(`No existe ${selector} en el sitio moderno`);
          return getComputedStyle(element).color;
        };
        const backgroundOf = (selector: string): string => {
          const element = root.querySelector(selector);
          if (!element) throw new Error(`No existe ${selector} en el sitio moderno`);
          return getComputedStyle(element).backgroundColor;
        };
        return {
          brand: colorOf(".catalog-brand"),
          eyebrow: colorOf(".catalog-eyebrow"),
          actionText: colorOf(".catalog-primary-action"),
          actionBackground: backgroundOf(".catalog-primary-action"),
          searchBorder: (() => {
            const element = root.querySelector(".catalog-search-link");
            if (!element) throw new Error("No existe .catalog-search-link");
            return getComputedStyle(element).borderColor;
          })(),
        };
      });

    expect(computed.brand).toBe("rgb(221, 238, 255)");
    expect(computed.eyebrow).toBe("rgb(136, 153, 170)");
    expect(computed.actionBackground).toBe("rgb(204, 51, 85)");
    expect(computed.actionText).toBe("rgb(255, 238, 255)");
    expect(computed.searchBorder).toBe("rgb(85, 102, 119)");
  } finally {
    await site.close();
  }
});

test("radio: las superficies modernas siguen el slider y las pills conservan 999px", async ({
  page,
}) => {
  const base = {
    colors: PALETTE,
    typography: { display: GEORGIA_STACK, body: GEORGIA_STACK, scale: 1 },
    spacingScale: 1,
  };

  const radius40 = exportWith({ ...base, radius: 40 });
  expect(radius40.css).toMatch(/--solara-radius:40px;/);
  const site40 = await serve(radius40.files);
  try {
    await gotoStore(page, site40.url);
    const metrics = await page
      .locator("[data-solara-store]")
      .first()
      .evaluate((root) => {
        const radiusOf = (selector: string): string => {
          const element = root.querySelector(selector);
          if (!element) throw new Error(`No existe ${selector}`);
          return getComputedStyle(element).borderRadius;
        };
        return {
          media: radiusOf(".catalog-product-media"),
          hero: radiusOf(".catalog-hero-inner"),
          pill: radiusOf(".catalog-search-link"),
        };
      });
    expect(metrics.media).toBe("40px");
    expect(metrics.hero).toBe("40px");
    expect(metrics.pill).toBe("999px");
  } finally {
    await site40.close();
  }

  const radius0 = exportWith({ ...base, radius: 0 });
  expect(radius0.css).toMatch(/--solara-radius:0px;/);
  const site0 = await serve(radius0.files);
  try {
    await gotoStore(page, site0.url);
    const mediaRadius = await page
      .locator(".catalog-product-media")
      .first()
      .evaluate((element) => getComputedStyle(element).borderRadius);
    expect(mediaRadius).toBe("0px");
  } finally {
    await site0.close();
  }
});

test("fuentes: la familia de texto llega a la raíz y la de títulos a h1 y a la marca", async ({
  page,
}) => {
  const exportResult = exportWith({
    colors: PALETTE,
    typography: { display: GEORGIA_STACK, body: GEORGIA_STACK, scale: 1 },
    spacingScale: 1,
    radius: 16,
  });
  const minifiedGeorgia = GEORGIA_STACK.replaceAll(", ", ",");
  expect(exportResult.css).toContain(`--solara-font-body:${minifiedGeorgia}`);
  expect(exportResult.css).toContain(`--solara-font-display:${minifiedGeorgia}`);

  const site = await serve(exportResult.files);
  try {
    await gotoStore(page, site.url);
    const families = await page
      .locator("[data-solara-store]")
      .first()
      .evaluate((root) => {
        const heading = root.querySelector("h1");
        const brand = root.querySelector(".catalog-brand");
        if (!heading || !brand) throw new Error("Faltan títulos o marca");
        return {
          root: getComputedStyle(root).fontFamily,
          heading: getComputedStyle(heading).fontFamily,
          brand: getComputedStyle(brand).fontFamily,
        };
      });
    expect(families.root).toContain("Georgia");
    expect(families.root).not.toContain("Archivo");
    expect(families.heading).toContain("Georgia");
    expect(families.brand).toContain("Georgia");
  } finally {
    await site.close();
  }
});

test("espaciado: el slider escala los gaps y paddings de las grillas principales", async ({
  page,
}) => {
  const base = {
    colors: PALETTE,
    typography: { display: GEORGIA_STACK, body: GEORGIA_STACK, scale: 1 },
    radius: 16,
  };

  const spaced = exportWith({ ...base, spacingScale: 1.5 });
  expect(spaced.css).toContain("var(--solara-space-scale");
  const site = await serve(spaced.files);
  try {
    await gotoStore(page, site.url);
    const gaps = await page
      .locator("[data-solara-store]")
      .first()
      .evaluate((root) => {
        const grid = root.querySelector(".catalog-product-grid");
        const footer = root.querySelector(".catalog-footer-inner");
        if (!grid || !footer) throw new Error("Faltan grillas modernas");
        return {
          gridGap: getComputedStyle(grid).columnGap,
          footerGap: getComputedStyle(footer).columnGap,
          footerPaddingTop: getComputedStyle(footer).paddingTop,
        };
      });
    expect(gaps.gridGap).toBe("30px");
    expect(gaps.footerGap).toBe("48px");
    expect(gaps.footerPaddingTop).toBe("72px");
  } finally {
    await site.close();
  }
});

test("escala: los títulos modernos escalan con --solara-type-scale", async ({ page }) => {
  const base = {
    colors: PALETTE,
    typography: { display: GEORGIA_STACK, body: GEORGIA_STACK, scale: 1 },
    spacingScale: 1,
    radius: 16,
  };

  const at100 = exportWith({ ...base, typography: { ...base.typography, scale: 1 } });
  const at140 = exportWith({ ...base, typography: { ...base.typography, scale: 1.4 } });
  expect(at140.css).toMatch(/--solara-type-scale:1\.4;/);

  const site100 = await serve(at100.files);
  const size100 = await (async () => {
    try {
      await gotoStore(page, site100.url);
      return await page
        .locator(".catalog-hero-copy h1")
        .first()
        .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    } finally {
      await site100.close();
    }
  })();
  expect(size100).toBeGreaterThan(0);

  const site140 = await serve(at140.files);
  try {
    await gotoStore(page, site140.url);
    const size140 = await page
      .locator(".catalog-hero-copy h1")
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    expect(size140 / size100).toBeCloseTo(1.4, 2);
  } finally {
    await site140.close();
  }
});
