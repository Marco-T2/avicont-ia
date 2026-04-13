import { describe, it, expect } from "vitest";
import {
  isValidSubtypeForType,
  inferSubtype,
} from "@/features/accounting/account-subtype.utils";
import { AccountType, AccountSubtype } from "@/generated/prisma/client";

// ── Tests de isValidSubtypeForType ──

describe("isValidSubtypeForType", () => {
  it("acepta ACTIVO_CORRIENTE para ACTIVO", () => {
    expect(isValidSubtypeForType(AccountType.ACTIVO, AccountSubtype.ACTIVO_CORRIENTE)).toBe(true);
  });

  it("acepta ACTIVO_NO_CORRIENTE para ACTIVO", () => {
    expect(isValidSubtypeForType(AccountType.ACTIVO, AccountSubtype.ACTIVO_NO_CORRIENTE)).toBe(true);
  });

  it("rechaza ACTIVO_CORRIENTE para PASIVO", () => {
    expect(isValidSubtypeForType(AccountType.PASIVO, AccountSubtype.ACTIVO_CORRIENTE)).toBe(false);
  });

  it("acepta PASIVO_CORRIENTE para PASIVO", () => {
    expect(isValidSubtypeForType(AccountType.PASIVO, AccountSubtype.PASIVO_CORRIENTE)).toBe(true);
  });

  it("acepta PASIVO_NO_CORRIENTE para PASIVO", () => {
    expect(isValidSubtypeForType(AccountType.PASIVO, AccountSubtype.PASIVO_NO_CORRIENTE)).toBe(true);
  });

  it("acepta PATRIMONIO_CAPITAL para PATRIMONIO", () => {
    expect(isValidSubtypeForType(AccountType.PATRIMONIO, AccountSubtype.PATRIMONIO_CAPITAL)).toBe(true);
  });

  it("acepta PATRIMONIO_RESULTADOS para PATRIMONIO", () => {
    expect(isValidSubtypeForType(AccountType.PATRIMONIO, AccountSubtype.PATRIMONIO_RESULTADOS)).toBe(true);
  });

  it("rechaza GASTO_OPERATIVO para PATRIMONIO", () => {
    expect(isValidSubtypeForType(AccountType.PATRIMONIO, AccountSubtype.GASTO_OPERATIVO)).toBe(false);
  });

  it("acepta INGRESO_OPERATIVO para INGRESO", () => {
    expect(isValidSubtypeForType(AccountType.INGRESO, AccountSubtype.INGRESO_OPERATIVO)).toBe(true);
  });

  it("acepta INGRESO_NO_OPERATIVO para INGRESO", () => {
    expect(isValidSubtypeForType(AccountType.INGRESO, AccountSubtype.INGRESO_NO_OPERATIVO)).toBe(true);
  });

  it("acepta GASTO_OPERATIVO para GASTO", () => {
    expect(isValidSubtypeForType(AccountType.GASTO, AccountSubtype.GASTO_OPERATIVO)).toBe(true);
  });

  it("acepta GASTO_ADMINISTRATIVO para GASTO", () => {
    expect(isValidSubtypeForType(AccountType.GASTO, AccountSubtype.GASTO_ADMINISTRATIVO)).toBe(true);
  });

  it("acepta GASTO_FINANCIERO para GASTO", () => {
    expect(isValidSubtypeForType(AccountType.GASTO, AccountSubtype.GASTO_FINANCIERO)).toBe(true);
  });

  it("acepta GASTO_NO_OPERATIVO para GASTO", () => {
    expect(isValidSubtypeForType(AccountType.GASTO, AccountSubtype.GASTO_NO_OPERATIVO)).toBe(true);
  });

  it("rechaza ACTIVO_CORRIENTE para GASTO", () => {
    expect(isValidSubtypeForType(AccountType.GASTO, AccountSubtype.ACTIVO_CORRIENTE)).toBe(false);
  });

  it("rechaza INGRESO_OPERATIVO para ACTIVO", () => {
    expect(isValidSubtypeForType(AccountType.ACTIVO, AccountSubtype.INGRESO_OPERATIVO)).toBe(false);
  });
});

// ── Tests de inferSubtype ──

describe("inferSubtype", () => {
  // Activo Corriente — código nivel 2: "1.1"
  it("infiere ACTIVO_CORRIENTE para código 1.1 (nivel 2)", () => {
    expect(inferSubtype("1.1", "Activo Corriente", null, AccountType.ACTIVO)).toBe(AccountSubtype.ACTIVO_CORRIENTE);
  });

  it("infiere ACTIVO_CORRIENTE para código 1.1.1 (nivel 3, padre 1.1)", () => {
    expect(inferSubtype("1.1.1", "Caja", "1.1", AccountType.ACTIVO)).toBe(AccountSubtype.ACTIVO_CORRIENTE);
  });

  // Activo No Corriente — código nivel 2: "1.2"
  it("infiere ACTIVO_NO_CORRIENTE para código 1.2.3 (padre 1.2)", () => {
    expect(inferSubtype("1.2.3", "Muebles y Enseres", "1.2", AccountType.ACTIVO)).toBe(AccountSubtype.ACTIVO_NO_CORRIENTE);
  });

  // Pasivo Corriente — código nivel 2: "2.1"
  it("infiere PASIVO_CORRIENTE para código 2.1 (nivel 2)", () => {
    expect(inferSubtype("2.1", "Pasivo Corriente", null, AccountType.PASIVO)).toBe(AccountSubtype.PASIVO_CORRIENTE);
  });

  it("infiere PASIVO_CORRIENTE para código 2.1.1 (padre 2.1)", () => {
    expect(inferSubtype("2.1.1", "Cuentas por Pagar", "2.1", AccountType.PASIVO)).toBe(AccountSubtype.PASIVO_CORRIENTE);
  });

  // Pasivo No Corriente — código nivel 2: "2.2"
  it("infiere PASIVO_NO_CORRIENTE para código 2.2.1 (padre 2.2)", () => {
    expect(inferSubtype("2.2.1", "Préstamos Bancarios a Largo Plazo", "2.2", AccountType.PASIVO)).toBe(AccountSubtype.PASIVO_NO_CORRIENTE);
  });

  // Patrimonio Capital — código nivel 2: "3.1"
  it("infiere PATRIMONIO_CAPITAL para código 3.1 (nivel 2)", () => {
    expect(inferSubtype("3.1", "Capital Social", null, AccountType.PATRIMONIO)).toBe(AccountSubtype.PATRIMONIO_CAPITAL);
  });

  // Patrimonio Resultados — código nivel 2: "3.2"
  it("infiere PATRIMONIO_RESULTADOS para código 3.2.1 (padre 3.2)", () => {
    expect(inferSubtype("3.2.1", "Resultados Acumulados", "3.2", AccountType.PATRIMONIO)).toBe(AccountSubtype.PATRIMONIO_RESULTADOS);
  });

  // Ingreso Operativo — código nivel 2: "4.1"
  it("infiere INGRESO_OPERATIVO para código 4.1.1 (padre 4.1)", () => {
    expect(inferSubtype("4.1.1", "Venta de Pollo en Pie", "4.1", AccountType.INGRESO)).toBe(AccountSubtype.INGRESO_OPERATIVO);
  });

  // Ingreso No Operativo — código nivel 2: "4.2"
  it("infiere INGRESO_NO_OPERATIVO para código 4.2.1 (padre 4.2)", () => {
    expect(inferSubtype("4.2.1", "Intereses Ganados", "4.2", AccountType.INGRESO)).toBe(AccountSubtype.INGRESO_NO_OPERATIVO);
  });

  // Gasto Operativo — código nivel 2: "5.1"
  it("infiere GASTO_OPERATIVO para código 5.1 (nivel 2)", () => {
    expect(inferSubtype("5.1", "Gastos Operativos", null, AccountType.GASTO)).toBe(AccountSubtype.GASTO_OPERATIVO);
  });

  it("infiere GASTO_OPERATIVO para código 5.1.9 (padre 5.1)", () => {
    expect(inferSubtype("5.1.9", "Fletes y Transporte", "5.1", AccountType.GASTO)).toBe(AccountSubtype.GASTO_OPERATIVO);
  });

  // Gasto Administrativo — código nivel 2: "5.2"
  it("infiere GASTO_ADMINISTRATIVO para código 5.2.1 (padre 5.2)", () => {
    expect(inferSubtype("5.2.1", "Sueldos y Salarios", "5.2", AccountType.GASTO)).toBe(AccountSubtype.GASTO_ADMINISTRATIVO);
  });

  // Gasto Financiero — código nivel 2: "5.3"
  it("infiere GASTO_FINANCIERO para código 5.3.1 (padre 5.3)", () => {
    expect(inferSubtype("5.3.1", "Intereses Bancarios", "5.3", AccountType.GASTO)).toBe(AccountSubtype.GASTO_FINANCIERO);
  });

  // Cuentas de nivel 2 con parentCode de nivel 1 (caso real en DB: parentCode = "1", "2", etc.)
  // El parentCode de nivel 1 no tiene punto, por lo que debe caer al propio code como referencia
  it("infiere ACTIVO_CORRIENTE para código 1.1 con parentCode nivel 1 ('1')", () => {
    expect(inferSubtype("1.1", "Activo Corriente", "1", AccountType.ACTIVO)).toBe(AccountSubtype.ACTIVO_CORRIENTE);
  });

  it("infiere PASIVO_CORRIENTE para código 2.1 con parentCode nivel 1 ('2')", () => {
    expect(inferSubtype("2.1", "Pasivo Corriente", "2", AccountType.PASIVO)).toBe(AccountSubtype.PASIVO_CORRIENTE);
  });

  it("infiere PATRIMONIO_CAPITAL para código 3.1 con parentCode nivel 1 ('3')", () => {
    expect(inferSubtype("3.1", "Capital Social", "3", AccountType.PATRIMONIO)).toBe(AccountSubtype.PATRIMONIO_CAPITAL);
  });

  it("infiere INGRESO_OPERATIVO para código 4.1 con parentCode nivel 1 ('4')", () => {
    expect(inferSubtype("4.1", "Ingresos Operativos", "4", AccountType.INGRESO)).toBe(AccountSubtype.INGRESO_OPERATIVO);
  });

  it("infiere GASTO_FINANCIERO para código 5.3 con parentCode nivel 1 ('5')", () => {
    expect(inferSubtype("5.3", "Gastos Financieros", "5", AccountType.GASTO)).toBe(AccountSubtype.GASTO_FINANCIERO);
  });

  // Código sin mapeo conocido → null
  it("retorna null para un código nivel 2 sin mapeo", () => {
    expect(inferSubtype("9.9", "Cuenta Desconocida", null, AccountType.ACTIVO)).toBeNull();
  });

  // Cuenta raíz nivel 1 (sin parentCode y código sin separadores de nivel 2) → null
  it("retorna null para cuenta raíz nivel 1 (código '1')", () => {
    expect(inferSubtype("1", "ACTIVO", null, AccountType.ACTIVO)).toBeNull();
  });
});
