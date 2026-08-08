import { describe, expect, test } from "vitest";
import { bulkBackupToastMessage } from "./bulkBackupModel";

describe("bulkBackupToastMessage", () => {
  test("con todos los respaldos creados anuncia el total", () => {
    expect(bulkBackupToastMessage({ total: 3, failed: 0 })).toBe(
      "Se crearon 3 respaldos en proyectos/.",
    );
  });

  test("con fallos parciales informa los logrados y pide revisar errores", () => {
    expect(bulkBackupToastMessage({ total: 3, failed: 1, firstError: "disco lleno" })).toBe(
      "Se crearon 2 de 3 respaldos; revisá los errores (el primero: disco lleno).",
    );
  });

  test("con fallo total reporta cero logrados", () => {
    expect(bulkBackupToastMessage({ total: 2, failed: 2, firstError: "sin permisos" })).toBe(
      "Se crearon 0 de 2 respaldos; revisá los errores (el primero: sin permisos).",
    );
  });

  test("sin detalle del primer error usa un mensaje genérico", () => {
    const message = bulkBackupToastMessage({ total: 1, failed: 1 });
    expect(message).toContain("revisá los errores");
  });
});
