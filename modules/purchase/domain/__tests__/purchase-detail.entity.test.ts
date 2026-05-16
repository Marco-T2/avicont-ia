import { describe, it, expect } from "vitest";
import { PurchaseDetail } from "../purchase-detail.entity";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { InvalidPurchaseDetailLine } from "../errors/purchase-errors";

describe("PurchaseDetail entity", () => {
  it("crea una entity con id generado y campos core", () => {
    const detail = PurchaseDetail.create({
      purchaseId: "purchase-1",
      description: "Línea de servicio",
      lineAmount: MonetaryAmount.of(100),
      order: 0,
      quantity: 2,
      unitPrice: 50,
      expenseAccountId: "acc-1",
    });
    expect(detail.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(detail.purchaseId).toBe("purchase-1");
    expect(detail.description).toBe("Línea de servicio");
    expect(detail.lineAmount.value).toBe(100);
    expect(detail.order).toBe(0);
    expect(detail.quantity).toBe(2);
    expect(detail.unitPrice).toBe(50);
    expect(detail.expenseAccountId).toBe("acc-1");
  });

  it("crea una entity sin quantity ni unitPrice ni expenseAccountId (FLETE-shape mínimo)", () => {
    const detail = PurchaseDetail.create({
      purchaseId: "purchase-1",
      description: "Importe directo",
      lineAmount: MonetaryAmount.of(150),
      order: 0,
    });
    expect(detail.quantity).toBeUndefined();
    expect(detail.unitPrice).toBeUndefined();
    expect(detail.expenseAccountId).toBeUndefined();
  });

  it("hidrata desde persistencia preservando id existente", () => {
    const detail = PurchaseDetail.fromPersistence({
      id: "cuid-existing",
      purchaseId: "purchase-1",
      description: "Detalle persistido",
      lineAmount: MonetaryAmount.of(200),
      order: 1,
      quantity: 4,
      unitPrice: 50,
      expenseAccountId: "acc-1",
    });
    expect(detail.id).toBe("cuid-existing");
    expect(detail.lineAmount.value).toBe(200);
    expect(detail.order).toBe(1);
  });

  it("hidrata FLETE-shape con polymorphic fields (chickenQty, pricePerChicken, fecha, docRef)", () => {
    const detail = PurchaseDetail.fromPersistence({
      id: "cuid-flete",
      purchaseId: "purchase-flete",
      description: "Flete L-100",
      lineAmount: MonetaryAmount.of(800),
      order: 0,
      fecha: new Date("2026-04-15"),
      docRef: "FL-100",
      chickenQty: 1500,
      pricePerChicken: 0.53,
    });
    expect(detail.fecha).toEqual(new Date("2026-04-15"));
    expect(detail.docRef).toBe("FL-100");
    expect(detail.chickenQty).toBe(1500);
    expect(detail.pricePerChicken).toBe(0.53);
  });

  it("hidrata POLLO_FAENADO-shape con weights y productTypeId", () => {
    const detail = PurchaseDetail.fromPersistence({
      id: "cuid-pf",
      purchaseId: "purchase-pf",
      description: "Faena 100kg",
      lineAmount: MonetaryAmount.of(1500),
      order: 0,
      productTypeId: "pt-1",
      boxes: 10,
      grossWeight: 105.5,
      tare: 5.0,
      netWeight: 100.5,
      shrinkage: 0.5,
      shortage: 0,
      realNetWeight: 100.0,
      unitPrice: 15,
    });
    expect(detail.productTypeId).toBe("pt-1");
    expect(detail.boxes).toBe(10);
    expect(detail.grossWeight).toBe(105.5);
    expect(detail.netWeight).toBe(100.5);
  });

  it("acepta lineAmount cero", () => {
    const detail = PurchaseDetail.create({
      purchaseId: "purchase-1",
      description: "Línea cero",
      lineAmount: MonetaryAmount.zero(),
      order: 0,
    });
    expect(detail.lineAmount.value).toBe(0);
  });

  it("acepta description vacío", () => {
    expect(() =>
      PurchaseDetail.create({
        purchaseId: "purchase-1",
        description: "",
        lineAmount: MonetaryAmount.of(100),
        order: 0,
      }),
    ).not.toThrow();
  });

  it("acepta description con solo whitespace", () => {
    expect(() =>
      PurchaseDetail.create({
        purchaseId: "purchase-1",
        description: "   ",
        lineAmount: MonetaryAmount.of(100),
        order: 0,
      }),
    ).not.toThrow();
  });

  it("rechaza order negativo", () => {
    expect(() =>
      PurchaseDetail.create({
        purchaseId: "purchase-1",
        description: "Servicio",
        lineAmount: MonetaryAmount.of(100),
        order: -1,
      }),
    ).toThrow(InvalidPurchaseDetailLine);
  });

  it("rechaza quantity negativo", () => {
    expect(() =>
      PurchaseDetail.create({
        purchaseId: "purchase-1",
        description: "Servicio",
        lineAmount: MonetaryAmount.of(100),
        order: 0,
        quantity: -1,
        unitPrice: 50,
      }),
    ).toThrow(InvalidPurchaseDetailLine);
  });

  it("rechaza unitPrice negativo", () => {
    expect(() =>
      PurchaseDetail.create({
        purchaseId: "purchase-1",
        description: "Servicio",
        lineAmount: MonetaryAmount.of(100),
        order: 0,
        quantity: 1,
        unitPrice: -10,
      }),
    ).toThrow(InvalidPurchaseDetailLine);
  });
});
