import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { calculateRetainedEarnings } from "@/features/accounting/financial-statements/retained-earnings.calculator";
import type { IncomeStatementCurrent } from "@/features/accounting/financial-statements/financial-statements.types";

const D = (v: string | number) => new Prisma.Decimal(v);

// Helper para construir un IncomeStatementCurrent mínimo para el calculador
function makeIS(incomeTotalStr: string, expensesTotalStr: string): IncomeStatementCurrent {
  return {
    dateFrom: new Date("2025-01-01"),
    dateTo: new Date("2025-12-31"),
    income: {
      groups: [],
      total: D(incomeTotalStr),
    },
    expenses: {
      groups: [],
      total: D(expensesTotalStr),
    },
    operatingIncome: D("0"),
    netIncome: D("0"), // será calculado por el calculador en el servicio
    preliminary: false,
  };
}

describe("calculateRetainedEarnings", () => {
  // Caso (a): utilidad positiva
  it("retorna positivo cuando ingresos > gastos", () => {
    const is = makeIS("100000", "80000");
    const result = calculateRetainedEarnings(is);
    expect(result.toNumber()).toBe(20000);
  });

  // Caso (b): pérdida del ejercicio (gastos > ingresos)
  it("retorna negativo cuando gastos > ingresos (pérdida)", () => {
    const is = makeIS("50000", "75000");
    const result = calculateRetainedEarnings(is);
    expect(result.toNumber()).toBe(-25000);
  });

  // Caso (c): período sin movimientos → 0
  it("retorna 0 cuando ingresos y gastos son ambos cero", () => {
    const is = makeIS("0", "0");
    const result = calculateRetainedEarnings(is);
    expect(result.toNumber()).toBe(0);
  });

  // TRIANGULATE: ingresos sin gastos
  it("retorna ingresos totales cuando gastos son cero", () => {
    const is = makeIS("45000", "0");
    const result = calculateRetainedEarnings(is);
    expect(result.toNumber()).toBe(45000);
  });

  // TRIANGULATE: gastos sin ingresos
  it("retorna el negativo de gastos cuando ingresos son cero", () => {
    const is = makeIS("0", "15000");
    const result = calculateRetainedEarnings(is);
    expect(result.toNumber()).toBe(-15000);
  });

  // Caso (d): invocación doble con mismo input produce Decimal idéntico (REQ-3 escenario 3)
  it("invocación doble con mismo input produce valor idéntico (single source of truth)", () => {
    const is = makeIS("200000", "150000");
    const result1 = calculateRetainedEarnings(is);
    const result2 = calculateRetainedEarnings(is);
    expect(result1.equals(result2)).toBe(true);
    expect(result1.toNumber()).toBe(50000);
  });

  // TRIANGULATE: valores decimales — precisión preservada
  it("preserva precisión decimal en el resultado", () => {
    const is = makeIS("100.33", "50.11");
    const result = calculateRetainedEarnings(is);
    // 100.33 - 50.11 = 50.22
    expect(result.toString()).toBe("50.22");
  });

  // TRIANGULATE: utilidad exactamente igual a cero (ingresos = gastos)
  it("retorna 0 cuando ingresos exactamente igualan gastos", () => {
    const is = makeIS("99999.99", "99999.99");
    const result = calculateRetainedEarnings(is);
    expect(result.toNumber()).toBe(0);
  });
});
