import { it } from "vitest";
import { evaluateCatalogModernReadiness } from "./catalog-modern-guidance.ts";
import { buildCatalogModernProject } from "./catalog-modern-template.ts";
import { auditProject } from "../../../packages/exporter/src/index.ts";
import type { StoreProjectV2 } from "./index.ts";

it("probe pr8 journey", () => {
  const project = buildCatalogModernProject({ seed: "clean" }) as unknown as StoreProjectV2;
  project.identity.brandName = "Tienda PR8";
  project.identity.description = "Tazas y vasos de cerámica artesanal esmaltada a mano.";
  project.identity.email = "hola@tienda-pr8.example";
  project.whatsapp.phone = "5491123456789";
  project.whatsapp.greeting = "Hola, quiero hacer este pedido:";
  project.baseUrl = "https://tienda-pr8.example";
  const about = project.pages.find((p) => p.kind === "about");
  const contact = project.pages.find((p) => p.kind === "contact");
  if (about) about.title = "Nuestra historia en cerámica.";
  if (contact) contact.title = "Escribinos por WhatsApp.";
  project.seo.title = "Tienda PR8";
  project.seo.description = "Catálogo de cerámica artesanal hecha a mano, pieza por pieza.";
  const hero = project.sections.find((s) => s.id === "modo-section-hero");
  if (hero) {
    hero.settings.eyebrow = "Cerámica artesanal";
    hero.settings.title = "Piezas hechas a mano para tu mesa.";
    hero.settings.body = "Cada pieza sale del horno con su propia historia.";
  }
  project.assets.forEach((asset, i) => {
    asset.name = `foto-pr8-ceramica-${i}.png`;
    asset.alt = "Fotografía de cerámica artesanal esmaltada";
  });
  project.assets.push({
    id: "asset-taza-pr8",
    name: "imagenes/taza-pr8.png",
    alt: "Taza de cerámica esmaltada a mano.",
  });
  project.categories.push(
    { id: "category-ceramica", title: "Cerámica", slug: "ceramica", description: "", productIds: [], imageId: null },
    { id: "category-vasos", title: "Vasos", slug: "vasos", description: "", productIds: [], imageId: null },
  );
  project.products.push({
    id: "product-taza-pr8",
    title: "Taza PR8",
    slug: "taza-pr8",
    description: "Taza de cerámica esmaltada a mano.",
    status: "active",
    brand: "PR8 Cerámica",
    tags: [],
    categoryIds: ["category-ceramica", "category-vasos"],
    collectionIds: [],
    imageIds: ["asset-taza-pr8"],
    variants: [{ id: "variant-taza-pr8", sku: "TAZA-PR8-01", price: 125000, compareAtPrice: null, options: {}, stockStatus: "in_stock", available: true }],
    createdAt: "", updatedAt: "",
  });
  const r = evaluateCatalogModernReadiness(project);
  console.log(
    "PR8-JOURNEY:",
    JSON.stringify({ total: r.requirements.length, ready: r.ready, pending: r.pending, percent: r.percent }),
  );
  console.log("PR8-JOURNEY pending ids:", JSON.stringify(r.requirements.filter((x) => x.status !== "ready").map((x) => x.id)));
  console.log("PR8-JOURNEY ready ids:", JSON.stringify(r.requirements.filter((x) => x.status === "ready").map((x) => x.id)));
  console.log("PR8 criticals:", JSON.stringify(auditProject(project as never).filter((i) => i.severity === "critical").map((i) => i.code)));
});

it("probe clean matrix", () => {
  const clean = buildCatalogModernProject({ seed: "clean" }) as unknown as StoreProjectV2;
  clean.identity.brandName = "Tienda PR3 progreso";
  clean.seo.title = "Tienda PR3 progreso";
  const r = evaluateCatalogModernReadiness(clean);
  console.log("CLEAN ids:", JSON.stringify(r.requirements.map((x) => `${x.id}:${x.status}`)));
});

it("probe pr3 completed", () => {
  const clean = buildCatalogModernProject({ seed: "clean" }) as unknown as StoreProjectV2;
  clean.identity.description = "Textiles artesanales de estación para todos los días.";
  const r = evaluateCatalogModernReadiness(clean);
  console.log(
    "PR3-COMPLETED:",
    JSON.stringify({ ready: r.ready, pending: r.pending, percent: r.percent }),
  );
});

it("probe demo asset ids", () => {
  const demo = buildCatalogModernProject({ seed: "demo" }) as unknown as StoreProjectV2;
  console.log("DEMO asset ids:", JSON.stringify(demo.assets.map((a) => a.id)));
  const product = demo.products[0];
  console.log("DEMO p0:", JSON.stringify({ id: product.id, title: product.title, categoryIds: product.categoryIds }));
  const d2 = structuredClone(demo);
  d2.products[0].description = "";
  d2.assets[0].alt = "";
  const r = evaluateCatalogModernReadiness(d2);
  console.log("DEMO-PEND:", JSON.stringify(r.requirements.filter((x) => x.status !== "ready").map((x) => x.id)));
});
