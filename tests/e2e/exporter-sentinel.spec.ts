import { expect, test } from "@playwright/test";
import { exportProject } from "@solara/exporter";
import { CATALOG_MODERN_PLACEHOLDER_PHONE } from "@solara/project-schema";
import { catalogModernStore } from "@solara/project-schema/catalog-modern-fixture";
import { buildCatalogModernProject } from "@solara/project-schema/catalog-modern-template";

const PLACEHOLDER = "5491100000000";

test("una tienda limpia exporta un sitio sin el teléfono de plantilla", () => {
  const clean = buildCatalogModernProject({ seed: "clean" });
  const exported = exportProject(clean as never, { mode: "draft" });
  for (const [path, content] of exported.files) {
    expect(String(content), `archivo ${path}`).not.toContain(PLACEHOLDER);
  }
  const home = String(exported.files.get("index.html"));
  expect(home).not.toContain("data-whatsapp=");
  expect(home).not.toContain("data-whatsapp-greeting=");
  expect(home).not.toContain("data-whatsapp-include-sku=");
  expect(String(exported.files.get("contacto/index.html"))).not.toContain("wa.me");
  const checkout = String(exported.files.get("compra/index.html"));
  expect(checkout).not.toContain(PLACEHOLDER);
  expect(checkout).not.toContain("data-whatsapp-link");
});

test("un proyecto con teléfono sentinel no publica el número ni en el detalle de producto", () => {
  const demo = buildCatalogModernProject({ seed: "demo" });
  demo.whatsapp.phone = CATALOG_MODERN_PLACEHOLDER_PHONE;
  const exported = exportProject(demo as never, { mode: "draft" });
  for (const [path, content] of exported.files) {
    expect(String(content), `archivo ${path}`).not.toContain(PLACEHOLDER);
  }
  const product = String(exported.files.get("productos/remera-esencial-de-algodon/index.html"));
  expect(product).not.toContain("wa.me");
  expect(product).not.toContain("catalog-add-fallback");
});

test("la demo con teléfono real conserva el contrato data-whatsapp del sitio", () => {
  const exported = exportProject(buildCatalogModernProject({ seed: "demo" }) as never, {
    mode: "production",
  });
  const home = String(exported.files.get("index.html"));
  expect(home).toContain('data-whatsapp="5491123456789"');
  expect(home).toContain(
    `data-whatsapp-greeting="Hola ${catalogModernStore.identity.brandName}, quiero hacer este pedido:"`,
  );
  expect(home).toContain('data-whatsapp-include-sku="true"');
});
