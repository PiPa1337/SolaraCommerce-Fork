import { describe, expect, it } from "vitest";
import {
  AgentOperationSchema,
  AgentProtocolJsonSchema,
  AgentRequestSchema,
  AssetUploadChunkParamsSchema,
  PlanCreateParamsSchema,
} from "./index";

describe("contrato del agente", () => {
  it("acepta el flujo tipado de tienda nueva", () => {
    const parsed = PlanCreateParamsSchema.parse({
      operations: [
        { type: "store.create", name: "Lunaria", slug: "lunaria" },
        { type: "product.create", slug: "taza", title: "Taza", priceCents: 1200 },
      ],
    });
    expect(parsed.operations).toHaveLength(2);
    expect(AgentOperationSchema.parse(parsed.operations[1]).type).toBe("product.create");
  });

  it("acepta el borrado físico protegido de un producto archivado", () => {
    const operation = AgentOperationSchema.parse({
      type: "product.delete",
      productId: "product-archived",
      confirmation: "ELIMINAR_PRODUCTO",
    });
    expect(operation.type).toBe("product.delete");
    expect(() =>
      AgentOperationSchema.parse({
        type: "product.delete",
        productId: "product-archived",
        confirmation: "BORRAR",
      }),
    ).toThrow();
  });

  it("rechaza comandos arbitrarios y requests sin método", () => {
    expect(() => AgentOperationSchema.parse({ type: "project.patch", path: "x" })).toThrow();
    expect(() => AgentRequestSchema.parse({ id: 1 })).toThrow();
  });

  it("acepta store.updateWhatsapp con teléfono internacional en dígitos", () => {
    const operation = AgentOperationSchema.parse({
      type: "store.updateWhatsapp",
      phone: "5492804662332",
      greeting: "Hola RM, quiero hacer este pedido:",
      includeSku: true,
    });
    expect(operation.type).toBe("store.updateWhatsapp");
    if (operation.type === "store.updateWhatsapp") {
      expect(operation.phone).toBe("5492804662332");
      expect(operation.includeSku).toBe(true);
    }
  });

  it("store.updateWhatsapp exige formato de dígitos y al menos un campo", () => {
    expect(() =>
      AgentOperationSchema.parse({ type: "store.updateWhatsapp", phone: "+54 9 280 466-2332" }),
    ).toThrow();
    expect(() => AgentOperationSchema.parse({ type: "store.updateWhatsapp" })).toThrow();
    expect(() =>
      AgentOperationSchema.parse({ type: "store.updateWhatsapp", includeSku: false }),
    ).not.toThrow();
  });

  it("acepta store.updateNavigation con merge parcial de navegación", () => {
    const operation = AgentOperationSchema.parse({
      type: "store.updateNavigation",
      mode: "curated",
      catalogLabel: "Categorías",
      items: [{ id: "nav-1", label: "Bolsas", href: "/categorias/bolsas/" }],
    });
    expect(operation.type).toBe("store.updateNavigation");
    if (operation.type === "store.updateNavigation") {
      expect(operation.catalogLabel).toBe("Categorías");
      expect(operation.items).toHaveLength(1);
    }
    expect(() =>
      AgentOperationSchema.parse({
        type: "store.updateNavigation",
        mode: "hibrido",
      }),
    ).toThrow();
    expect(() =>
      AgentOperationSchema.parse({
        type: "store.updateNavigation",
        items: [{ id: "nav-1", label: "Sin href interno seguro", href: "javascript:alert(1)" }],
      }),
    ).toThrow();
  });

  it("publica límites y métodos de recuperación del protocolo", () => {
    expect(AgentProtocolJsonSchema.methods).toContain("jobs.get");
    expect(AgentProtocolJsonSchema.methods).toContain("assets.upload.finish");
    expect(() => AssetUploadChunkParamsSchema.parse({ uploadId: "u", sequence: 0 })).toThrow();
  });
});
