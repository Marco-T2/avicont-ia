import { describe, it, expect } from "vitest";
import { SaleDetail } from "../sale-detail.entity";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { InvalidSaleDetailLine } from "../errors/sale-errors";

describe("SaleDetail entity", () => {
  it("crea una entity con id generado y todos los campos", () => {
    const detail = SaleDetail.create({
      saleId: "sale-1",
      description: "Servicio profesional",
      lineAmount: MonetaryAmount.of(100),
      incomeAccountId: "acc-1",
      order: 0,
      quantity: 2,
      unitPrice: 50,
    });
    expect(detail.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(detail.saleId).toBe("sale-1");
    expect(detail.description).toBe("Servicio profesional");
    expect(detail.lineAmount.value).toBe(100);
    expect(detail.incomeAccountId).toBe("acc-1");
    expect(detail.order).toBe(0);
    expect(detail.quantity).toBe(2);
    expect(detail.unitPrice).toBe(50);
  });

  it("crea una entity sin quantity ni unitPrice (importe directo)", () => {
    const detail = SaleDetail.create({
      saleId: "sale-1",
      description: "Importe directo",
      lineAmount: MonetaryAmount.of(150),
      incomeAccountId: "acc-1",
      order: 0,
    });
    expect(detail.quantity).toBeUndefined();
    expect(detail.unitPrice).toBeUndefined();
  });

  it("hidrata desde persistencia preservando id existente", () => {
    const detail = SaleDetail.fromPersistence({
      id: "cuid-existing",
      saleId: "sale-1",
      description: "Detalle persistido",
      lineAmount: MonetaryAmount.of(200),
      incomeAccountId: "acc-1",
      order: 1,
      quantity: 4,
      unitPrice: 50,
    });
    expect(detail.id).toBe("cuid-existing");
    expect(detail.lineAmount.value).toBe(200);
    expect(detail.order).toBe(1);
  });

  it("acepta lineAmount cero", () => {
    const detail = SaleDetail.create({
      saleId: "sale-1",
      description: "Línea cero",
      lineAmount: MonetaryAmount.zero(),
      incomeAccountId: "acc-1",
      order: 0,
    });
    expect(detail.lineAmount.value).toBe(0);
  });

  it("acepta description vacío", () => {
    expect(() =>
      SaleDetail.create({
        saleId: "sale-1",
        description: "",
        lineAmount: MonetaryAmount.of(100),
        incomeAccountId: "acc-1",
        order: 0,
      }),
    ).not.toThrow();
  });

  it("acepta description con solo whitespace", () => {
    expect(() =>
      SaleDetail.create({
        saleId: "sale-1",
        description: "   ",
        lineAmount: MonetaryAmount.of(100),
        incomeAccountId: "acc-1",
        order: 0,
      }),
    ).not.toThrow();
  });

  it("rechaza incomeAccountId vacío", () => {
    expect(() =>
      SaleDetail.create({
        saleId: "sale-1",
        description: "Servicio",
        lineAmount: MonetaryAmount.of(100),
        incomeAccountId: "",
        order: 0,
      }),
    ).toThrow(InvalidSaleDetailLine);
  });

  it("rechaza order negativo", () => {
    expect(() =>
      SaleDetail.create({
        saleId: "sale-1",
        description: "Servicio",
        lineAmount: MonetaryAmount.of(100),
        incomeAccountId: "acc-1",
        order: -1,
      }),
    ).toThrow(InvalidSaleDetailLine);
  });

  it("rechaza quantity negativo", () => {
    expect(() =>
      SaleDetail.create({
        saleId: "sale-1",
        description: "Servicio",
        lineAmount: MonetaryAmount.of(100),
        incomeAccountId: "acc-1",
        order: 0,
        quantity: -1,
        unitPrice: 50,
      }),
    ).toThrow(InvalidSaleDetailLine);
  });

  it("rechaza unitPrice negativo", () => {
    expect(() =>
      SaleDetail.create({
        saleId: "sale-1",
        description: "Servicio",
        lineAmount: MonetaryAmount.of(100),
        incomeAccountId: "acc-1",
        order: 0,
        quantity: 1,
        unitPrice: -10,
      }),
    ).toThrow(InvalidSaleDetailLine);
  });
});
