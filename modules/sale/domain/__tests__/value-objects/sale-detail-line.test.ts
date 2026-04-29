import { describe, it, expect } from "vitest";
import { SaleDetailLine } from "../../value-objects/sale-detail-line";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { InvalidSaleDetailLine } from "../../errors/sale-errors";

describe("SaleDetailLine", () => {
  it("crea una línea con todos los campos definidos", () => {
    const line = SaleDetailLine.create({
      description: "Servicio profesional",
      lineAmount: MonetaryAmount.of(100),
      incomeAccountId: "acc-1",
      order: 0,
      quantity: 2,
      unitPrice: MonetaryAmount.of(50),
    });
    expect(line.description).toBe("Servicio profesional");
    expect(line.lineAmount.value).toBe(100);
    expect(line.incomeAccountId).toBe("acc-1");
    expect(line.order).toBe(0);
    expect(line.quantity).toBe(2);
    expect(line.unitPrice?.value).toBe(50);
  });

  it("crea una línea sin quantity ni unitPrice (importe directo)", () => {
    const line = SaleDetailLine.create({
      description: "Importe directo",
      lineAmount: MonetaryAmount.of(150),
      incomeAccountId: "acc-1",
      order: 0,
    });
    expect(line.quantity).toBeUndefined();
    expect(line.unitPrice).toBeUndefined();
  });

  it("acepta lineAmount cero", () => {
    const line = SaleDetailLine.create({
      description: "Línea cero",
      lineAmount: MonetaryAmount.zero(),
      incomeAccountId: "acc-1",
      order: 0,
    });
    expect(line.lineAmount.value).toBe(0);
  });

  it("rechaza description vacío", () => {
    expect(() =>
      SaleDetailLine.create({
        description: "",
        lineAmount: MonetaryAmount.of(100),
        incomeAccountId: "acc-1",
        order: 0,
      }),
    ).toThrow(InvalidSaleDetailLine);
  });

  it("rechaza description con solo whitespace", () => {
    expect(() =>
      SaleDetailLine.create({
        description: "   ",
        lineAmount: MonetaryAmount.of(100),
        incomeAccountId: "acc-1",
        order: 0,
      }),
    ).toThrow(InvalidSaleDetailLine);
  });

  it("rechaza incomeAccountId vacío", () => {
    expect(() =>
      SaleDetailLine.create({
        description: "Servicio",
        lineAmount: MonetaryAmount.of(100),
        incomeAccountId: "",
        order: 0,
      }),
    ).toThrow(InvalidSaleDetailLine);
  });

  it("rechaza order negativo", () => {
    expect(() =>
      SaleDetailLine.create({
        description: "Servicio",
        lineAmount: MonetaryAmount.of(100),
        incomeAccountId: "acc-1",
        order: -1,
      }),
    ).toThrow(InvalidSaleDetailLine);
  });

  it("rechaza quantity negativo", () => {
    expect(() =>
      SaleDetailLine.create({
        description: "Servicio",
        lineAmount: MonetaryAmount.of(100),
        incomeAccountId: "acc-1",
        order: 0,
        quantity: -1,
        unitPrice: MonetaryAmount.of(50),
      }),
    ).toThrow(InvalidSaleDetailLine);
  });
});
