import { describe, expect, it } from "vitest";
import { referenceStore } from "./fixture";
import { MoneySchema, migrateProject, SlugSchema, StoreProjectV1Schema } from "./index";

describe("StoreProjectV1Schema", () => {
  it("valida el fixture compartido", () => {
    expect(StoreProjectV1Schema.parse(referenceStore)).toEqual(referenceStore);
  });

  it("rechaza dinero fraccionario y slugs inválidos", () => {
    expect(MoneySchema.safeParse(19.99).success).toBe(false);
    expect(SlugSchema.safeParse("Manta Bruma").success).toBe(false);
  });

  it("rechaza versiones sin migración", () => {
    expect(() => migrateProject({ ...referenceStore, schemaVersion: 2 })).toThrow(
      "Versión de proyecto incompatible",
    );
  });
});
