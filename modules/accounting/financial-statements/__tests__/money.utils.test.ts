import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { roundHalfUp, sumDecimals, eq, serializeStatement } from "@/modules/accounting/financial-statements/domain/money.utils";

// Fixture constructor migrated from `Prisma.Decimal` (Decimal2 — inlined
// decimal.js@10.5.0 in Prisma 7.7.0) to top-level decimal.js@10.6.0 `Decimal`.
// Identity cascade: post sub-POC 1, `money.utils` runtime path now uses
// top-level Decimal; mixing Decimal2 fixtures with top-level Decimal
// `instanceof` checks in `serializeStatement` produced false negatives
// (Decimal2 NOT instanceof top-level Decimal). Discovery #2590
// (prisma-decimal-instance-identity-cascade). Value semantics identical.
const D = (v: string | number) => new Decimal(v);

describe("roundHalfUp", () => {
  // RED-1: 0.005 debe redondear hacia arriba → 0.01
  it("redondea 0.005 hacia arriba → 0.01", () => {
    expect(roundHalfUp(D("0.005")).toString()).toBe("0.01");
  });

  // RED-2: 0.004 debe truncar → 0 (Decimal.toString() no agrega trailing zeros)
  it("trunca 0.004 → 0", () => {
    expect(roundHalfUp(D("0.004")).toNumber()).toBe(0);
  });

  // TRIANGULATE: valores negativos
  it("redondea −0.005 hacia arriba (magnitud) → −0.01", () => {
    expect(roundHalfUp(D("-0.005")).toString()).toBe("-0.01");
  });

  it("mantiene entero sin decimales → mismo valor numérico", () => {
    expect(roundHalfUp(D("100")).toNumber()).toBe(100);
  });

  it("valor ya tiene 2 decimales — sin cambio", () => {
    expect(roundHalfUp(D("1234.56")).toString()).toBe("1234.56");
  });

  it("redondea 1.555 → 1.56", () => {
    expect(roundHalfUp(D("1.555")).toString()).toBe("1.56");
  });
});

describe("sumDecimals", () => {
  // RED: lista vacía → 0
  it("lista vacía → 0", () => {
    expect(sumDecimals([]).toString()).toBe("0");
  });

  // GREEN
  it("suma un único elemento", () => {
    expect(sumDecimals([D("42.5")]).toString()).toBe("42.5");
  });

  // TRIANGULATE
  it("suma múltiples elementos positivos", () => {
    expect(sumDecimals([D("10"), D("20.5"), D("5.5")]).toString()).toBe("36");
  });

  it("suma mezcla de positivos y negativos", () => {
    expect(sumDecimals([D("100"), D("-50"), D("-25")]).toString()).toBe("25");
  });

  it("suma dos elementos con muchos decimales sin perder precisión", () => {
    const result = sumDecimals([D("1.123456789"), D("2.876543211")]);
    expect(result.toString()).toBe("4");
  });
});

describe("eq", () => {
  // RED: dentro de tolerancia ±0.01 → true
  it("retorna true si la diferencia es exactamente 0", () => {
    expect(eq(D("100"), D("100"))).toBe(true);
  });

  it("retorna true si la diferencia es 0.01 (justo en el límite)", () => {
    expect(eq(D("100.01"), D("100"))).toBe(true);
  });

  it("retorna true si la diferencia es −0.01 (límite negativo)", () => {
    expect(eq(D("99.99"), D("100"))).toBe(true);
  });

  // TRIANGULATE: fuera de tolerancia → false
  it("retorna false si la diferencia supera 0.01", () => {
    expect(eq(D("100.02"), D("100"))).toBe(false);
  });

  it("retorna false si la diferencia es −0.02", () => {
    expect(eq(D("99.98"), D("100"))).toBe(false);
  });

  it("retorna true para dos ceros", () => {
    expect(eq(D("0"), D("0"))).toBe(true);
  });
});

describe("serializeStatement", () => {
  // RED: convierte Decimal → string redondeado half-up
  it("convierte un Decimal a string con 2 decimales half-up", () => {
    const obj = { balance: D("1234.565") };
    const result = serializeStatement(obj);
    expect(result.balance).toBe("1234.57");
  });

  // TRIANGULATE: objeto plano con múltiples Decimals
  it("convierte todos los Decimals en un objeto plano", () => {
    const obj = { a: D("1.005"), b: D("2.004"), c: "texto", d: 42 };
    const result = serializeStatement(obj);
    expect(result.a).toBe("1.01");
    expect(result.b).toBe("2.00");
    expect(result.c).toBe("texto"); // strings sin cambio
    expect(result.d).toBe(42); // numbers sin cambio
  });

  // Objeto anidado
  it("convierte Decimals en objetos anidados", () => {
    const obj = { group: { total: D("99.999"), label: "test" } };
    const result = serializeStatement(obj);
    expect(result.group.total).toBe("100.00");
    expect(result.group.label).toBe("test");
  });

  // Array de Decimals
  it("convierte Decimals dentro de arrays", () => {
    const obj = { values: [D("0.005"), D("0.004")] };
    const result = serializeStatement(obj);
    expect(result.values[0]).toBe("0.01");
    expect(result.values[1]).toBe("0.00");
  });

  // null/undefined se preservan
  it("preserva null y undefined sin error", () => {
    const obj = { x: null, y: undefined, z: D("1.5") };
    const result = serializeStatement(obj);
    expect(result.x).toBeNull();
    expect(result.y).toBeUndefined();
    expect(result.z).toBe("1.50");
  });
});
