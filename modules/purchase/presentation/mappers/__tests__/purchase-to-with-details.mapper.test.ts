import { describe, expect, it } from "vitest";

import { Purchase } from "@/modules/purchase/domain/purchase.entity";
import { PurchaseDetail } from "@/modules/purchase/domain/purchase-detail.entity";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

import {
  toContactSummary,
  toPayableSummary,
  toPeriodSummary,
  toPurchaseDetailRow,
  toPurchaseWithDetails,
} from "../purchase-to-with-details.mapper";

/**
 * Smoke type-check + runtime behavior para mappers presentation Purchase
 * (purchase-pure-read — mirror sale-pure-read pilot
 * `sale-to-with-details.mapper.test.ts`).
 *
 * Purchase-pure-read: deps ya NO llegan como Prisma raw con Decimal — el
 * caller (page) los carga via read ports (`PurchaseContactReaderPort` /
 * `PurchasePayableReaderPort`) cuyos adapters convierten Decimal→number en el
 * boundary infrastructure. El mapper consume shapes limpios (numbers) y NO
 * importa Prisma ni siquiera type-only.
 *
 * RED acceptance failure mode: FAILS pre-refactor porque `toPayableSummary`
 * invoca `.toNumber()` sobre los montos (espera Prisma.Decimal) → TypeError
 * al recibir plain numbers. Post-GREEN: PASSES porque el mapper hace
 * passthrough de numbers limpios (Decimal→number ya ocurrió en el adapter).
 */

describe("purchase-to-with-details mappers (smoke)", () => {
  // ── Test 1: toContactSummary passthrough ──────────────────────────────────────

  it("toContactSummary passthrough clean view → DTO contact shape", () => {
    const contact = {
      id: "c-1",
      name: "Proveedor Uno",
      type: "PROVEEDOR",
      nit: "12345-6",
      paymentTermsDays: 30,
    };
    const result = toContactSummary(contact);
    expect(result).toEqual(contact);
    expect(result.nit).toBe("12345-6");
    expect(result.paymentTermsDays).toBe(30);
  });

  // ── Test 2: toPeriodSummary passthrough ───────────────────────────────────────

  it("toPeriodSummary passthrough clean view → DTO period shape", () => {
    const period = { id: "p-1", name: "Enero 2026", status: "OPEN" };
    expect(toPeriodSummary(period)).toEqual(period);
  });

  // ── Test 3: toPayableSummary clean numbers + nested allocations ───────────────

  it("toPayableSummary clean numbers passthrough + nested allocations + payment.date toISOString", () => {
    const paymentDate = new Date("2026-03-15T10:00:00Z");
    const payable = {
      id: "pay-1",
      amount: 150,
      paid: 50,
      balance: 100,
      status: "PARTIAL",
      dueDate: new Date("2026-04-30"),
      allocations: [
        {
          id: "a-1",
          paymentId: "pmt-1",
          amount: 50,
          payment: {
            id: "pmt-1",
            date: paymentDate,
            description: "Pago parcial",
          },
        },
      ],
    };
    const result = toPayableSummary(payable);
    expect(result.id).toBe("pay-1");
    expect(result.amount).toBe(150);
    expect(result.paid).toBe(50);
    expect(result.balance).toBe(100);
    expect(result.status).toBe("PARTIAL");
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].amount).toBe(50);
    expect(result.allocations[0].payment.date).toBe(paymentDate.toISOString());
  });

  // ── Test 4: toPurchaseDetailRow MonetaryAmount→number conversion ──────────────

  it("toPurchaseDetailRow MonetaryAmount→number + optional fields undefined→null", () => {
    const detail = PurchaseDetail.fromPersistence({
      id: "d-1",
      purchaseId: "pu-1",
      description: "Línea uno",
      lineAmount: MonetaryAmount.of(99.5),
      order: 0,
      quantity: undefined,
      unitPrice: undefined,
      expenseAccountId: "acc-1",
    });
    const row = toPurchaseDetailRow(detail);
    expect(row.id).toBe("d-1");
    expect(row.purchaseId).toBe("pu-1");
    expect(row.description).toBe("Línea uno");
    expect(row.lineAmount).toBe(99.5);
    expect(row.quantity).toBeNull();
    expect(row.unitPrice).toBeNull();
    expect(row.grossWeight).toBeNull();
    expect(row.realNetWeight).toBeNull();
    expect(row.order).toBe(0);
    expect(row.expenseAccountId).toBe("acc-1");
  });

  // ── Test 5: toPurchaseWithDetails main compositor end-to-end ──────────────────

  it("toPurchaseWithDetails main compositor caller-passes-deps Purchase entity + deps → PurchaseWithDetails", () => {
    const detail = PurchaseDetail.fromPersistence({
      id: "d-1",
      purchaseId: "pu-1",
      description: "Línea uno",
      lineAmount: MonetaryAmount.of(100),
      order: 0,
      quantity: 2,
      unitPrice: 50,
      expenseAccountId: "acc-1",
    });
    const purchase = Purchase.fromPersistence({
      id: "pu-1",
      organizationId: "org-1",
      purchaseType: "COMPRA_GENERAL",
      status: "POSTED",
      sequenceNumber: 7,
      date: new Date("2026-03-01"),
      contactId: "c-1",
      periodId: "p-1",
      description: "Compra de prueba",
      referenceNumber: 100,
      notes: null,
      totalAmount: MonetaryAmount.of(100),
      ruta: null,
      farmOrigin: null,
      chickenCount: null,
      shrinkagePct: null,
      totalGrossKg: null,
      totalNetKg: null,
      totalShrinkKg: null,
      totalShortageKg: null,
      totalRealNetKg: null,
      journalEntryId: "j-1",
      payableId: "pay-1",
      createdById: "u-1",
      createdAt: new Date("2026-03-01"),
      updatedAt: new Date("2026-03-01"),
      details: [detail],
      payable: null,
    });
    const deps = {
      contact: {
        id: "c-1",
        name: "Proveedor Uno",
        type: "PROVEEDOR",
        nit: null,
        paymentTermsDays: null,
      },
      period: { id: "p-1", name: "Marzo 2026", status: "OPEN" },
    };
    const result = toPurchaseWithDetails(purchase, deps);
    expect(result.id).toBe("pu-1");
    expect(result.organizationId).toBe("org-1");
    expect(result.purchaseType).toBe("COMPRA_GENERAL");
    expect(result.status).toBe("POSTED");
    expect(result.sequenceNumber).toBe(7);
    expect(result.totalAmount).toBe(100);
    expect(result.contact.name).toBe("Proveedor Uno");
    expect(result.period.name).toBe("Marzo 2026");
    expect(result.createdById).toBe("u-1");
    expect(result.details).toHaveLength(1);
    expect(result.details[0].lineAmount).toBe(100);
    expect(result.details[0].quantity).toBe(2);
    expect(result.payable).toBeNull();
  });
});
