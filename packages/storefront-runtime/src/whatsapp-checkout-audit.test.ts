import { referenceStore } from "@solara/project-schema/fixture";
import { describe, expect, it } from "vitest";
import type { CartLine, CatalogIndexEntry } from "./index";
import {
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  formatMoney,
  parseCart,
  reconcileCartLines,
  STOREFRONT_RUNTIME_JS,
} from "./index";

function makeProduct(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productId: "p1",
    variantId: "v1",
    title: "Producto Base",
    variantTitle: "Variante Base",
    sku: "SKU-001",
    unitPrice: 150000,
    quantity: 1,
    ...overrides,
  };
}
function makeStore(overrides: any = {}) {
  return {
    ...referenceStore,
    ...overrides,
    whatsapp: { ...referenceStore.whatsapp, ...(overrides.whatsapp || {}) },
    publicCopy: { ...referenceStore.publicCopy, ...(overrides.publicCopy || {}) },
  };
}
describe("AUDITORIA WhatsApp checkout - matriz completa", () => {
  it("un producto: calculo exacto y encoding", () => {
    const line = makeProduct({
      unitPrice: 150000,
      quantity: 1,
      title: "Remera",
      variantTitle: "M",
    });
    const store = makeStore();
    const msg = buildWhatsAppMessage(store as any, [line], {
      name: "Ana",
      phone: "11 5555 1111",
      address: "CABA",
      notes: "",
    });
    expect(msg).toContain("1 x Remera (M)");
    expect(msg).toContain(formatMoney(150000));
    const url = buildWhatsAppUrl("5491123456789", msg);
    expect(url).toContain("https://wa.me/5491123456789?text=");
    const decoded = decodeURIComponent(url.split("?text=")[1] || "");
    expect(decoded).toBe(msg);
  });
  it("multiples productos: todos presentes sin perdida", () => {
    const lines = [
      makeProduct({
        variantId: "v1",
        title: "A",
        variantTitle: "V1",
        unitPrice: 100000,
        quantity: 2,
      }),
      makeProduct({
        variantId: "v2",
        title: "B",
        variantTitle: "V2",
        unitPrice: 200000,
        quantity: 1,
      }),
      makeProduct({
        variantId: "v3",
        title: "C",
        variantTitle: "V3",
        unitPrice: 5000,
        quantity: 3,
      }),
    ];
    const store = makeStore();
    const msg = buildWhatsAppMessage(store as any, lines, {
      name: "Juan",
      phone: "123",
      address: "Calle 123",
      notes: "",
    });
    expect((msg.match(/- \d+ x /g) || []).length).toBe(3);
    expect(msg).toContain("A");
    expect(msg).toContain("B");
    expect(msg).toContain("C");
    const total = 415000;
    expect(msg).toContain(formatMoney(total));
  });
  it("variantes: titulo de variante correcto", () => {
    const line = makeProduct({ title: "Manta Bruma", variantTitle: "Musgo", sku: "ML-BRU-MUS" });
    const msg = buildWhatsAppMessage(makeStore() as any, [line], {
      name: "X",
      phone: "Y",
      address: "Z",
      notes: "",
    });
    expect(msg).toContain("Manta Bruma (Musgo) [ML-BRU-MUS]");
  });
  it("cantidades altas: 99 unidades calculo exacto sin overflow", () => {
    const line = makeProduct({ unitPrice: 10000, quantity: 99 });
    const msg = buildWhatsAppMessage(makeStore() as any, [line], {
      name: "X",
      phone: "Y",
      address: "Z",
      notes: "",
    });
    expect(msg).toContain("99 x");
    expect(msg).toContain(formatMoney(990000));
  });
  it("parseCart limita quantity a 1-99", () => {
    expect(
      parseCart([
        {
          variantId: "v1",
          title: "T",
          variantTitle: "V",
          sku: "S",
          unitPrice: 100,
          quantity: 0,
        } as any,
      ]).length,
    ).toBe(0);
    expect(
      parseCart([
        {
          variantId: "v1",
          title: "T",
          variantTitle: "V",
          sku: "S",
          unitPrice: 100,
          quantity: 100,
        } as any,
      ]).length,
    ).toBe(0);
    expect(
      parseCart([
        {
          variantId: "v1",
          title: "T",
          variantTitle: "V",
          sku: "S",
          unitPrice: 100,
          quantity: 99,
        } as any,
      ]).length,
    ).toBe(1);
  });
  it("precios con y sin centavos: always vs auto", () => {
    const cases: Array<[number, string, string]> = [
      [150000, "$ 1.500,00", "$ 1.500"],
      [150050, "$ 1.500,50", "$ 1.500,50"],
      [1, "$ 0,01", "$ 0,01"],
      [0, "$ 0,00", "$ 0"],
      [100, "$ 1,00", "$ 1"],
      [99999900, "$ 999.999,00", "$ 999.999"],
    ];
    for (const [cents, always, auto] of cases) {
      expect(formatMoney(cents, "ARS", "es-AR", "always").replace("\u00A0", " ")).toBe(always);
      expect(formatMoney(cents, "ARS", "es-AR", "auto").replace("\u00A0", " ")).toBe(auto);
    }
    const line = makeProduct({ unitPrice: 150000 });
    const storeAlways = makeStore({ priceFractionDisplay: "always" });
    const storeAuto = makeStore({ priceFractionDisplay: "auto" });
    const msgAlways = buildWhatsAppMessage(storeAlways as any, [line], {
      name: "A",
      phone: "B",
      address: "C",
      notes: "",
    });
    const msgAuto = buildWhatsAppMessage(storeAuto as any, [line], {
      name: "A",
      phone: "B",
      address: "C",
      notes: "",
    });
    expect(msgAlways.replace("\u00A0", " ")).toContain("1.500,00");
    expect(msgAuto.replace("\u00A0", " ")).toContain("1.500");
    expect(msgAuto.replace("\u00A0", " ")).not.toContain("1.500,00");
  });
  it("producto agotado: reconcile marca unavailable", () => {
    const line = makeProduct({ variantId: "v-out", unitPrice: 10000 });
    const catalog: CatalogIndexEntry[] = [
      {
        productId: "p1",
        variantId: "v-out",
        title: "Producto Base",
        variantTitle: "Variante Base",
        sku: "SKU-001",
        price: 10000,
        available: false,
      },
    ];
    const rec = reconcileCartLines([line as any], catalog);
    expect(rec[0]?.available).toBe(false);
  });
  it("runtime bloquea checkout si hay unavailable", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("x.invalidItems");
    expect(STOREFRONT_RUNTIME_JS).toContain("available === false");
    expect(STOREFRONT_RUNTIME_JS).toContain('setAttribute("role", "alert")');
  });
  it("cambio de precio: reconcile actualiza unitPrice al valor actual", () => {
    const stored = makeProduct({ variantId: "v1", unitPrice: 1, quantity: 2 });
    const catalog: CatalogIndexEntry[] = [
      {
        productId: "p1",
        variantId: "v1",
        title: "Producto Base",
        variantTitle: "Variante Base",
        sku: "SKU-001",
        price: 99999,
        available: true,
      },
    ];
    const rec = reconcileCartLines([stored as any], catalog);
    expect(rec[0]?.unitPrice).toBe(99999);
    expect(rec[0]?.unitPrice).not.toBe(1);
    const msg = buildWhatsAppMessage(makeStore() as any, rec as any, {
      name: "A",
      phone: "B",
      address: "C",
      notes: "",
    });
    expect(msg.replace("\u00A0", " ")).toContain("1.999,98");
  });
  it("reconcile no descarta linea si variant desaparece, la marca unavailable", () => {
    const line = makeProduct({ variantId: "v-ghost" });
    const catalog: CatalogIndexEntry[] = [
      {
        productId: "p9",
        variantId: "v-other",
        title: "Otro",
        variantTitle: "V",
        sku: "S",
        price: 100,
        available: true,
      },
    ];
    const rec = reconcileCartLines([line as any], catalog);
    expect(rec.length).toBe(1);
    expect(rec[0]?.variantId).toBe("v-ghost");
    expect(rec[0]?.available).toBe(false);
  });
  it("nombres con emojis: encoding preserva emojis tras decode", () => {
    const line = makeProduct({ title: "Remera", variantTitle: "Rojo" });
    const msg = buildWhatsAppMessage(makeStore() as any, [line], {
      name: "Ana",
      phone: "123",
      address: "Calle 123",
      notes: "Entregar",
    });
    const url = buildWhatsAppUrl("5491123456789", msg);
    const decoded = decodeURIComponent(url.split("?text=")[1] || "");
    expect(decoded).toBe(msg);
  });
  it("simbolos &, %, #, ?, + correctamente encoded", () => {
    const tricky = "Camisa & Pantal\u00F3n #1 50% off + env\u00EDo?";
    const line = makeProduct({
      title: tricky,
      variantTitle: "Talle & Color +%#?",
      sku: "SKU&%#?+",
    });
    const msg = buildWhatsAppMessage(makeStore() as any, [line], {
      name: "Jos\u00E9 & Mar\u00EDa",
      phone: "11 5555 0142",
      address: "Av. 9 de Julio & Corrientes  #123? ",
      notes: "Nota: 100% algod\u00F3n & lino, + env\u00EDo #urgente?",
    });
    const url = buildWhatsAppUrl("5491123456789", msg);
    expect(url).toContain("%26");
    expect(url).toContain("%25");
    expect(url).toContain("%23");
    expect(url).toContain("%3F");
    expect(url).toContain("%2B");
    const decoded = decodeURIComponent(url.split("?text=")[1] || "");
    expect(decoded).toBe(msg);
  });
  it("nombres muy largos no rompen mensaje", () => {
    const long = "A".repeat(200);
    const line = makeProduct({ title: long, variantTitle: long });
    const msg = buildWhatsAppMessage(makeStore() as any, [line], {
      name: long,
      phone: "123",
      address: long,
      notes: long,
    });
    expect(msg).toContain(long);
    const url = buildWhatsAppUrl("5491123456789", msg);
    const decoded = decodeURIComponent(url.split("?text=")[1] || "");
    expect(decoded).toBe(msg);
  });
  it("mensaje con 50 productos: todos presentes, encoding reversible", () => {
    const lines = Array.from({ length: 50 }, (_, i) =>
      makeProduct({
        variantId: `v${i}`,
        title: `Producto ${i} con nombre largo para probar l\u00EDmites de URL y encoding especial &%#?+`,
        variantTitle: `Variante ${i}`,
        unitPrice: 10000 + i,
        quantity: 2,
      }),
    );
    const msg = buildWhatsAppMessage(makeStore() as any, lines as any, {
      name: "Test",
      phone: "123",
      address: "CABA",
      notes: "Notas",
    });
    expect((msg.match(/- 2 x Producto/g) || []).length).toBe(50);
    const url = buildWhatsAppUrl("5491123456789", msg);
    const decoded = decodeURIComponent(url.split("?text=")[1] || "");
    expect(decoded).toBe(msg);
  });
  it("mensaje con 100 productos no pierde datos tras encode", () => {
    const lines = Array.from({ length: 100 }, (_, i) =>
      makeProduct({
        variantId: `v${i}`,
        title: `P${i}`,
        variantTitle: `V${i}`,
        sku: `SKU${i}`,
        unitPrice: 10000,
        quantity: 1,
      }),
    );
    const msg = buildWhatsAppMessage(makeStore() as any, lines as any, {
      name: "A",
      phone: "B",
      address: "C",
      notes: "",
    });
    expect((msg.match(/- 1 x P/g) || []).length).toBe(100);
    const url = buildWhatsAppUrl("5491123456789", msg);
    const decoded = decodeURIComponent(url.split("?text=")[1] || "");
    expect(decoded).toBe(msg);
  });
  it("Unicode diverso: \u00F1 \u00E1", () => {
    const line = makeProduct({
      title: "Ni\u00F1o \u00F1and\u00FA ca\u00F1a",
      variantTitle: "Talla \u00FC \u00E7",
    });
    const msg = buildWhatsAppMessage(makeStore() as any, [line], {
      name: "Jos\u00E9 Garc\u00EDa \u00F1",
      phone: "123",
      address: "Calle \u4E2D\u6587 123",
      notes: "Nota con emojis y tildes: \u00E1\u00E9\u00ED\u00F3\u00FA \u00F1",
    });
    const url = buildWhatsAppUrl("5491123456789", msg);
    const decoded = decodeURIComponent(url.split("?text=")[1] || "");
    expect(decoded).toBe(msg);
    expect(decoded).toContain("\u00F1");
  });
  it("saltos de linea en notas y titulos se preservan", () => {
    const line = makeProduct({ title: "Remera\nCon Salto", variantTitle: "V1\nV2" });
    const msg = buildWhatsAppMessage(makeStore() as any, [line], {
      name: "Ana\nApellido",
      phone: "123",
      address: "Calle 123\nDepto 4B",
      notes: "L\u00EDnea1\nL\u00EDnea2\nL\u00EDnea3",
    });
    expect(msg).toContain("Ana\nApellido");
    expect(msg).toContain("L\u00EDnea1\nL\u00EDnea2");
    const url = buildWhatsAppUrl("5491123456789", msg);
    expect(url).toContain("%0A");
    const decoded = decodeURIComponent(url.split("?text=")[1] || "");
    expect(decoded).toBe(msg);
  });
  it("carrito restaurado: parseCart filtra invalidos y reconcile corrige precios", () => {
    const raw = [
      { variantId: "v1", title: "P1", variantTitle: "V1", sku: "S1", unitPrice: 999, quantity: 2 },
      { variantId: "", title: "Invalid", variantTitle: "V", sku: "S", unitPrice: 100, quantity: 1 },
      { variantId: "v2", title: "P2", variantTitle: "V2", sku: "S2", unitPrice: 100, quantity: 99 },
      {
        variantId: "v3",
        title: "P3",
        variantTitle: "V3",
        sku: "S3",
        unitPrice: 100.5,
        quantity: 1,
      },
      { variantId: "v4", title: "P4", variantTitle: "V4", sku: "S4", unitPrice: 100, quantity: 0 },
    ];
    const parsed = parseCart(raw as any);
    expect(parsed.length).toBe(2);
    const catalog: CatalogIndexEntry[] = [
      {
        productId: "p1",
        variantId: "v1",
        title: "P1",
        variantTitle: "V1",
        sku: "S1",
        price: 10000,
        available: true,
      },
      {
        productId: "p2",
        variantId: "v2",
        title: "P2",
        variantTitle: "V2",
        sku: "S2",
        price: 20000,
        available: true,
      },
    ];
    const rec = reconcileCartLines(parsed, catalog);
    expect(rec.length).toBe(2);
    expect(rec.find((l) => l.variantId === "v1")?.unitPrice).toBe(10000);
    expect(rec.find((l) => l.variantId === "v2")?.unitPrice).toBe(20000);
  });
  it("calculo exacto: no usa floats, total en centavos enteros", () => {
    const lines = [
      makeProduct({ variantId: "v1", unitPrice: 1, quantity: 3 }),
      makeProduct({ variantId: "v2", unitPrice: 99, quantity: 2 }),
    ];
    const msg = buildWhatsAppMessage(makeStore() as any, lines as any, {
      name: "A",
      phone: "B",
      address: "C",
      notes: "",
    });
    expect(msg).toContain(formatMoney(201));
    expect(msg).toContain(formatMoney(3));
    expect(msg).toContain(formatMoney(198));
  });
  it("ninguna duplicacion: variantId duplicado no genera dos lineas", () => {
    const dupCart = [
      makeProduct({
        variantId: "v1",
        title: "Dup",
        variantTitle: "V",
        unitPrice: 10000,
        quantity: 1,
      }),
      makeProduct({
        variantId: "v1",
        title: "Dup",
        variantTitle: "V",
        unitPrice: 10000,
        quantity: 2,
      }),
    ];
    const catalog: CatalogIndexEntry[] = [
      {
        productId: "p1",
        variantId: "v1",
        title: "Dup",
        variantTitle: "V",
        sku: "S",
        price: 10000,
        available: true,
      },
    ];
    const rec = reconcileCartLines(dupCart as any, catalog);
    expect(rec.length).toBe(1);
    if (rec.length === 1) expect(rec[0]?.quantity).toBe(3);
  });
  it("encoding correcto: buildWhatsAppUrl nunca deja &, %, #, ?, + sin encode en el parametro text", () => {
    const msg = "Test & % # ? + \n Nueva linea";
    const url = buildWhatsAppUrl("5491123456789", msg);
    const textPart = url.split("?text=")[1] || "";
    expect(textPart).not.toContain("&");
    expect(textPart).not.toContain("#");
    expect(textPart).not.toContain("?");
    expect(textPart).not.toMatch(/\+/);
    expect(textPart).toContain("%26");
    expect(textPart).toContain("%25");
    expect(textPart).toContain("%23");
    expect(textPart).toContain("%3F");
    expect(textPart).toContain("%2B");
    expect(textPart).toContain("%0A");
    expect(decodeURIComponent(textPart)).toBe(msg);
  });
  it("mensaje legible: estructura con greeting, items, total, datos cliente y disclaimer", () => {
    const line = makeProduct({ unitPrice: 150000 });
    const store = makeStore();
    const msg = buildWhatsAppMessage(store as any, [line], {
      name: "Malena Ortiz",
      phone: "11 5555 0142",
      address: "Av. Forest 842, CABA",
      notes: "Entregar por la tarde",
    });
    expect(msg).toContain(store.whatsapp.greeting.trim());
    expect(msg).toContain("- 1 x");
    expect(msg).toContain(store.publicCopy.whatsapp.total);
    expect(msg).toContain("Malena Ortiz");
    expect(msg).toContain("11 5555 0142");
    expect(msg).toContain("Av. Forest 842");
    expect(msg).toContain("Entregar por la tarde");
    expect(msg).toContain(
      store.publicCopy.checkout.disclaimer || store.publicCopy.whatsapp.confirmation,
    );
  });
  it("ningun dato personal persistido innecesariamente: buildWhatsAppMessage no toca localStorage", () => {
    expect(buildWhatsAppMessage.toString()).not.toContain("localStorage");
    expect(buildWhatsAppUrl.toString()).not.toContain("localStorage");
    expect(STOREFRONT_RUNTIME_JS).not.toContain('localStorage.getItem("solara-customer"');
  });
  it("reconciliacion antes de generar pedido: STOREFRONT_RUNTIME_JS hace reconcileCart antes de build", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("void reconcileCart().then((ok)");
    expect(STOREFRONT_RUNTIME_JS).toContain("if (!ok)");
    const idxReconcile = STOREFRONT_RUNTIME_JS.indexOf("void reconcileCart().then");
    const idxMessage = STOREFRONT_RUNTIME_JS.indexOf("const message = [");
    expect(idxReconcile).toBeGreaterThan(-1);
    expect(idxMessage).toBeGreaterThan(idxReconcile);
    expect(STOREFRONT_RUNTIME_JS).toContain("freshCatalog = null");
    const idxReset = STOREFRONT_RUNTIME_JS.indexOf("freshCatalog = null");
    expect(idxReset).toBeGreaterThan(-1);
    expect(idxReset).toBeLessThan(idxReconcile);
  });
  it("buildWhatsAppUrl con telefono vacio retorna vacio (no wa.me invalido)", () => {
    expect(buildWhatsAppUrl("", "Hola")).toBe("");
    expect(buildWhatsAppUrl("   ", "Hola")).toBe("");
    expect(buildWhatsAppUrl("abc", "Hola")).toBe("");
    expect(buildWhatsAppUrl("5491123456789", "Hola")).toContain("https://wa.me/5491123456789");
  });
  it("buildWhatsAppMessage personaliza greeting con brandName (paridad con runtime)", () => {
    const baseStore: any = {
      ...makeStore(),
      whatsapp: {
        phone: "5491123456789",
        greeting: "Hola, quiero hacer este pedido:",
        includeSku: true,
      },
      identity: { brandName: "Nueva Marca" },
    };
    const line = makeProduct({
      title: "P",
      variantTitle: "V",
      sku: "S",
      unitPrice: 10000,
      quantity: 1,
    });
    const msg = buildWhatsAppMessage(baseStore, [line], {
      name: "A",
      phone: "B",
      address: "C",
      notes: "",
    });
    expect(msg).toContain("Hola Nueva Marca,");
    expect(msg).not.toContain("Hola, quiero");
    // Si greeting ya tiene brand, no duplica
    const store2: any = {
      ...makeStore(),
      whatsapp: {
        phone: "5491123456789",
        greeting: "Hola Tienda Referencia, quiero hacer este pedido:",
        includeSku: true,
      },
      identity: { brandName: "Tienda Referencia" },
    };
    const msg2 = buildWhatsAppMessage(store2, [line], {
      name: "A",
      phone: "B",
      address: "C",
      notes: "",
    });
    expect(msg2).toContain("Hola Tienda Referencia,");
  });
  it("telefono vacio: STOREFRONT_RUNTIME_JS debe guardar contra telefono vacio en checkout", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("cleanPhone");
    expect(STOREFRONT_RUNTIME_JS).toContain("if (!cleanPhone)");
    expect(STOREFRONT_RUNTIME_JS).toContain("whatsappFallback");
  });
  it("runtime no pierde productos por truncamiento en wa.me", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("cart.map((line)");
    expect(STOREFRONT_RUNTIME_JS).not.toContain("cart.slice");
  });
});
