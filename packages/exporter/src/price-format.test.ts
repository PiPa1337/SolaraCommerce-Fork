import { catalogModernV2Store } from "@solara/project-schema/catalog-modern-v2-fixture";
import { formatPrice } from "@solara/project-schema/money";
import { describe, expect, it } from "vitest";
import { exportProject, renderPreviewHtml } from "./index";

function htmlFor(project: any, path = "/") {
  const html = renderPreviewHtml(project, "draft", path);
  return html;
}

describe("priceFractionDisplay", () => {
  it("always: 1500,00 se muestra con centavos en preview y export", () => {
    const p: any = structuredClone(catalogModernV2Store);
    p.priceFractionDisplay = "always";
    // usar primer producto, forzar precio 150000 = 1500,00
    p.products[0].variants[0].price = 150000;
    p.products[0].variants[0].compareAtPrice = undefined;
    const preview = htmlFor(p, "/");
    const exported = String(exportProject(p, { mode: "draft" }).files.get("index.html"));
    // ambos deben contener $ 1.500,00 (o $1.500,00) y no $ 1.500 solo
    expect(preview.replace("\u00A0", " ")).toContain("1.500,00");
    expect(exported.replace("\u00A0", " ")).toContain("1.500,00");
  });

  it("auto: 1500,00 se muestra sin centavos, 1500,50 con centavos", () => {
    const p: any = structuredClone(catalogModernV2Store);
    p.priceFractionDisplay = "auto";
    p.products[0].variants[0].price = 150000;
    p.products[1].variants[0].price = 150050;
    const preview = htmlFor(p, "/");
    const exported = String(exportProject(p, { mode: "draft" }).files.get("index.html"));
    // preview debe tener 1.500 sin ,00 y 1.500,50
    // Normalizar para chequear: 1.500 sin coma es entero
    const previewNorm = preview.replace(/\u00A0/g, " ");
    const exportedNorm = exported.replace(/\u00A0/g, " ");
    // precio entero debe aparecer como $ 1.500 (sin ,00)
    expect(previewNorm).toMatch(/1\.500(?!,00)/);
    expect(exportedNorm).toMatch(/1\.500(?!,00)/);
    // precio fraccionario debe mantener ,50
    expect(previewNorm).toContain("1.500,50");
    expect(exportedNorm).toContain("1.500,50");
  });

  it("edge cases: 0,00 -> 0 y 0,01 -> 0,01 en auto", () => {
    const p: any = structuredClone(catalogModernV2Store);
    p.priceFractionDisplay = "auto";
    p.products[0].variants[0].price = 0;
    p.products[1].variants[0].price = 1;
    p.products[2].variants[0].price = 99;
    p.products[3].variants[0].price = 100;
    const preview = htmlFor(p, "/").replace(/\u00A0/g, " ");
    expect(preview).toContain("$ 0");
    expect(preview).not.toContain("$ 0,00");
    expect(preview).toContain("$ 0,01");
    expect(preview).toContain("$ 0,99");
    expect(preview).toContain("$ 1");
  });

  it("machine-readable no cambia con display", () => {
    const pAlways: any = structuredClone(catalogModernV2Store);
    pAlways.priceFractionDisplay = "always";
    pAlways.products[0].variants[0].price = 150000;
    const pAuto: any = structuredClone(catalogModernV2Store);
    pAuto.priceFractionDisplay = "auto";
    pAuto.products[0].variants[0].price = 150000;
    const alwaysExport = exportProject(pAlways, { mode: "production" });
    const autoExport = exportProject(pAuto, { mode: "production" });
    // JSON-LD debe ser 1500.00 con punto y 2 decimales en ambos
    const alwaysHtml = String(
      alwaysExport.files.get(`productos/${pAlways.products[0].slug}/index.html`),
    );
    const autoHtml = String(autoExport.files.get(`productos/${pAuto.products[0].slug}/index.html`));
    const jsonLdAlways = [
      ...alwaysHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
    ]
      .map((m) => JSON.parse(m[1]!))
      .find((j) => j["@type"] === "Product" || j["@type"] === "ProductGroup");
    const jsonLdAuto = [
      ...autoHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
    ]
      .map((m) => JSON.parse(m[1]!))
      .find((j) => j["@type"] === "Product" || j["@type"] === "ProductGroup");
    // la oferta dentro de hasVariant o directa debe tener price 1500.00
    const alwaysOffer = jsonLdAlways?.hasVariant?.[0]?.offers ?? jsonLdAlways?.offers;
    const autoOffer = jsonLdAuto?.hasVariant?.[0]?.offers ?? jsonLdAuto?.offers;
    expect(alwaysOffer?.price).toBe("1500.00");
    expect(autoOffer?.price).toBe("1500.00");
    // catalog-index debe ser entero 150000 en ambos
    const alwaysCatalog = JSON.parse(String(alwaysExport.files.get("catalog-index.json")));
    const autoCatalog = JSON.parse(String(autoExport.files.get("catalog-index.json")));
    const alwaysEntry = alwaysCatalog.find(
      (e: any) => e.variantId === pAlways.products[0].variants[0].id,
    );
    const autoEntry = autoCatalog.find(
      (e: any) => e.variantId === pAuto.products[0].variants[0].id,
    );
    expect(alwaysEntry.price).toBe(150000);
    expect(autoEntry.price).toBe(150000);
    // data-price atributo debe ser entero
    expect(alwaysHtml).toContain(`data-price="150000"`);
    expect(autoHtml).toContain(`data-price="150000"`);
  });

  it("data-price-fraction-display refleja el proyecto", () => {
    const pAlways: any = structuredClone(catalogModernV2Store);
    pAlways.priceFractionDisplay = "always";
    const pAuto: any = structuredClone(catalogModernV2Store);
    pAuto.priceFractionDisplay = "auto";
    const htmlAlways = String(exportProject(pAlways, { mode: "draft" }).files.get("index.html"));
    const htmlAuto = String(exportProject(pAuto, { mode: "draft" }).files.get("index.html"));
    expect(htmlAlways).toContain('data-price-fraction-display="always"');
    expect(htmlAuto).toContain('data-price-fraction-display="auto"');
  });

  it("total $2000,00 con auto muestra $2000 (suma de 1000,50+999,50)", () => {
    const p: any = structuredClone(catalogModernV2Store);
    p.priceFractionDisplay = "auto";
    // usar dos productos para simular carrito: uno 100050, otro 99950
    p.products[0].variants[0].price = 100050;
    p.products[1].variants[0].price = 99950;
    // el carrito no se exporta como precio visible fijo, pero el total del carrito en export es 0 (vacío)
    // Verificamos que cada producto individual se formatee correctamente
    const preview = htmlFor(p, "/").replace(/\u00A0/g, " ");
    expect(preview).toContain("1.000,50");
    expect(preview).toContain("999,50");
    // la suma 200000 = 2000,00 debe ser $2.000 con auto
    expect(formatPrice(200000, { priceFractionDisplay: "auto" }).replace("\u00A0", " ")).toBe(
      "$ 2.000",
    );
    expect(formatPrice(200000, { priceFractionDisplay: "always" }).replace("\u00A0", " ")).toBe(
      "$ 2.000,00",
    );
  });
});
