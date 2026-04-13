import { describe, it, expect } from "vitest";
import { resolveAccountSubtype } from "@/features/accounting/account-subtype.resolve";
import { AccountType, AccountSubtype } from "@/generated/prisma/client";
import { INVALID_ACCOUNT_SUBTYPE, ACCOUNT_SUBTYPE_MISMATCH } from "@/features/shared/errors";

// ── Tests de resolveAccountSubtype ──
// Función pura que encapsula toda la lógica de herencia y validación de subtipos.
// Reglas (según design D5 y spec account-subtype-inheritance):
//   1. Si el input tiene subtype y el padre tiene subtype diferente → ACCOUNT_SUBTYPE_MISMATCH
//   2. Si el input tiene subtype y no es válido para el type resuelto → INVALID_ACCOUNT_SUBTYPE
//   3. Si el input no tiene subtype → heredar del padre
//   4. Si level >= 2 y el subtype resuelto es null → INVALID_ACCOUNT_SUBTYPE
//   5. Si level === 1 → se permite null (cuenta raíz estructural)

describe("resolveAccountSubtype", () => {
  // ── Caso 1: herencia del padre cuando input es null ──

  it("hereda el subtype del padre cuando el input no provee subtype", () => {
    const result = resolveAccountSubtype({
      inputSubtype: undefined,
      parentSubtype: AccountSubtype.ACTIVO_CORRIENTE,
      resolvedType: AccountType.ACTIVO,
      level: 3,
    });
    expect(result).toBe(AccountSubtype.ACTIVO_CORRIENTE);
  });

  it("hereda PASIVO_CORRIENTE del padre cuando el input es undefined", () => {
    const result = resolveAccountSubtype({
      inputSubtype: undefined,
      parentSubtype: AccountSubtype.PASIVO_CORRIENTE,
      resolvedType: AccountType.PASIVO,
      level: 4,
    });
    expect(result).toBe(AccountSubtype.PASIVO_CORRIENTE);
  });

  // ── Caso 2: el input coincide con el padre → permitido ──

  it("acepta subtype explícito que coincide con el del padre", () => {
    const result = resolveAccountSubtype({
      inputSubtype: AccountSubtype.ACTIVO_NO_CORRIENTE,
      parentSubtype: AccountSubtype.ACTIVO_NO_CORRIENTE,
      resolvedType: AccountType.ACTIVO,
      level: 3,
    });
    expect(result).toBe(AccountSubtype.ACTIVO_NO_CORRIENTE);
  });

  // ── Caso 3: el input difiere del padre → ACCOUNT_SUBTYPE_MISMATCH ──

  it("lanza ACCOUNT_SUBTYPE_MISMATCH si el input no coincide con el subtipo del padre", () => {
    expect(() =>
      resolveAccountSubtype({
        inputSubtype: AccountSubtype.ACTIVO_NO_CORRIENTE,
        parentSubtype: AccountSubtype.ACTIVO_CORRIENTE,
        resolvedType: AccountType.ACTIVO,
        level: 3,
      }),
    ).toThrow(expect.objectContaining({ code: ACCOUNT_SUBTYPE_MISMATCH }));
  });

  it("lanza ACCOUNT_SUBTYPE_MISMATCH si se intenta asignar subtipo de PASIVO a cuenta ACTIVO con padre ACTIVO_CORRIENTE", () => {
    expect(() =>
      resolveAccountSubtype({
        inputSubtype: AccountSubtype.PASIVO_CORRIENTE,
        parentSubtype: AccountSubtype.ACTIVO_CORRIENTE,
        resolvedType: AccountType.ACTIVO,
        level: 3,
      }),
    ).toThrow(expect.objectContaining({ code: ACCOUNT_SUBTYPE_MISMATCH }));
  });

  // ── Caso 4: el input no es compatible con el type → INVALID_ACCOUNT_SUBTYPE ──

  it("lanza INVALID_ACCOUNT_SUBTYPE si el subtype no es válido para el type (sin padre)", () => {
    expect(() =>
      resolveAccountSubtype({
        inputSubtype: AccountSubtype.PASIVO_CORRIENTE,
        parentSubtype: null,
        resolvedType: AccountType.ACTIVO,
        level: 1,
      }),
    ).toThrow(expect.objectContaining({ code: INVALID_ACCOUNT_SUBTYPE }));
  });

  it("lanza INVALID_ACCOUNT_SUBTYPE si el subtype no es válido para el type GASTO", () => {
    expect(() =>
      resolveAccountSubtype({
        inputSubtype: AccountSubtype.ACTIVO_CORRIENTE,
        parentSubtype: null,
        resolvedType: AccountType.GASTO,
        level: 1,
      }),
    ).toThrow(expect.objectContaining({ code: INVALID_ACCOUNT_SUBTYPE }));
  });

  // ── Caso 5: level >= 2, sin padre y sin input → INVALID_ACCOUNT_SUBTYPE ──

  it("lanza INVALID_ACCOUNT_SUBTYPE si level >= 2 y no hay subtipo resuelto", () => {
    expect(() =>
      resolveAccountSubtype({
        inputSubtype: undefined,
        parentSubtype: null,
        resolvedType: AccountType.ACTIVO,
        level: 2,
      }),
    ).toThrow(expect.objectContaining({ code: INVALID_ACCOUNT_SUBTYPE }));
  });

  it("lanza INVALID_ACCOUNT_SUBTYPE si level === 3 y no hay subtipo resuelto", () => {
    expect(() =>
      resolveAccountSubtype({
        inputSubtype: undefined,
        parentSubtype: null,
        resolvedType: AccountType.PASIVO,
        level: 3,
      }),
    ).toThrow(expect.objectContaining({ code: INVALID_ACCOUNT_SUBTYPE }));
  });

  // ── Caso 6: level === 1, sin padre y sin input → null permitido ──

  it("retorna null para cuenta raíz nivel 1 sin subtype de entrada ni del padre", () => {
    const result = resolveAccountSubtype({
      inputSubtype: undefined,
      parentSubtype: null,
      resolvedType: AccountType.ACTIVO,
      level: 1,
    });
    expect(result).toBeNull();
  });

  // ── Caso 7: cuentas raíz nivel 1 con subtype explícito válido ──

  it("acepta subtype explícito válido en cuenta raíz nivel 1 (sin padre)", () => {
    const result = resolveAccountSubtype({
      inputSubtype: AccountSubtype.ACTIVO_CORRIENTE,
      parentSubtype: null,
      resolvedType: AccountType.ACTIVO,
      level: 1,
    });
    expect(result).toBe(AccountSubtype.ACTIVO_CORRIENTE);
  });

  // ── Triangulación: variantes de GASTO ──

  it("acepta GASTO_ADMINISTRATIVO para type GASTO con padre GASTO_ADMINISTRATIVO", () => {
    const result = resolveAccountSubtype({
      inputSubtype: AccountSubtype.GASTO_ADMINISTRATIVO,
      parentSubtype: AccountSubtype.GASTO_ADMINISTRATIVO,
      resolvedType: AccountType.GASTO,
      level: 3,
    });
    expect(result).toBe(AccountSubtype.GASTO_ADMINISTRATIVO);
  });

  it("hereda GASTO_FINANCIERO del padre para cuenta nivel 4", () => {
    const result = resolveAccountSubtype({
      inputSubtype: undefined,
      parentSubtype: AccountSubtype.GASTO_FINANCIERO,
      resolvedType: AccountType.GASTO,
      level: 4,
    });
    expect(result).toBe(AccountSubtype.GASTO_FINANCIERO);
  });
});
