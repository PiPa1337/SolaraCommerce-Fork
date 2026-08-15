import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";

const exported = exportProject(catalogModernV2Store, { mode: "production" });
const exportedV1 = exportProject(catalogModernStore, { mode: "production" });
const fixtureFiles = new Map<string, Uint8Array>(
  ["hero", "remera", "jean", "camisa"].map((name) => [
    `fixtures/modo-sur-${name}.png`,
    readFileSync(resolve(`apps/studio/public/fixtures/modo-sur-${name}.png`)),
  ]),
);

let server: Server;
let serverUrl: string;

async function revealWholePage(page: import("@playwright/test").Page): Promise<void> {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 640) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
    await page.waitForTimeout(45);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
}

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const requested = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const path =
      requested === ""
        ? "index.html"
        : requested.endsWith("/")
          ? `${requested}index.html`
          : requested;
    const content = exported.files.get(path) ?? fixtureFiles.get(path);
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
    response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
    response.end(content);
  });

  await new Promise<void>((resolveListening) => {
    server.listen(0, "127.0.0.1", resolveListening);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("El servidor V2 no tiene una dirección TCP.");
  }
  serverUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolveClosing, reject) => {
    server.close((error) => (error ? reject(error) : resolveClosing()));
  });
});

test("V2 compone el fold editorial y la grilla sin overflow en 1920x968", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 968 });
  await page.goto(serverUrl);

  const root = page.locator('[data-design-family="catalog-modern-v2"]');
  await expect(root).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".catalog-hero-media img")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920);
  expect(
    await page.locator(".catalog-hero-copy h1").evaluate((element) => ({
      overflowWrap: getComputedStyle(element).overflowWrap,
      wordBreak: getComputedStyle(element).wordBreak,
    })),
  ).toEqual({ overflowWrap: "normal", wordBreak: "normal" });
  expect(
    await page.locator(".catalog-hero-copy h1").evaluate((element) => {
      const words: { word: string; rects: number }[] = [];
      for (const inner of element.querySelectorAll<HTMLElement>("[data-hero-line-inner]")) {
        const node = inner.firstChild;
        if (!node || node.nodeType !== Node.TEXT_NODE) continue;
        const text = node.textContent ?? "";
        const lineWords = text.match(/\S+/g) ?? [];
        let offset = 0;
        for (const word of lineWords) {
          const start = text.indexOf(word, offset);
          const range = document.createRange();
          range.setStart(node, start);
          range.setEnd(node, start + word.length);
          offset = start + word.length;
          words.push({ word, rects: range.getClientRects().length });
        }
      }
      return words;
    }),
  ).toEqual(expect.arrayContaining([expect.objectContaining({ word: "representa.", rects: 1 })]));

  const heroMetrics = await page.locator(".catalog-hero-inner").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const title = element.querySelector("h1")?.getBoundingClientRect();
    const actions = element.querySelector(".catalog-hero-actions")?.getBoundingClientRect();
    const media = element.querySelector(".catalog-hero-media")?.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      titleInside: Boolean(title && title.left >= rect.left && title.right <= rect.right),
      titleBeforeMedia: Boolean(title && media && title.right <= media.left),
      actionsInViewport: Boolean(actions && actions.bottom <= window.innerHeight),
      mediaShare: media ? media.width / rect.width : 0,
      mediaAspect: media ? Number(((media.width / media.height) * 100).toFixed(2)) : 0,
    };
  });
  expect(heroMetrics.width).toBeGreaterThan(1700);
  expect(heroMetrics.height).toBeGreaterThan(968 * 0.89);
  expect(heroMetrics.height).toBeLessThan(968 * 0.91);
  expect(heroMetrics.titleInside).toBe(true);
  expect(heroMetrics.titleBeforeMedia).toBe(true);
  expect(heroMetrics.actionsInViewport).toBe(true);
  expect(heroMetrics.mediaShare).toBeGreaterThan(0.2);
  expect(heroMetrics.mediaShare).toBeLessThan(0.45);
  expect(heroMetrics.mediaAspect).toBeGreaterThan(50);
  expect(heroMetrics.mediaAspect).toBeLessThan(59);

  await expect
    .poll(
      () =>
        page
          .locator('[data-solara-module="catalog-hero"]')
          .evaluate((element) => getComputedStyle(element).opacity),
      { timeout: 5_000 },
    )
    .toBe("1");

  // Coreografía de entrada del hero V2: tras ~1.4s las líneas, la regla, el
  // cuerpo, las acciones, los beneficios y el media quedan en estado final.
  await expect
    .poll(
      () =>
        page
          .locator("[data-hero-benefit]")
          .nth(2)
          .evaluate((element) => getComputedStyle(element).opacity),
      { timeout: 5_000 },
    )
    .toBe("1");
  const heroFinal = await page.evaluate(() => {
    const identity = ["none", "matrix(1, 0, 0, 1, 0, 0)"];
    const title = document.querySelector(".catalog-hero-title");
    const lines = [...document.querySelectorAll<HTMLElement>("[data-hero-line-inner]")];
    const rule = document.querySelector(".catalog-hero-rule");
    const media = document.querySelector("[data-hero-media]");
    const benefits = [
      ...document.querySelectorAll<HTMLElement>(".catalog-hero-benefits--copy [data-hero-benefit]"),
    ];
    const body = document.querySelector(".catalog-hero-reveal--body");
    const actions = document.querySelector(".catalog-hero-reveal--actions");
    const mediaClip = media ? getComputedStyle(media).clipPath : "";
    const clipPercentages =
      mediaClip === "none" ? [] : [...mediaClip.matchAll(/([\d.]+)%/g)].map((m) => Number(m[1]));
    return {
      titleOpacity: title ? getComputedStyle(title).opacity : "",
      linesFinal: lines.every((line) => identity.includes(getComputedStyle(line).transform)),
      ruleFinal: rule ? identity.includes(getComputedStyle(rule).transform) : false,
      bodyOpacity: body ? getComputedStyle(body).opacity : "",
      actionsOpacity: actions ? getComputedStyle(actions).opacity : "",
      benefitOpacities: benefits.map((benefit) => getComputedStyle(benefit).opacity),
      mediaVisible:
        Boolean(media) &&
        getComputedStyle(media).opacity === "1" &&
        (mediaClip === "none" || clipPercentages.length === 0 || Math.max(...clipPercentages) <= 1),
    };
  });
  expect(heroFinal.titleOpacity).toBe("1");
  expect(heroFinal.linesFinal).toBe(true);
  expect(heroFinal.ruleFinal).toBe(true);
  expect(heroFinal.bodyOpacity).toBe("1");
  expect(heroFinal.actionsOpacity).toBe("1");
  expect(heroFinal.benefitOpacities).toEqual(["1", "1", "1"]);
  expect(heroFinal.mediaVisible).toBe(true);

  // Fondo editorial del hero (desktop): cubre el hero, usa la intensidad del
  // velo del setting y deja el copy en tinta oscura sobre el velo blanquizo.
  const heroBackgroundMetrics = await page.evaluate(() => {
    const bg = document.querySelector<HTMLElement>("[data-hero-background]");
    const hero = document.querySelector<HTMLElement>(".catalog-hero-inner");
    const copy = document.querySelector<HTMLElement>(".catalog-hero-copy");
    if (!bg || !hero || !copy) return null;
    const bgRect = bg.getBoundingClientRect();
    const heroRect = hero.getBoundingClientRect();
    return {
      fillsHero:
        Math.abs(bgRect.left - heroRect.left) < 1 &&
        Math.abs(bgRect.right - heroRect.right) < 1 &&
        Math.abs(bgRect.top - heroRect.top) < 1,
      darkness: getComputedStyle(bg).getPropertyValue("--catalog-hero-bg-dark").trim(),
      veilVisible: getComputedStyle(bg, "::after").backgroundImage !== "none",
      copyIsWhite: getComputedStyle(copy).color === "rgb(255, 255, 255)",
    };
  });
  expect(heroBackgroundMetrics).toEqual({
    fillsHero: true,
    darkness: "0.6",
    veilVisible: true,
    copyIsWhite: false,
  });

  // Los beneficios del hero van en una caja con blur de fondo sobre la imagen.
  const benefitsBox = await page
    .locator(".catalog-hero-benefits--copy")
    .evaluate((element) => getComputedStyle(element).backdropFilter);
  expect(benefitsBox).not.toBe("none");

  const heroCollision = await page.evaluate(() => {
    const header = document
      .querySelector('[data-solara-module="catalog-header"]')
      ?.getBoundingClientRect();
    const hero = document.querySelector(".catalog-hero-inner")?.getBoundingClientRect();
    const strip = document
      .querySelector('[data-solara-module="catalog-brand-strip"] .catalog-brand-strip-inner')
      ?.getBoundingClientRect();
    return {
      headerBottom: header?.bottom ?? 0,
      heroTop: hero?.top ?? 0,
      heroBottom: hero?.bottom ?? 0,
      stripTop: strip?.top ?? 0,
    };
  });
  expect(Math.abs(heroCollision.heroTop - heroCollision.headerBottom)).toBeLessThanOrEqual(1);
  expect(Math.abs(heroCollision.stripTop - heroCollision.heroBottom)).toBeLessThanOrEqual(1);

  const bento = page.locator(".catalog-category-bento-grid");
  await expect(bento.locator(".catalog-category-bento-item")).toHaveCount(8);
  await expect(bento).not.toContainText("Básicas");
  await expect(bento.locator(".catalog-category-bento-item--wide")).not.toHaveCount(0);
  await expect(bento.locator(".catalog-category-bento-item--tall")).not.toHaveCount(0);
  await expect(bento.locator(".catalog-category-bento-item--compact")).not.toHaveCount(0);

  const grid = page.locator(".catalog-product-grid").first();
  // La grilla V2 topea en 5 columnas (min(100% / 5, 20rem)): 5 es el máximo
  // editorial en desktop y las cards crecen con la columna.
  expect(
    await grid.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length,
    ),
  ).toBe(5);
  const gridMetrics = await grid.evaluate((element) => {
    const gridRect = element.getBoundingClientRect();
    const cardRect = element
      .querySelector<HTMLElement>(".catalog-product-card")
      ?.getBoundingClientRect();
    return { gridWidth: gridRect.width, cardWidth: cardRect?.width ?? 0 };
  });
  expect(gridMetrics.gridWidth).toBeGreaterThan(1700);
  expect(gridMetrics.gridWidth).toBeLessThanOrEqual(1760);
  // 5 columnas sobre 1760px con gap 1.6rem: card ≈ 331px.
  expect(gridMetrics.cardWidth).toBeGreaterThan(320);
  expect(gridMetrics.cardWidth).toBeLessThan(345);
  const sectionPadding = await page
    .locator(".catalog-product-grid-section")
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        top: Number.parseFloat(style.paddingTop),
        bottom: Number.parseFloat(style.paddingBottom),
      };
    });
  expect(sectionPadding.top).toBeLessThanOrEqual(140);
  expect(sectionPadding.bottom).toBeLessThanOrEqual(140);
  const firstMedia = grid.locator(".catalog-product-media").first();
  const mediaRatio = await firstMedia.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width / rect.height;
  });
  expect(mediaRatio).toBeCloseTo(1, 1);

  const image = firstMedia.locator("img");
  await expect(image).toHaveAttribute(
    "sizes",
    "(max-width: 767px) calc((100vw - 2.2rem) / 2), (max-width: 1199px) min(22vw, 11.5rem), min(20vw, 13rem)",
  );
  const initialTransform = await image.evaluate((element) => getComputedStyle(element).transform);
  await firstMedia.hover();
  await expect
    .poll(() => image.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe(initialTransform);

  await revealWholePage(page);
  await expect(page.locator(".catalog-product-card").last()).toHaveCSS("opacity", "1");
  await expect
    .poll(() =>
      page
        .locator(".catalog-product-grid")
        .first()
        .locator(".catalog-product-card-image")
        .evaluateAll(
          (images) =>
            images.filter(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ).length,
        ),
    )
    .toBe(12);
  await page.screenshot({ path: testInfo.outputPath("home-1920x968.png"), fullPage: true });
});

test("V2 usa el ancho completo en colecciones y mantiene cards cuadradas", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 968 });
  await page.goto(new URL("/colecciones/recien-llegados/", serverUrl).toString());

  const grid = page.locator(".catalog-product-grid").first();
  await expect(grid).toBeVisible();
  const metrics = await grid.evaluate((element) => {
    const gridRect = element.getBoundingClientRect();
    const card = element
      .querySelector<HTMLElement>(".catalog-product-card")
      ?.getBoundingClientRect();
    const media = element
      .querySelector<HTMLElement>(".catalog-product-media")
      ?.getBoundingClientRect();
    return {
      columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
      width: gridRect.width,
      cardWidth: card?.width ?? 0,
      mediaRatio: media ? media.width / media.height : 0,
    };
  });
  // La grilla V2 topea en 5 columnas también en colecciones (mismo auto-fit cap).
  expect(metrics.columns).toBe(5);
  expect(metrics.width).toBeGreaterThan(1700);
  expect(metrics.width).toBeLessThanOrEqual(1760);
  expect(metrics.cardWidth).toBeGreaterThan(320);
  expect(metrics.cardWidth).toBeLessThan(345);
  expect(metrics.mediaRatio).toBeCloseTo(1, 1);
});

test("V2 ajusta las imágenes al ancho renderizado y mantiene una galería PDP usable", async ({
  page,
}) => {
  const productUrl = new URL("/productos/remera-esencial-de-algodon/", serverUrl).toString();
  await page.setViewportSize({ width: 1920, height: 968 });
  await page.goto(productUrl);

  const detail = page.locator('[data-solara-module="catalog-product-detail"]');
  const detailMetrics = await detail.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: window.innerWidth - rect.right,
      width: rect.width,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  expect(detailMetrics.left).toBeGreaterThanOrEqual(79);
  expect(detailMetrics.right).toBeGreaterThanOrEqual(79);
  expect(detailMetrics.scrollWidth).toBeLessThanOrEqual(1920);

  const figures = page.locator(".catalog-product-gallery-main figure");
  const thumbs = page.locator(".catalog-product-gallery-thumbs button");
  await expect(figures).toHaveCount(3);
  await expect(thumbs).toHaveCount(3);
  expect(
    await figures.evaluateAll(
      (elements) =>
        elements.filter((element) => getComputedStyle(element).display !== "none").length,
    ),
  ).toBe(1);
  await expect(figures.first().locator("img")).toHaveAttribute(
    "sizes",
    "(max-width: 767px) 92vw, (max-width: 1199px) 94vw, 60vw",
  );
  await thumbs.nth(1).click();
  await expect(figures.nth(1)).toHaveAttribute("data-gallery-active", "true");
  await expect(thumbs.nth(1)).toHaveAttribute("aria-current", "true");
  const relatedImages = page.locator(".solara-related-products .catalog-product-card-image");
  await expect(relatedImages).toHaveCount(6);
  const relatedGrid = page.locator(".solara-related-products .catalog-product-grid");
  const relatedGridMetrics = await relatedGrid.evaluate((element) => {
    const gridRect = element.getBoundingClientRect();
    const cardRect = element
      .querySelector<HTMLElement>(".catalog-product-card")
      ?.getBoundingClientRect();
    return {
      columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
      gridWidth: gridRect.width,
      cardWidth: cardRect?.width ?? 0,
    };
  });
  // El auto-fit topeado genera 5 tracks sobre el ancho completo; con 6
  // relacionados el layout colapsa una track vacía (computed style reporta las
  // 5 tracks generadas).
  expect(relatedGridMetrics.columns).toBe(5);
  expect(relatedGridMetrics.gridWidth).toBeGreaterThan(1700);
  expect(relatedGridMetrics.gridWidth).toBeLessThanOrEqual(1760);
  expect(relatedGridMetrics.cardWidth).toBeGreaterThan(320);
  expect(relatedGridMetrics.cardWidth).toBeLessThan(345);
  await expect
    .poll(() =>
      relatedImages.evaluateAll(
        (images) => images.filter((image) => image.complete && image.naturalWidth > 0).length,
      ),
    )
    .toBe(6);

  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(productUrl);
    const intermediateMetrics = await page
      .locator(".catalog-product-detail-inner")
      .evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const info = element
          .querySelector<HTMLElement>(".catalog-product-info")
          ?.getBoundingClientRect();
        const button = element
          .querySelector<HTMLElement>(".catalog-product-add")
          ?.getBoundingClientRect();
        return {
          columns: style.gridTemplateColumns.split(" ").length,
          infoWidth: info?.width ?? 0,
          buttonBottom: button?.bottom ?? 0,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
          sectionBottom: rect.bottom,
        };
      });
    expect(intermediateMetrics.columns).toBe(2);
    expect(intermediateMetrics.infoWidth).toBeGreaterThan(0);
    expect(intermediateMetrics.buttonBottom).toBeLessThanOrEqual(intermediateMetrics.sectionBottom);
    expect(intermediateMetrics.documentWidth).toBeLessThanOrEqual(
      intermediateMetrics.viewportWidth,
    );
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(productUrl);
  const mobileDetail = page.locator('[data-solara-module="catalog-product-detail"]');
  const mobileMetrics = await mobileDetail.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const inner = element.querySelector<HTMLElement>(".catalog-product-detail-inner");
    return {
      left: rect.left,
      right: window.innerWidth - rect.right,
      layout: inner ? getComputedStyle(inner).display : "",
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  expect(mobileMetrics.left).toBeGreaterThanOrEqual(11);
  expect(mobileMetrics.right).toBeGreaterThanOrEqual(11);
  expect(mobileMetrics.layout).toBe("flex");
  expect(mobileMetrics.scrollWidth).toBeLessThanOrEqual(390);
  await expect(mobileDetail.locator(".catalog-product-gallery-thumbs button")).toHaveCount(3);
});

test("V2 mantiene feedback equivalente para hover y teclado en cards y bento", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 968 });
  await page.goto(serverUrl);

  const productCard = page.locator(".catalog-product-card").first();
  const productLink = productCard.locator(".catalog-product-media");
  const initialProductTransform = await productCard.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await productLink.focus();
  await expect
    .poll(() => productCard.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe(initialProductTransform);

  const bentoItem = page.locator(".catalog-category-bento-item").first();
  const bentoImage = bentoItem.locator("img");
  await bentoItem.scrollIntoViewIfNeeded();
  const initialBentoTransform = await bentoItem.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await bentoItem.focus();
  await expect
    .poll(() => bentoItem.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe(initialBentoTransform);
  await expect
    .poll(() => bentoImage.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe("none");

  const viewAll = page.locator(".catalog-view-all").first();
  await viewAll.focus();
  await expect(viewAll).toBeFocused();
  await expect(viewAll).toHaveCSS("text-decoration-line", "none");
});

test("V2 hero: la foto no hace zoom al hover y el CTA conserva cortina sin mover texto ni icono", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 968 });
  await page.goto(serverUrl);
  await page.locator('[data-solara-module="catalog-hero"]').waitFor({ state: "visible" });
  await page.waitForTimeout(1_600);

  const hero = page.locator('[data-solara-module="catalog-hero"]');
  const media = hero.locator("[data-hero-media]");
  const image = hero.locator(".catalog-hero-image");
  const mediaTransform = await image.evaluate((element) => getComputedStyle(element).transform);
  await hero.locator(".catalog-hero-copy").hover();
  await page.waitForTimeout(600);
  expect(await image.evaluate((element) => getComputedStyle(element).transform)).toBe(
    mediaTransform,
  );
  expect(await media.evaluate((element) => getComputedStyle(element).transform)).toBe("none");

  const action = hero.locator(".catalog-hero-actions .catalog-primary-action");
  const label = hero.locator(".catalog-hero-cta-label");
  const icon = hero.locator(".catalog-hero-cta-icon");
  const actionTransform = await action.evaluate((element) => getComputedStyle(element).transform);
  const labelTransform = await label.evaluate((element) => getComputedStyle(element).transform);
  const iconTransform = await icon.evaluate((element) => getComputedStyle(element).transform);
  const curtainRest = await action.evaluate(
    (element) => getComputedStyle(element, "::before").transform,
  );
  await action.hover();
  await expect
    .poll(() => action.evaluate((element) => getComputedStyle(element, "::before").transform))
    .not.toBe(curtainRest);
  await page.waitForTimeout(500);
  expect(await action.evaluate((element) => getComputedStyle(element).transform)).toBe(
    actionTransform,
  );
  expect(await label.evaluate((element) => getComputedStyle(element).transform)).toBe(
    labelTransform,
  );
  expect(await icon.evaluate((element) => getComputedStyle(element).transform)).toBe(iconTransform);
});

test("V2 mantiene CTA, dos columnas y reduced motion en 390x844", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(serverUrl);

  const primaryAction = page.locator(".catalog-hero-actions .catalog-primary-action");
  await expect(primaryAction).toBeVisible();
  expect((await primaryAction.boundingBox())?.y).toBeLessThan(844);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(
    await page
      .locator(".catalog-product-grid")
      .first()
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length),
  ).toBe(2);
  const mobileBento = page.locator(".catalog-category-bento-grid");
  const mobileBentoMetrics = await mobileBento.evaluate((element) => {
    const gridRect = element.getBoundingClientRect();
    const items = [...element.querySelectorAll<HTMLElement>(".catalog-category-bento-item")];
    return {
      columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
      count: items.length,
      gridLeft: gridRect.left,
      gridWidth: gridRect.width,
      maxRight: Math.max(...items.map((item) => item.getBoundingClientRect().right)),
      wideColumns: getComputedStyle(
        items.find((item) => item.classList.contains("catalog-category-bento-item--wide")) ??
          items[0],
      ).gridColumn,
      tallRows: getComputedStyle(
        items.find((item) => item.classList.contains("catalog-category-bento-item--tall")) ??
          items[0],
      ).gridRow,
    };
  });
  expect(mobileBentoMetrics.columns).toBe(2);
  expect(mobileBentoMetrics.count).toBe(8);
  expect(mobileBentoMetrics.maxRight).toBeLessThanOrEqual(
    mobileBentoMetrics.gridLeft + mobileBentoMetrics.gridWidth + 1,
  );
  expect(mobileBentoMetrics.wideColumns).toBe("span 1");
  expect(mobileBentoMetrics.tallRows).toBe("span 1");
  const mobileHeroEditorial = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>(".catalog-hero-editorial .catalog-hero-inner");
    const media = document.querySelector<HTMLElement>(".catalog-hero-editorial [data-hero-media]");
    const band = document.querySelector<HTMLElement>(".catalog-hero-benefits--band");
    const copy = document.querySelector<HTMLElement>(".catalog-hero-editorial .catalog-hero-copy");
    if (!hero || !media || !band || !copy) return null;
    const heroRect = hero.getBoundingClientRect();
    const mediaRect = media.getBoundingClientRect();
    const bandRect = band.getBoundingClientRect();
    const copyRect = copy.getBoundingClientRect();
    return {
      mediaFillsHero:
        Math.abs(mediaRect.left - heroRect.left) < 1 &&
        Math.abs(mediaRect.right - heroRect.right) < 1 &&
        mediaRect.top <= heroRect.top,
      bandBelowMedia: bandRect.top >= mediaRect.bottom - 1,
      copyInsideHero: copyRect.top >= heroRect.top && copyRect.bottom <= heroRect.bottom + 1,
      bandVisible: getComputedStyle(band).display !== "none",
      backgroundHidden: getComputedStyle(
        document.querySelector<HTMLElement>("[data-hero-background]") ??
          document.createElement("div"),
      ).display,
    };
  });
  expect(mobileHeroEditorial).toEqual({
    mediaFillsHero: true,
    bandBelowMedia: true,
    copyInsideHero: true,
    bandVisible: true,
    backgroundHidden: "none",
  });
  expect(
    await page.locator(".catalog-hero-copy h1").evaluate((element) => {
      const words: { word: string; rects: number }[] = [];
      for (const inner of element.querySelectorAll<HTMLElement>("[data-hero-line-inner]")) {
        const node = inner.firstChild;
        if (!node || node.nodeType !== Node.TEXT_NODE) continue;
        const text = node.textContent ?? "";
        const lineWords = text.match(/\S+/g) ?? [];
        let offset = 0;
        for (const word of lineWords) {
          const start = text.indexOf(word, offset);
          const range = document.createRange();
          range.setStart(node, start);
          range.setEnd(node, start + word.length);
          offset = start + word.length;
          words.push({ word, rects: range.getClientRects().length });
        }
      }
      return words;
    }),
  ).toEqual(expect.arrayContaining([expect.objectContaining({ word: "representa.", rects: 1 })]));

  await revealWholePage(page);
  await expect(page.locator(".catalog-product-card").last()).toHaveCSS("opacity", "1");
  await expect
    .poll(() =>
      page
        .locator(".catalog-product-grid")
        .first()
        .locator(".catalog-product-card-image")
        .evaluateAll(
          (images) =>
            images.filter(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ).length,
        ),
    )
    .toBe(12);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator('[data-design-family="catalog-modern-v2"]')).toBeVisible();
  expect(
    await page
      .locator('[data-solara-module="catalog-hero"]')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  // Con reduced motion el hero queda visible al instante, sin coreografía:
  // líneas sin transform, regla sin escala, beneficios opacos y media sin
  // máscara de entrada.
  const reducedHero = await page.evaluate(() => {
    const line = document.querySelector<HTMLElement>("[data-hero-line-inner]");
    const rule = document.querySelector<HTMLElement>(".catalog-hero-rule");
    const media = document.querySelector<HTMLElement>("[data-hero-media]");
    const benefits = [
      ...document.querySelectorAll<HTMLElement>(".catalog-hero-benefits--copy [data-hero-benefit]"),
    ];
    return {
      lineTransform: line ? getComputedStyle(line).transform : "",
      lineAnimation: line ? getComputedStyle(line).animationName : "",
      ruleTransform: rule ? getComputedStyle(rule).transform : "",
      benefitOpacities: benefits.map((benefit) => getComputedStyle(benefit).opacity),
      mediaClip: media ? getComputedStyle(media).clipPath : "",
      mediaAnimation: media ? getComputedStyle(media).animationName : "",
    };
  });
  expect(reducedHero.lineTransform).toBe("none");
  expect(reducedHero.lineAnimation).toBe("none");
  expect(reducedHero.ruleTransform).toBe("none");
  expect(reducedHero.benefitOpacities).toEqual(["1", "1", "1"]);
  expect(reducedHero.mediaClip).toBe("none");
  expect(reducedHero.mediaAnimation).toBe("none");
  expect(
    await page
      .locator(".catalog-product-card-image")
      .first()
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe("0s");

  await page.screenshot({ path: testInfo.outputPath("home-390x844.png"), fullPage: true });
});

test("V2 audita composición en viewports intermedios", async ({ page }, testInfo) => {
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(serverUrl);
    const metrics = await page.evaluate(() => {
      const hero = document.querySelector<HTMLElement>(".catalog-hero-inner");
      const grid = document.querySelector<HTMLElement>(".catalog-product-grid");
      const card = grid?.querySelector<HTMLElement>(".catalog-product-card");
      const action = document.querySelector<HTMLElement>(".catalog-hero-actions");
      const nav = document.querySelector<HTMLElement>(".catalog-desktop-nav");
      return {
        documentWidth: document.documentElement.scrollWidth,
        heroWidth: hero?.getBoundingClientRect().width ?? 0,
        heroActionsBottom: action?.getBoundingClientRect().bottom ?? 0,
        productColumns: grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0,
        productCardWidth: card?.getBoundingClientRect().width ?? 0,
        navHeight: nav?.getBoundingClientRect().height ?? 0,
      };
    });
    expect(metrics.documentWidth).toBeLessThanOrEqual(viewport.width);
    expect(metrics.heroWidth).toBeLessThanOrEqual(viewport.width);
    expect(metrics.heroActionsBottom).toBeLessThanOrEqual(viewport.height);
    // 1440 y 1366 quedan en 5 columnas (tope editorial), 1024 baja a 4 y 768 a 3.
    expect(metrics.productColumns).toBe(
      viewport.width >= 1024 ? (viewport.width >= 1200 ? 5 : 4) : 3,
    );
    expect(metrics.productCardWidth).toBeGreaterThan(155);
    expect(metrics.navHeight).toBeLessThanOrEqual(44);
    await page.screenshot({
      path: testInfo.outputPath(`home-${viewport.width}x${viewport.height}.png`),
      fullPage: false,
    });
  }
});

test("V2 ordena categoría y filtros como rail editorial y sheet móvil", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 968 });
  await page.goto(new URL("/categorias/remeras/", serverUrl).toString());

  const layout = page.locator(".catalog-category-layout");
  const filters = page.locator(".catalog-category-filters");
  const grid = page.locator(".catalog-category-results .catalog-product-grid");
  const categoryImage = page.locator(".solara-category-hero img");
  await expect(layout).toBeVisible();
  await expect(filters.locator(".catalog-filter-groups")).toBeVisible();
  await expect(filters.locator("details + .catalog-filter-groups")).toHaveCount(1);
  expect(
    await categoryImage.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width / rect.height;
    }),
  ).toBeCloseTo(5 / 3, 1);
  expect(await layout.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).toMatch(
    /^2[4-9]\dpx /,
  );
  // La grilla de categorías topea en 4 columnas sobre su contenedor de 1320px
  // (auto-fit min(100% / 5, 20rem); el rail la deja más angosta que la home).
  expect(
    await grid.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length,
    ),
  ).toBe(4);
  const categoryGridMetrics = await grid.evaluate((element) => {
    const gridRect = element.getBoundingClientRect();
    const cardRect = element
      .querySelector<HTMLElement>(".catalog-product-card")
      ?.getBoundingClientRect();
    return { gridWidth: gridRect.width, cardWidth: cardRect?.width ?? 0 };
  });
  expect(categoryGridMetrics.gridWidth).toBeGreaterThan(1290);
  expect(categoryGridMetrics.gridWidth).toBeLessThanOrEqual(1320);
  // 4 columnas sobre 1320px con gap 1.5rem: card ≈ 312px.
  expect(categoryGridMetrics.cardWidth).toBeGreaterThan(295);
  expect(categoryGridMetrics.cardWidth).toBeLessThan(330);
  expect(await grid.locator(".catalog-product-card-image").first().getAttribute("sizes")).toBe(
    "(max-width: 767px) calc((100vw - 2.2rem) / 2), (max-width: 1199px) min(22vw, 11.5rem), min(20vw, 13rem)",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920);
  await revealWholePage(page);
  await page.screenshot({ path: testInfo.outputPath("category-1920x968.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(new URL("/categorias/remeras/", serverUrl).toString());
  const mobileLayout = await layout.evaluate((element) => {
    const toolbar = element.querySelector<HTMLElement>(".solara-category-toolbar");
    const rect = element.getBoundingClientRect();
    const toolbarRect = toolbar?.getBoundingClientRect();
    return {
      columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
      width: rect.width,
      toolbarWidth: toolbarRect?.width ?? 0,
      toolbarScrollWidth: toolbar?.scrollWidth ?? 0,
    };
  });
  expect(mobileLayout.columns).toBe(1);
  expect(mobileLayout.width).toBeLessThanOrEqual(390);
  expect(mobileLayout.toolbarWidth).toBeGreaterThan(300);
  expect(mobileLayout.toolbarScrollWidth).toBeLessThanOrEqual(mobileLayout.toolbarWidth);
  await expect(layout.locator(".solara-category-toolbar span")).toBeVisible();
  await expect(layout.locator(".solara-category-toolbar select")).toBeVisible();
  await expect(filters.locator(".catalog-filter-groups")).toBeHidden();
  await expect(filters.locator("details")).not.toHaveAttribute("open", "");
  await filters.locator("summary").click();
  await expect(filters.locator("details")).toHaveAttribute("open", "");
  await expect(filters.locator(".catalog-filter-groups")).toBeVisible();
  await expect(filters.locator("details > summary .catalog-filter-disclosure")).toBeVisible();
  const mobileFilter = await filters.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      position: style.position,
      bottom: Math.round(innerHeight - rect.bottom),
      width: rect.width,
    };
  });
  expect(mobileFilter.position).toBe("fixed");
  expect(mobileFilter.bottom).toBe(0);
  expect(mobileFilter.width).toBe(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("filters-390x844.png"), fullPage: false });
});

test("V2 presenta PDP editorial y carrito lateral o inferior según viewport", async ({
  page,
}, testInfo) => {
  const productUrl = new URL("/productos/remera-esencial-de-algodon/", serverUrl).toString();
  await page.setViewportSize({ width: 1920, height: 968 });
  await page.goto(productUrl);

  const detail = page.locator(".catalog-product-detail-inner");
  const info = page.locator(".catalog-product-info");
  await expect(detail).toBeVisible();
  expect(await detail.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).toMatch(
    /^\d+(\.\d+)?px \d+(\.\d+)?px$/,
  );
  expect(await info.evaluate((element) => getComputedStyle(element).position)).toBe("sticky");
  const galleryRatio = await page.locator(".catalog-product-gallery-main").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width / rect.height;
  });
  expect(galleryRatio).toBeCloseTo(1, 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920);
  await page.screenshot({ path: testInfo.outputPath("product-1920x968.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(productUrl);
  const mobileDetail = page.locator(".catalog-product-detail-inner");
  const mobileInfo = page.locator(".catalog-product-info");
  const mobileProductMetrics = await mobileDetail.evaluate((element) => {
    const detailRect = element.getBoundingClientRect();
    const gallery = element.querySelector<HTMLElement>(".catalog-product-gallery-main");
    const action = element.querySelector<HTMLElement>(".catalog-product-add");
    return {
      layout: getComputedStyle(element).display,
      detailLeft: detailRect.left,
      detailRight: innerWidth - detailRect.right,
      galleryHeight: gallery?.getBoundingClientRect().height ?? 0,
      actionBottom: action?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY,
      documentWidth: document.documentElement.scrollWidth,
    };
  });
  expect(mobileProductMetrics.layout).toBe("flex");
  expect(mobileProductMetrics.detailLeft).toBeGreaterThanOrEqual(11);
  expect(mobileProductMetrics.detailRight).toBeGreaterThanOrEqual(11);
  expect(mobileProductMetrics.galleryHeight).toBeLessThanOrEqual(520);
  expect(mobileProductMetrics.actionBottom).toBeGreaterThan(0);
  expect(mobileProductMetrics.documentWidth).toBeLessThanOrEqual(390);
  await expect(mobileInfo.getByRole("button", { name: "Agregar al carrito" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("product-390x844.png"), fullPage: true });

  await page.setViewportSize({ width: 1920, height: 968 });
  await page.goto(productUrl);

  await page.getByLabel("Elegí talle y color").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  const drawer = page.locator(".catalog-cart-drawer");
  await expect(drawer).toHaveAttribute("data-open", "true");
  expect(Math.round((await drawer.boundingBox())?.width ?? 0)).toBe(520);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920);
  const drawerBounds = await drawer.evaluate((element) => {
    const drawerRect = element.getBoundingClientRect();
    const targets = [
      element.querySelector("header button"),
      element.querySelector(".solara-cart-line > span:last-child"),
      ...element.querySelectorAll(".catalog-cart-summary strong"),
    ].filter((target): target is Element => target !== null);
    return {
      left: drawerRect.left,
      right: drawerRect.right,
      targets: targets.map((target) => {
        const rect = target.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width };
      }),
    };
  });
  expect(drawerBounds.targets.length).toBeGreaterThanOrEqual(5);
  expect(
    drawerBounds.targets.every(
      (target) => target.left >= drawerBounds.left && target.right <= drawerBounds.right,
    ),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("cart-1920x968.png"), fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  const drawerMetrics = await drawer.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: Math.round(rect.width), bottom: Math.round(innerHeight - rect.bottom) };
  });
  expect(drawerMetrics).toEqual({ width: 390, bottom: 0 });
  await page.screenshot({ path: testInfo.outputPath("cart-390x844.png"), fullPage: false });
});

test("V2 hace accesible el carrusel de testimonios y rotula el footer", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(new URL("/", serverUrl).toString());

  const section = page.locator(".catalog-testimonials-section");
  const track = section.locator(".catalog-testimonials-track");
  const previous = section.getByRole("button", { name: "Testimonio anterior" });
  const next = section.getByRole("button", { name: "Testimonio siguiente" });
  await expect(section.getByRole("group", { name: "Controles de testimonios" })).toBeVisible();
  await expect(track).toHaveAttribute("role", "region");
  await expect(previous).toBeDisabled();
  await expect(previous).toHaveAttribute("aria-disabled", "true");
  await expect(next).toBeEnabled();
  await expect(next).toHaveAttribute("aria-disabled", "false");

  const before = await track.evaluate((element) => element.scrollLeft);
  await next.click();
  await expect.poll(() => track.evaluate((element) => element.scrollLeft)).toBeGreaterThan(before);
  await expect(previous).toBeEnabled();

  await expect(page.locator('.catalog-footer-inner nav[aria-label="Catálogo"] strong')).toHaveText(
    "Explorar",
  );
  await expect(page.locator('.catalog-footer-inner nav[aria-label="Ayuda"] strong')).toHaveText(
    "Ayuda",
  );
  await expect(page.locator(".catalog-footer-inner address strong")).toHaveText("Contacto");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.waitForTimeout(150);
  await revealWholePage(page);
  await page.screenshot({ path: testInfo.outputPath("home-390x844.png"), fullPage: true });

  await page.setViewportSize({ width: 1920, height: 968 });
  await page.goto(new URL("/", serverUrl).toString());
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920);
  await page.waitForTimeout(150);
  await revealWholePage(page);
  await page.screenshot({ path: testInfo.outputPath("home-1920x968.png"), fullPage: true });
});

test("V2 conserva varias líneas del carrito al navegar entre páginas", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 968 });
  const firstProduct = new URL("/productos/remera-esencial-de-algodon/", serverUrl).toString();
  await page.goto(firstProduct);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.locator("[data-cart-count]").first()).toHaveText("1");

  await page.goto(new URL("/productos/remera-grafica-horizonte/", serverUrl).toString());
  await expect(page.locator("[data-cart-count]").first()).toHaveText("1");
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.locator("[data-cart-count]").first()).toHaveText("2");

  await page.goto(new URL("/carrito/", serverUrl).toString());
  await expect(
    page.locator(".solara-cart-page-grid [data-cart-lines] .solara-cart-line"),
  ).toHaveCount(2);
  await expect(page.locator("[data-cart-count]").first()).toHaveText("2");
  await expect(page.locator("[data-cart-drawer] .solara-cart-line")).toHaveCount(2);
});

test("V2 acumula la misma variante sin reemplazarla al volver desde otra página", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 968 });
  const productUrl = new URL("/productos/remera-esencial-de-algodon/", serverUrl).toString();
  await page.goto(productUrl);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.locator("[data-cart-count]").first()).toHaveText("1");

  await page.goto(new URL("/", serverUrl).toString());
  await expect(page.locator("[data-cart-count]").first()).toHaveText("1");
  await page.goto(productUrl);
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.locator("[data-cart-count]").first()).toHaveText("2");

  await page.goto(new URL("/carrito/", serverUrl).toString());
  await expect(
    page.locator(".solara-cart-page-grid [data-cart-lines] .solara-cart-line"),
  ).toHaveCount(1);
  await expect(page.locator(".solara-cart-page [data-cart-quantity]").first()).toHaveValue("2");
});

test("V2 ofrece una salida útil cuando el carrito está vacío", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 968 });
  const cartAction = page.locator("[data-cart-cta]:visible");
  await page.goto(new URL("/carrito/", serverUrl).toString());
  await expect(cartAction).toHaveText("Explorar categorías");
  await expect(cartAction).toHaveAttribute("href", "/categorias/remeras/");

  await page.goto(new URL("/productos/remera-esencial-de-algodon/", serverUrl).toString());
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await page.getByRole("button", { name: "Seguir comprando" }).click();
  await page.goto(new URL("/carrito/", serverUrl).toString());
  await expect(cartAction).toHaveText("Continuar a compra");
  await expect(cartAction).toHaveAttribute("href", "/compra/");
});

test("V2 conserva el carrito cuando la navegación ocurre inmediatamente después de agregar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 968 });
  const firstProduct = new URL("/productos/remera-esencial-de-algodon/", serverUrl).toString();
  await page.goto(firstProduct);
  await page.evaluate(() => localStorage.removeItem("solara-cart:store-catalog-modern-v2"));
  await page.reload();
  await page.getByRole("button", { name: "Agregar al carrito" }).click();

  await page.goto(new URL("/productos/remera-grafica-horizonte/", serverUrl).toString());
  await expect(page.locator("[data-cart-count]").first()).toHaveText("1");
  await page.getByRole("button", { name: "Agregar al carrito" }).click();

  await page.goto(new URL("/carrito/", serverUrl).toString());
  await expect(
    page.locator(".solara-cart-page-grid [data-cart-lines] .solara-cart-line"),
  ).toHaveCount(2);
});

test("V2 recupera el carrito antes de agregar desde una página restaurada", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 968 });
  const firstProduct = new URL("/productos/remera-esencial-de-algodon/", serverUrl).toString();
  const secondProduct = new URL("/productos/remera-grafica-horizonte/", serverUrl).toString();

  await page.goto(firstProduct);
  await page.evaluate(() => localStorage.removeItem("solara-cart:store-catalog-modern-v2"));
  await page.reload();
  await page.goto(secondProduct);
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Remera esencial de algodón");
  await page.getByRole("button", { name: "Agregar al carrito" }).click();

  await page.goForward();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Remera gráfica Horizonte");
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await page.goto(new URL("/carrito/", serverUrl).toString());

  await expect(
    page.locator(".solara-cart-page-grid [data-cart-lines] .solara-cart-line"),
  ).toHaveCount(2);
});

test("V2 conserva el carrito al navegar con enlaces del storefront", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 968 });
  const firstProduct = new URL("/productos/remera-esencial-de-algodon/", serverUrl).toString();
  await page.goto(firstProduct);
  await page.evaluate(() => localStorage.removeItem("solara-cart:store-catalog-modern-v2"));
  await page.reload();
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.locator("[data-cart-count]").first()).toHaveText("1");
  await expect(page.getByRole("button", { name: "Seguir comprando" })).toBeVisible();
  await page.getByRole("button", { name: "Seguir comprando" }).click();

  await page.locator('a[href="/"]').first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("[data-cart-count]").first()).toHaveText("1");

  await page.locator('a[href="/productos/remera-grafica-horizonte/"]').first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Remera gráfica Horizonte");
  await expect(page.locator("[data-cart-count]").first()).toHaveText("1");
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.locator("[data-cart-count]").first()).toHaveText("2");
});

test("V2 envía al checkout todas las líneas agregadas desde páginas distintas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 968 });
  const firstProduct = new URL("/productos/remera-esencial-de-algodon/", serverUrl).toString();
  const secondProduct = new URL("/productos/remera-grafica-horizonte/", serverUrl).toString();
  const checkoutUrl = new URL("/compra/", serverUrl).toString();

  await page.goto(firstProduct);
  await page.evaluate(() => localStorage.removeItem("solara-cart:store-catalog-modern-v2"));
  await page.reload();
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.locator("[data-cart-count]").first()).toHaveText("1");
  await page.getByRole("button", { name: "Seguir comprando" }).click();

  await page.goto(secondProduct);
  await expect(page.locator("[data-cart-count]").first()).toHaveText("1");
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.locator("[data-cart-count]").first()).toHaveText("2");
  await page.getByRole("button", { name: "Seguir comprando" }).click();

  await page.goto(checkoutUrl);
  const fields = page.locator(".solara-checkout-fields");
  const preview = page.locator(".solara-checkout-order-panel [data-order-preview]");
  await fields.locator("#solara-customer-name").fill("Ana Prueba");
  await fields.locator("#solara-customer-phone").fill("5491112345678");
  await fields.locator("#solara-customer-address").fill("Calle de prueba 123");
  await fields.getByRole("button", { name: "Preparar pedido" }).click();

  await expect(preview).toContainText("1 x Remera esencial de algodón");
  await expect(preview).toContainText("1 x Remera gráfica Horizonte");
  await expect(page.locator(".solara-checkout-form-v2 [data-whatsapp-link]")).toBeVisible();
});

test("V2 compone checkout editorial sin overflow en desktop y movil", async ({
  page,
}, testInfo) => {
  const checkoutUrl = new URL("/compra/", serverUrl).toString();
  await page.setViewportSize({ width: 1920, height: 968 });
  await page.goto(checkoutUrl);

  const form = page.locator(".solara-checkout-form-v2");
  const fields = form.locator(".solara-checkout-fields");
  const summary = form.locator(".solara-checkout-order-panel");
  const intro = page.locator(".solara-checkout-page > .solara-page-intro");
  const title = page.getByRole("heading", { level: 1, name: "Coordinar compra" });
  await expect(fields).toBeVisible();
  await expect(summary).toBeVisible();
  await expect(form.locator("[data-whatsapp-link]")).toBeHidden();
  await expect(summary.locator("[data-order-preview]")).toBeHidden();
  expect(
    await title.evaluate((element) => {
      const style = getComputedStyle(element);
      return element.getBoundingClientRect().height / Number.parseFloat(style.lineHeight);
    }),
  ).toBeLessThan(1.25);
  expect(await form.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).toMatch(
    /^\d+(\.\d+)?px \d+(\.\d+)?px$/,
  );
  expect(await summary.evaluate((element) => getComputedStyle(element).position)).toBe("sticky");
  expect((await fields.boundingBox())?.width).toBeGreaterThan(600);
  expect((await summary.boundingBox())?.width).toBeGreaterThan(500);
  const desktopIntroGap = await intro.evaluate((element) => {
    const introBottom = element.getBoundingClientRect().bottom;
    const formTop =
      element.parentElement
        ?.querySelector<HTMLElement>(".solara-checkout-form-v2")
        ?.getBoundingClientRect().top ?? 0;
    return formTop - introBottom;
  });
  expect(desktopIntroGap).toBeLessThanOrEqual(48);
  expect(
    await fields
      .locator("input")
      .first()
      .evaluate((element) => element.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(48);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920);
  await page.screenshot({ path: testInfo.outputPath("checkout-1920x968.png"), fullPage: true });

  await page.goto(new URL("/productos/remera-esencial-de-algodon/", serverUrl).toString());
  await page.getByLabel("Elegí talle y color").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await page.getByRole("button", { name: "Cerrar carrito" }).click();
  await page.goto(checkoutUrl);
  await fields.locator("#solara-customer-name").fill("Ana Prueba");
  await fields.locator("#solara-customer-phone").fill("5491112345678");
  await fields.locator("#solara-customer-address").fill("Calle de prueba 123");
  await fields.getByRole("button", { name: "Preparar pedido" }).click();
  await expect(summary.locator("[data-order-preview]")).toContainText("Remera esencial");
  await expect(form.locator("[data-whatsapp-link]")).toBeVisible();
  await expect(form.locator("[data-whatsapp-link]")).toHaveAttribute("href", /^https:\/\/wa\.me\//);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(checkoutUrl);
  await expect(fields).toBeVisible();
  await expect(summary).toBeVisible();
  await expect(page.locator(".catalog-cart-drawer")).toHaveCSS("visibility", "hidden");
  expect(
    await form.evaluate((element) => getComputedStyle(element).gridTemplateColumns),
  ).not.toMatch(/\s/);
  expect(await summary.evaluate((element) => getComputedStyle(element).position)).toBe("static");
  const mobileIntroGap = await intro.evaluate((element) => {
    const introBottom = element.getBoundingClientRect().bottom;
    const formTop =
      element.parentElement
        ?.querySelector<HTMLElement>(".solara-checkout-form-v2")
        ?.getBoundingClientRect().top ?? 0;
    return formTop - introBottom;
  });
  expect(mobileIntroGap).toBeLessThanOrEqual(40);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("checkout-390x844.png"), fullPage: true });
});

test("V2 mantiene equilibrados el resumen y las líneas del carrito en desktop", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 968 });
  await page.goto(new URL("/productos/remera-esencial-de-algodon/", serverUrl).toString());
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await page.getByRole("button", { name: "Cerrar carrito" }).click();
  await page.goto(new URL("/carrito/", serverUrl).toString());

  const metrics = await page.locator(".solara-cart-page-grid").evaluate((element) => {
    const style = getComputedStyle(element);
    const summary = element.querySelector<HTMLElement>(":scope > aside")?.getBoundingClientRect();
    return {
      columnGap: Number.parseFloat(style.columnGap),
      summaryWidth: summary?.width ?? 0,
      documentWidth: document.documentElement.scrollWidth,
    };
  });
  expect(metrics.columnGap).toBeLessThanOrEqual(80);
  expect(metrics.summaryWidth).toBeLessThanOrEqual(384);
  expect(metrics.documentWidth).toBeLessThanOrEqual(1920);
});

test("V2 conserva carrito y checkout dentro del viewport intermedio", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const checkoutUrl = new URL("/compra/", serverUrl).toString();
  await page.goto(checkoutUrl);

  const checkoutMetrics = await page.evaluate(() => {
    const rectOf = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
    };
    return {
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      form: rectOf(".solara-checkout-form-v2"),
      fields: rectOf(".solara-checkout-fields"),
      summary: rectOf(".solara-checkout-order-panel"),
      button: rectOf(".solara-checkout-fields .solara-primary-action"),
    };
  });
  expect(checkoutMetrics.documentWidth).toBeLessThanOrEqual(1024);
  expect(checkoutMetrics.bodyWidth).toBeLessThanOrEqual(1024);
  expect(checkoutMetrics.form?.right ?? 0).toBeLessThanOrEqual(1024);
  expect(checkoutMetrics.fields?.width ?? 0).toBeGreaterThan(0);
  expect(checkoutMetrics.summary?.width ?? 0).toBeGreaterThanOrEqual(300);
  expect(checkoutMetrics.button?.height ?? 0).toBeGreaterThanOrEqual(48);

  await page.goto(new URL("/productos/remera-esencial-de-algodon/", serverUrl).toString());
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await page.getByRole("button", { name: "Cerrar carrito" }).click();
  await page.goto(new URL("/carrito/", serverUrl).toString());

  const cartMetrics = await page.evaluate(() => {
    const rectOf = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
    };
    return {
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      grid: rectOf(".solara-cart-page-grid"),
      line: rectOf(".solara-cart-page-grid [data-cart-lines] .solara-cart-line"),
      summary: rectOf(".solara-cart-page-grid > aside"),
      button: rectOf(
        ".solara-cart-page-grid > aside [data-cart-cta]:not([hidden]) .solara-primary-action",
      ),
    };
  });
  expect(cartMetrics.documentWidth).toBeLessThanOrEqual(1024);
  expect(cartMetrics.bodyWidth).toBeLessThanOrEqual(1024);
  expect(cartMetrics.grid?.right ?? 0).toBeLessThanOrEqual(1024);
  expect(cartMetrics.line?.width ?? 0).toBeGreaterThan(0);
  expect(cartMetrics.summary?.width ?? 0).toBeGreaterThanOrEqual(300);
  expect(cartMetrics.button?.height ?? 0).toBeGreaterThanOrEqual(44);
});

test("V2 conserva nombres accesibles, foco visible y navegacion por teclado", async ({ page }) => {
  const routes = [
    "/",
    "/categorias/remeras/",
    "/productos/remera-esencial-de-algodon/",
    "/compra/",
  ];

  for (const route of routes) {
    await page.goto(new URL(route, serverUrl).toString());
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const audit = await page.evaluate(() => {
      const ids = [...document.querySelectorAll<HTMLElement>("[id]")].map((element) => element.id);
      const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
      const unnamed = [
        ...document.querySelectorAll<HTMLElement>("a, button, input, select, textarea, summary"),
      ]
        .filter((element) => {
          const style = getComputedStyle(element);
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            !element.closest("[inert]") &&
            !(element instanceof HTMLInputElement && element.type === "hidden")
          );
        })
        .filter((element) => {
          const explicitName =
            element.getAttribute("aria-label")?.trim() ||
            element.getAttribute("title")?.trim() ||
            element.textContent?.trim();
          const labelledInput =
            (element instanceof HTMLInputElement ||
              element instanceof HTMLSelectElement ||
              element instanceof HTMLTextAreaElement) &&
            element.labels &&
            element.labels.length > 0;
          return !explicitName && !labelledInput;
        })
        .map((element) => `${element.tagName.toLowerCase()}#${element.id}`);
      return { duplicateIds: [...new Set(duplicateIds)], unnamed };
    });
    expect(audit).toEqual({ duplicateIds: [], unnamed: [] });
  }

  const checkoutName = page.locator("#solara-customer-name");
  await checkoutName.focus();
  expect(
    await checkoutName.evaluate((element) => {
      const style = getComputedStyle(element);
      return style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) >= 2;
    }),
  ).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(serverUrl);
  const openMenu = page.getByRole("button", { name: "Abrir menú" });
  await openMenu.focus();
  await page.keyboard.press("Enter");
  const mobileMenu = page.locator("#catalog-mobile-menu");
  await expect(mobileMenu).toBeVisible();
  const openMenuMetrics = await mobileMenu.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      height: rect.height,
      width: rect.width,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    };
  });
  expect(openMenuMetrics.height).toBeGreaterThan(800);
  expect(openMenuMetrics.width).toBeLessThanOrEqual(374);
  expect(openMenuMetrics.scrollWidth).toBeLessThanOrEqual(openMenuMetrics.clientWidth);
  await expect(page.getByRole("button", { name: "Cerrar menú" })).toBeFocused();
  await mobileMenu.locator(".catalog-mobile-categories > summary").click();
  await mobileMenu.locator(".catalog-mobile-category > summary").first().click();
  expect(
    await mobileMenu.evaluate((element) => element.getBoundingClientRect().height),
  ).toBeGreaterThan(800);
  await page.keyboard.press("Escape");
  await expect(page.locator("#catalog-mobile-menu")).toBeHidden();
  await expect(openMenu).toBeFocused();
});

test("V2 indica la ruta activa en la navegacion", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 968 });
  await page.goto(new URL("/contacto/", serverUrl).toString());
  const activeDesktopLink = page.locator('.catalog-desktop-nav [aria-current="page"]');
  await expect(activeDesktopLink).toHaveText("Contacto");
  expect(
    await activeDesktopLink.evaluate((element) => getComputedStyle(element, "::after").transform),
  ).not.toBe("matrix(0, 0, 0, 1, 0, 0)");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(new URL("/categorias/remeras/", serverUrl).toString());
  await page.locator("[data-catalog-menu-open]").click();
  await expect(
    page.locator('.catalog-mobile-categories > summary[aria-current="page"]'),
  ).toBeVisible();
});

test("V2 conserva contenido y compra directa sin JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(new URL("/productos/remera-esencial-de-algodon/", serverUrl).toString());
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Remera esencial de algodón");
  await expect(page.locator("a.catalog-add-fallback")).toBeVisible();
  await expect(page.locator(".catalog-product-add")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await page.goto(serverUrl);
  await expect(page.locator("#catalog-mobile-menu")).toBeVisible();
  await expect(page.locator(".catalog-product-card").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await context.close();
});

test("V2 activa appear progresivo y compacta el header al hacer scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 968 });
  await page.goto(serverUrl);

  const header = page.locator('[data-solara-module="catalog-header"]');
  const headerInner = header.locator(".catalog-header-inner");
  const products = page.locator('[data-solara-section="modo-section-new"]');
  const initialHeight = (await headerInner.boundingBox())?.height ?? 0;
  await expect(products).not.toHaveAttribute("data-motion-visible", "true");

  await products.evaluate((element) =>
    window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 160 }),
  );
  await expect(products).toHaveAttribute("data-motion-visible", "true");
  await expect(header).toHaveAttribute("data-scrolled", "true");
  await expect
    .poll(async () => (await headerInner.boundingBox())?.height ?? initialHeight)
    .toBeLessThan(initialHeight);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(products).toHaveAttribute("data-motion-visible", "true");
  await expect(products.locator("[data-motion-zone]")).toHaveCSS("animation-name", "none");
});

test("V2 mantiene todas las rutas sin overflow en tablet y laptop", async ({ page }) => {
  const routes = [
    "/",
    "/categorias/remeras/",
    "/productos/remera-esencial-de-algodon/",
    "/buscar/",
    "/carrito/",
    "/compra/",
    "/nosotros/",
    "/contacto/",
    "/envios/",
    "/devoluciones/",
    "/privacidad/",
    "/terminos/",
    "/404.html",
  ] as const;

  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(new URL(route, serverUrl).toString());
      await expect(page.locator('[data-design-family="catalog-modern-v2"]')).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      const metrics = await page.evaluate(() => {
        const root = document.querySelector<HTMLElement>("[data-solara-store]");
        const rootRect = root?.getBoundingClientRect();
        return {
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          rootLeft: rootRect?.left ?? -1,
          rootRight: rootRect?.right ?? Number.POSITIVE_INFINITY,
        };
      });
      expect(
        metrics.documentWidth,
        `${route} @ ${viewport.width}x${viewport.height}`,
      ).toBeLessThanOrEqual(viewport.width);
      expect(
        metrics.bodyWidth,
        `${route} body @ ${viewport.width}x${viewport.height}`,
      ).toBeLessThanOrEqual(viewport.width);
      expect(metrics.clientWidth).toBe(viewport.width);
      expect(metrics.rootLeft).toBeGreaterThanOrEqual(0);
      expect(metrics.rootRight).toBeLessThanOrEqual(viewport.width);
    }
  }
});

test("V2 conserva estabilidad visual y feedback inmediato", async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as Window & { __solaraLayoutShift?: number };
    state.__solaraLayoutShift = 0;
    const observer = new PerformanceObserver((list) => {
      for (const item of list.getEntries()) {
        const shift = item as PerformanceEntry & { hadRecentInput: boolean; value: number };
        if (!shift.hadRecentInput)
          state.__solaraLayoutShift = (state.__solaraLayoutShift ?? 0) + shift.value;
      }
    });
    observer.observe({ type: "layout-shift", buffered: true });
  });

  await page.setViewportSize({ width: 1920, height: 968 });
  await page.goto(serverUrl);
  await page.waitForFunction(() =>
    [...document.images].every((image) => image.complete && image.naturalWidth > 0),
  );
  await revealWholePage(page);
  await page.waitForTimeout(750);
  const layoutShift = await page.evaluate(
    () => (window as Window & { __solaraLayoutShift?: number }).__solaraLayoutShift ?? 0,
  );
  expect(layoutShift).toBeLessThanOrEqual(0.05);

  await page.goto(new URL("/productos/remera-esencial-de-algodon/", serverUrl).toString());
  await page.getByLabel("Elegí talle y color").selectOption({ index: 1 });
  const responseMs = await page.getByRole("button", { name: "Agregar al carrito" }).evaluate(
    (button) =>
      new Promise<number>((resolve, reject) => {
        const drawer = document.querySelector<HTMLElement>(".catalog-cart-drawer");
        if (!drawer) {
          reject(new Error("No se encontró el drawer de carrito."));
          return;
        }
        const startedAt = performance.now();
        const observer = new MutationObserver(() => {
          if (drawer.dataset.open === "true") {
            observer.disconnect();
            resolve(performance.now() - startedAt);
          }
        });
        observer.observe(drawer, { attributes: true, attributeFilter: ["data-open"] });
        (button as HTMLButtonElement).click();
      }),
  );
  expect(responseMs).toBeLessThan(100);
  await expect(page.locator(".catalog-cart-drawer")).toHaveAttribute("data-open", "true");
});

test("V2 presenta resultados de búsqueda en grilla editorial", async ({ page }, testInfo) => {
  const searchUrl = new URL("/buscar/?q=remera", serverUrl).toString();
  for (const viewport of [
    { width: 1920, height: 968, columns: 6 },
    { width: 1024, height: 768, columns: 3 },
    { width: 390, height: 844, columns: 2 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(searchUrl);
    const results = page.locator(".solara-search-results-grid");
    await expect(results).toBeVisible();
    await expect(results.locator(".solara-search-result").first()).toBeVisible();
    await expect(page.locator(".solara-search-summary").first()).toHaveText(
      /^\d+ resultados para “remera”$/,
    );
    await expect(results.locator("img").first()).toHaveAttribute(
      "sizes",
      "(max-width: 767px) 46vw, (max-width: 1199px) 18rem, 13rem",
    );
    if (viewport.width >= 1024) {
      const resultsMetrics = await results.evaluate((element) => {
        const gridRect = element.getBoundingClientRect();
        const cardRect = element
          .querySelector<HTMLElement>(".solara-search-result")
          ?.getBoundingClientRect();
        return {
          gridWidth: gridRect.width,
          cardWidth: cardRect?.width ?? 0,
        };
      });
      if (viewport.width === 1920) {
        expect(resultsMetrics.gridWidth).toBeGreaterThan(1290);
        expect(resultsMetrics.gridWidth).toBeLessThanOrEqual(1320);
        expect(resultsMetrics.cardWidth).toBeGreaterThan(195);
        expect(resultsMetrics.cardWidth).toBeLessThan(215);
      } else {
        expect(resultsMetrics.gridWidth).toBeGreaterThan(950);
        expect(resultsMetrics.gridWidth).toBeLessThanOrEqual(1000);
        expect(resultsMetrics.cardWidth).toBeGreaterThan(300);
        expect(resultsMetrics.cardWidth).toBeLessThan(340);
      }
    }
    expect(
      await results.evaluate(
        (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length,
      ),
    ).toBe(viewport.columns);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width,
    );
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) animation.finish();
    });
    await page.screenshot({
      path: testInfo.outputPath(`search-results-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    });
  }
});

test("V2 envuelve el título de categoría en la caja frosted glass", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 968 });
  await page.goto(new URL("/categorias/remeras/", serverUrl).toString());
  await expect(page.locator('[data-design-family="catalog-modern-v2"]')).toBeVisible();
  const glass = page.locator(".solara-category-title-glass");
  await expect(glass).toBeVisible();
  await expect(glass).toHaveText("Remeras");
  expect(await glass.evaluate((element) => getComputedStyle(element).backdropFilter)).not.toBe(
    "none",
  );
});

test("V2 mantiene rutas secundarias legibles y sin overflow", async ({ page }, testInfo) => {
  const routes = [
    ["buscar", "/buscar/"],
    ["carrito", "/carrito/"],
    ["nosotros", "/nosotros/"],
    ["contacto", "/contacto/"],
    ["envios", "/envios/"],
    ["devoluciones", "/devoluciones/"],
    ["privacidad", "/privacidad/"],
    ["terminos", "/terminos/"],
    ["404", "/404.html"],
  ] as const;

  for (const viewport of [
    { width: 1920, height: 968, label: "desktop" },
    { width: 390, height: 844, label: "mobile" },
  ]) {
    await page.setViewportSize(viewport);
    for (const [name, route] of routes) {
      await page.goto(new URL(route, serverUrl).toString());
      await expect(page.locator('[data-design-family="catalog-modern-v2"]')).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${name} ${viewport.label}`,
      ).toBeLessThanOrEqual(viewport.width);
      if (["envios", "devoluciones", "privacidad", "terminos"].includes(name)) {
        const policyPage = page.locator(".solara-policy-page");
        await expect(policyPage.locator(".solara-story-grid")).toBeVisible();
        await expect(policyPage.getByRole("heading", { level: 2 })).toHaveCount(
          name === "envios" ? 5 : name === "devoluciones" ? 4 : 2,
        );
      }
      if (name === "envios") {
        await expect(page.locator(".solara-policy-page .solara-values-grid article")).toHaveCount(
          3,
        );
      }
      if (name === "404") {
        await expect(page.locator(".solara-error-code")).toHaveAttribute("aria-hidden", "true");
        await expect(page.getByRole("link", { name: "Volver al inicio" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Ver categorías" })).toBeVisible();
        if (viewport.width === 1920) {
          const errorHero = await page.locator(".solara-error-hero").boundingBox();
          expect(errorHero?.height ?? 0).toBeLessThanOrEqual(520);
        }
      }
      if (name !== "buscar" && name !== "carrito") {
        await page.evaluate(() => {
          for (const animation of document.getAnimations()) animation.finish();
        });
        await page.screenshot({
          path: testInfo.outputPath(`${name}-${viewport.width}x${viewport.height}.png`),
          fullPage: true,
        });
      }
    }
    await page.goto(new URL("/buscar/", serverUrl).toString());
    const searchTitle = page.getByRole("heading", { level: 1, name: "Buscar productos" });
    const searchHelp = page.getByText("Buscá por nombre, marca, categoría o etiqueta.");
    const [titleBox, helpBox] = await Promise.all([
      searchTitle.boundingBox(),
      searchHelp.boundingBox(),
    ]);
    expect(titleBox).not.toBeNull();
    expect(helpBox).not.toBeNull();
    expect(
      (helpBox?.y ?? 0) - ((titleBox?.y ?? 0) + (titleBox?.height ?? 0)),
    ).toBeGreaterThanOrEqual(8);
    const searchForm = page.locator(".solara-search-form");
    const searchInputBox = await searchForm
      .getByRole("searchbox", { name: "Buscar productos" })
      .boundingBox();
    const searchButtonBox = await searchForm.getByRole("button", { name: "Buscar" }).boundingBox();
    expect(searchInputBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(searchButtonBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    if (viewport.label === "desktop") {
      expect(searchInputBox?.width ?? 0).toBeGreaterThanOrEqual(720);
      expect(searchButtonBox?.y).toBe(searchInputBox?.y);
    } else {
      expect(searchInputBox?.width ?? 0).toBeGreaterThanOrEqual(350);
      expect(searchButtonBox?.width ?? 0).toBeGreaterThanOrEqual(350);
      expect(searchButtonBox?.y ?? 0).toBeGreaterThan((searchInputBox?.y ?? 0) + 44);
    }
    await page.screenshot({
      path: testInfo.outputPath(`search-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    });

    await page.goto(new URL("/productos/remera-esencial-de-algodon/", serverUrl).toString());
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByLabel("Elegí talle y color").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Agregar al carrito" }).click();
    await page.getByRole("button", { name: "Cerrar carrito" }).click();
    await page.goto(new URL("/carrito/", serverUrl).toString());
    await expect(
      page.locator(".solara-cart-page-grid [data-cart-lines] .solara-cart-line"),
    ).toHaveCount(1);
    const cartSummary = page.locator(".solara-cart-page-grid > aside");
    const cartSummaryBox = await cartSummary.boundingBox();
    const summaryAmount = cartSummary.locator("strong").first();
    const summaryTypography = await summaryAmount.evaluate((element) => {
      const styles = getComputedStyle(element);
      return { family: styles.fontFamily, size: Number.parseFloat(styles.fontSize) };
    });
    expect(summaryTypography.family.toLowerCase()).not.toContain("georgia");
    expect(summaryTypography.size).toBeLessThanOrEqual(24);
    if (viewport.label === "desktop") {
      expect(cartSummaryBox?.width ?? 0).toBeGreaterThanOrEqual(360);
    } else {
      expect(cartSummaryBox?.width ?? 0).toBeGreaterThanOrEqual(350);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width,
    );
    await page.screenshot({
      path: testInfo.outputPath(`cart-page-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    });
  }
});

test("V1 y V2 conservan contenido y aislamiento en capturas equivalentes", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 968 });
  const v1HtmlFile = exportedV1.files.get("index.html");
  const v1CssFile = [...exportedV1.files.entries()].find(([path]) => path.endsWith(".css"))?.[1];
  if (!v1HtmlFile) throw new Error("La exportación V1 no generó index.html.");
  if (!v1CssFile) throw new Error("La exportación V1 no generó styles.css.");
  const v1Html = (
    typeof v1HtmlFile === "string" ? v1HtmlFile : new TextDecoder().decode(v1HtmlFile)
  ).replace(
    "</head>",
    `<base href="${serverUrl}/"><style>${typeof v1CssFile === "string" ? v1CssFile : new TextDecoder().decode(v1CssFile)}</style></head>`,
  );
  await page.setContent(v1Html, { waitUntil: "networkidle" });
  await expect(page.locator('[data-design-family="catalog-modern-v1"]')).toBeVisible();
  await expect(page.locator(".cm.v2")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Vestite con lo que te representa.",
  );
  await expect(page.locator(".catalog-hero-inner")).toHaveCSS("display", "grid");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920);
  await revealWholePage(page);
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) animation.finish();
  });
  await page.screenshot({
    path: testInfo.outputPath("comparison-v1-1920x968.png"),
    fullPage: true,
  });

  await page.goto(serverUrl);
  await expect(page.locator('[data-design-family="catalog-modern-v2"]')).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Vestite con lo que te representa.",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920);
  await revealWholePage(page);
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) animation.finish();
  });
  await page.screenshot({
    path: testInfo.outputPath("comparison-v2-1920x968.png"),
    fullPage: true,
  });
});
