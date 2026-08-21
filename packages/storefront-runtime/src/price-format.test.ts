import { referenceStore } from "@solara/project-schema/fixture";
import { describe, expect, it } from "vitest";
import { buildCartLine, buildWhatsAppMessage, formatMoney, STOREFRONT_RUNTIME_JS } from "./index";

describe("priceFractionDisplay runtime", () => {
  it("formatMoney always muestra ,00", () => {
    expect(formatMoney(150000, "ARS", "es-AR", "always").replace("\u00A0", " ")).toBe("$ 1.500,00");
    expect(formatMoney(0, "ARS", "es-AR", "always").replace("\u00A0", " ")).toBe("$ 0,00");
  });
  it("formatMoney auto oculta ,00", () => {
    expect(formatMoney(150000, "ARS", "es-AR", "auto").replace("\u00A0", " ")).toBe("$ 1.500");
    expect(formatMoney(150050, "ARS", "es-AR", "auto").replace("\u00A0", " ")).toBe("$ 1.500,50");
    expect(formatMoney(0, "ARS", "es-AR", "auto").replace("\u00A0", " ")).toBe("$ 0");
    expect(formatMoney(1, "ARS", "es-AR", "auto").replace("\u00A0", " ")).toBe("$ 0,01");
    expect(formatMoney(99, "ARS", "es-AR", "auto").replace("\u00A0", " ")).toBe("$ 0,99");
    expect(formatMoney(100, "ARS", "es-AR", "auto").replace("\u00A0", " ")).toBe("$ 1");
  });

  it("buildWhatsAppMessage respeta display para unitario y total", () => {
    const product = referenceStore.products[0]!;
    const variant = product.variants[0]!;
    const line = buildCartLine(product, { ...variant, price: 150000 } as any, 1);
    const projectAlways: any = { ...referenceStore, priceFractionDisplay: "always" };
    const projectAuto: any = { ...referenceStore, priceFractionDisplay: "auto" };
    const msgAlways = buildWhatsAppMessage(projectAlways, [line as any], {
      name: "Ana",
      phone: "123",
      address: "CABA",
      notes: "",
    });
    const msgAuto = buildWhatsAppMessage(projectAuto, [line as any], {
      name: "Ana",
      phone: "123",
      address: "CABA",
      notes: "",
    });
    expect(msgAlways.replace("\u00A0", " ")).toContain("1.500,00");
    expect(msgAuto.replace("\u00A0", " ")).toContain("$ 1.500");
    expect(msgAuto.replace("\u00A0", " ")).not.toContain("1.500,00");
    // fraccionario debe mantenerse
    const line2 = buildCartLine(product, { ...variant, price: 150050 } as any, 1);
    const msgAuto2 = buildWhatsAppMessage(projectAuto, [line2 as any], {
      name: "Ana",
      phone: "123",
      address: "CABA",
      notes: "",
    });
    expect(msgAuto2.replace("\u00A0", " ")).toContain("1.500,50");
  });

  it("total $2000,00 con auto se muestra sin centavos, con fraccion con centavos", () => {
    const product = referenceStore.products[0]!;
    const variant = product.variants[0]!;
    const line1 = buildCartLine(product, { ...variant, price: 100050 } as any, 1);
    const line2 = buildCartLine(product, { ...variant, price: 99950 } as any, 1);
    const projectAlways: any = { ...referenceStore, priceFractionDisplay: "always" };
    const projectAuto: any = { ...referenceStore, priceFractionDisplay: "auto" };
    const msgAlways = buildWhatsAppMessage(projectAlways, [line1 as any, line2 as any], {
      name: "A",
      phone: "B",
      address: "C",
      notes: "",
    });
    const msgAuto = buildWhatsAppMessage(projectAuto, [line1 as any, line2 as any], {
      name: "A",
      phone: "B",
      address: "C",
      notes: "",
    });
    expect(msgAlways.replace(/\u00A0/g, " ")).toContain("2.000,00");
    expect(msgAuto.replace(/\u00A0/g, " ")).toContain("$ 2.000");
    expect(msgAuto.replace(/\u00A0/g, " ")).not.toContain("2.000,00");
  });

  it("runtime serializado contiene lectura de priceFractionDisplay", () => {
    expect(STOREFRONT_RUNTIME_JS).toContain("priceFractionDisplay");
    expect(STOREFRONT_RUNTIME_JS).toContain("formatMoneyRuntime");
  });

  it("edge cases completos", () => {
    const cases: Array<[number, "always" | "auto", string]> = [
      [0, "always", "$ 0,00"],
      [0, "auto", "$ 0"],
      [1, "auto", "$ 0,01"],
      [99, "auto", "$ 0,99"],
      [100, "auto", "$ 1"],
      [101, "auto", "$ 1,01"],
      [110, "auto", "$ 1,10"],
      [150, "auto", "$ 1,50"],
      [199, "auto", "$ 1,99"],
      [99999900, "auto", "$ 999.999"],
      [99999999, "auto", "$ 999.999,99"],
    ];
    for (const [cents, display, expected] of cases) {
      expect(formatMoney(cents, "ARS", "es-AR", display).replace("\u00A0", " ")).toBe(expected);
    }
  });
});
