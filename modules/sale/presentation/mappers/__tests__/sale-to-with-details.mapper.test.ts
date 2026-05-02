import { describe, expect, it } from "vitest";

import type { Prisma } from "@/generated/prisma/client";

import { Sale } from "@/modules/sale/domain/sale.entity";
import { SaleDetail } from "@/modules/sale/domain/sale-detail.entity";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

import {
  computeDisplayCode,
  toContactSummary,
  toPeriodSummary,
  toReceivableSummary,
  toSaleDetailRow,
  toSaleWithDetails,
} from "../sale-to-with-details.mapper";

/**
 * Smoke type-check + runtime behavior para mappers presentation Sale (POC nuevo
 * A3-C3 GREEN — caller-passes-deps pattern).
 *
 * Cobertura post A3-C3.5 §13.W drop createdBy: 7 it() blocks (6 sub-mapper +
 * 1 displayCode null edge). Test 5 `toCreatedBySummary passthrough` dropeado +
 * Test 8 composite modificado (sin createdBy en deps + result assertion):
 *   1. computeDisplayCode happy path VG-NNN padStart 3 (mirror legacy getDisplayCode)
 *   2. computeDisplayCode null edge throws (SubQ-d fail-fast — DRAFT sales)
 *   3. toContactSummary passthrough Prisma raw → DTO contact shape
 *   4. toPeriodSummary passthrough Prisma raw → DTO period shape
 *   5. toReceivableSummary Decimal→number + nested allocations + payment.date toISOString
 *   6. toSaleDetailRow MonetaryAmount→number + quantity/unitPrice undefined→null
 *   7. toSaleWithDetails main compositor caller-passes-deps Sale entity + deps → SaleWithDetails end-to-end
 *
 * Decimal mocking: type-only `import type { Prisma }` + cast to satisfy
 * `.toNumber()` interface (R5 banPrismaInPresentation preserved — no runtime
 * Decimal value import; A3-C1.5 §13.V carve-out allowTypeImports: true).
 */

const fakeDecimal = (n: number): Prisma.Decimal =>
  ({ toNumber: () => n }) as unknown as Prisma.Decimal;

describe("sale-to-with-details mappers (smoke)", () => {
  // ── Test 1: computeDisplayCode happy path ─────────────────────────────────────

  it("computeDisplayCode formats VG-NNN with padStart 3 (mirror legacy getDisplayCode)", () => {
    expect(computeDisplayCode(1)).toBe("VG-001");
    expect(computeDisplayCode(42)).toBe("VG-042");
    expect(computeDisplayCode(999)).toBe("VG-999");
    expect(computeDisplayCode(1000)).toBe("VG-1000");
  });

  // ── Test 2: computeDisplayCode null edge (SubQ-d fail-fast) ───────────────────

  it("computeDisplayCode throws when sequenceNumber is null (DRAFT sales SubQ-d fail-fast)", () => {
    expect(() => computeDisplayCode(null)).toThrow(/sequenceNumber/);
  });

  // ── Test 3: toContactSummary passthrough ──────────────────────────────────────

  it("toContactSummary passthrough Prisma raw → DTO contact shape", () => {
    const contact = {
      id: "c-1",
      name: "Cliente Uno",
      type: "CLIENTE",
      nit: "12345-6",
      paymentTermsDays: 30,
    };
    const result = toContactSummary(contact);
    expect(result).toEqual(contact);
    expect(result.nit).toBe("12345-6");
    expect(result.paymentTermsDays).toBe(30);
  });

  // ── Test 4: toPeriodSummary passthrough ───────────────────────────────────────

  it("toPeriodSummary passthrough Prisma raw → DTO period shape", () => {
    const period = { id: "p-1", name: "Enero 2026", status: "OPEN" };
    expect(toPeriodSummary(period)).toEqual(period);
  });

  // ── Test 5: toReceivableSummary Decimal→number + nested allocations ───────────

  it("toReceivableSummary Decimal→number + nested allocations + payment.date toISOString", () => {
    const paymentDate = new Date("2026-03-15T10:00:00Z");
    const receivable = {
      id: "r-1",
      amount: fakeDecimal(150),
      paid: fakeDecimal(50),
      balance: fakeDecimal(100),
      status: "PARTIAL",
      dueDate: new Date("2026-04-30"),
      allocations: [
        {
          id: "a-1",
          paymentId: "pay-1",
          amount: fakeDecimal(50),
          payment: {
            id: "pay-1",
            date: paymentDate,
            description: "Pago parcial",
          },
        },
      ],
    };
    const result = toReceivableSummary(receivable);
    expect(result.id).toBe("r-1");
    expect(result.amount).toBe(150);
    expect(result.paid).toBe(50);
    expect(result.balance).toBe(100);
    expect(result.status).toBe("PARTIAL");
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].amount).toBe(50);
    expect(result.allocations[0].payment.date).toBe(paymentDate.toISOString());
  });

  // ── Test 6: toSaleDetailRow MonetaryAmount→number conversion ──────────────────

  it("toSaleDetailRow MonetaryAmount→number + quantity/unitPrice undefined→null", () => {
    const detail = SaleDetail.fromPersistence({
      id: "d-1",
      saleId: "s-1",
      description: "Línea uno",
      lineAmount: MonetaryAmount.of(99.5),
      order: 0,
      quantity: undefined,
      unitPrice: undefined,
      incomeAccountId: "acc-1",
    });
    const row = toSaleDetailRow(detail);
    expect(row.id).toBe("d-1");
    expect(row.saleId).toBe("s-1");
    expect(row.description).toBe("Línea uno");
    expect(row.lineAmount).toBe(99.5);
    expect(row.quantity).toBeNull();
    expect(row.unitPrice).toBeNull();
    expect(row.order).toBe(0);
    expect(row.incomeAccountId).toBe("acc-1");
  });

  // ── Test 7: toSaleWithDetails main compositor end-to-end ──────────────────────

  it("toSaleWithDetails main compositor caller-passes-deps Sale entity + deps → SaleWithDetails", () => {
    const detail = SaleDetail.fromPersistence({
      id: "d-1",
      saleId: "s-1",
      description: "Línea uno",
      lineAmount: MonetaryAmount.of(100),
      order: 0,
      quantity: 2,
      unitPrice: 50,
      incomeAccountId: "acc-1",
    });
    const sale = Sale.fromPersistence({
      id: "s-1",
      organizationId: "org-1",
      status: "POSTED",
      sequenceNumber: 7,
      date: new Date("2026-03-01"),
      contactId: "c-1",
      periodId: "p-1",
      description: "Venta de prueba",
      referenceNumber: 100,
      notes: null,
      totalAmount: MonetaryAmount.of(100),
      journalEntryId: "j-1",
      receivableId: "r-1",
      createdById: "u-1",
      createdAt: new Date("2026-03-01"),
      updatedAt: new Date("2026-03-01"),
      details: [detail],
      receivable: null,
    });
    const deps = {
      contact: {
        id: "c-1",
        name: "Cliente Uno",
        type: "CLIENTE",
        nit: null,
        paymentTermsDays: null,
      },
      period: { id: "p-1", name: "Marzo 2026", status: "OPEN" },
    };
    const result = toSaleWithDetails(sale, deps);
    expect(result.id).toBe("s-1");
    expect(result.organizationId).toBe("org-1");
    expect(result.status).toBe("POSTED");
    expect(result.sequenceNumber).toBe(7);
    expect(result.totalAmount).toBe(100);
    expect(result.displayCode).toBe("VG-007");
    expect(result.contact.name).toBe("Cliente Uno");
    expect(result.period.name).toBe("Marzo 2026");
    expect(result.createdById).toBe("u-1");
    expect(result.details).toHaveLength(1);
    expect(result.details[0].lineAmount).toBe(100);
    expect(result.details[0].quantity).toBe(2);
    expect(result.receivable).toBeNull();
    expect(result.ivaSalesBook).toBeNull();
  });
});
