/**
 * Phase 8.2 — E2E happy path (annual-close standard path).
 *
 * The load-bearing test for the entire annual-close change. Postgres-real,
 * composes the full hex module via `makeAnnualCloseService()` (composition
 * root canónico), and asserts every observable side effect of a successful
 * standard-path close:
 *
 *   • HTTP-equivalent: service.close returns AnnualCloseResult with correct
 *     `fiscalYearId`, `year`, `status=CLOSED`, `closedAt`, `correlationId`,
 *     `closingEntryId`, `openingEntryId` (result entry IDs — service-level
 *     contract preserved, NOT FK columns), `yearPlus1.periodIds` (12),
 *     `decClose.locked.*` (5 cascade counts).
 *   • FiscalYear 2099 row: status=CLOSED with closedAt + closedBy populated
 *     (FK columns RETIRED per CAN-5.6 — JournalEntry.sourceId reverse-lookup).
 *   • CC JournalEntry: Dec 2099, POSTED→LOCKED (post lock-cascade),
 *     sourceType="annual-close", sourceId=FY.id, DEBE === HABER bit-perfect
 *     via Decimal.equals.
 *   • 3.2.2 Resultado de la Gestión receives the profit balancing line.
 *   • CA JournalEntry: Jan 2100, POSTED, sourceType="annual-close",
 *     sourceId=FY.id, DEBE === HABER bit-perfect.
 *   • 12 year+1 (2100) FiscalPeriods exist with status=OPEN, named Spanish
 *     month names ("Enero 2100" .. "Diciembre 2100"), UTC ranges via
 *     MonthlyRange.of().
 *   • Dec 2099 FiscalPeriod: status=CLOSED, closedAt + closedBy populated.
 *   • All audit_logs share the returned correlationId.
 *
 * Seed shape (same as audit-trail test):
 *   • Months 1-11 of 2099 → status CLOSED (closed by prior monthly-closes).
 *   • Month 12 of 2099 → status OPEN.
 *   • 3 seed JEs in 2099 ledger producing a balanced trial balance:
 *     - Jan: Capital deposit (Caja 100k debit / Capital 100k credit).
 *     - Jun: Sales (Caja 60k debit / Ventas 60k credit).
 *     - Nov: Expense (Gastos 40k debit / Caja 40k credit).
 *   • Result: Caja 120k debit-net / Capital 100k credit-net + Ventas-Gastos
 *     = 20k profit → 3.2.2 gets 20k HABER on CC.
 *
 * Fixture pattern mirrors `prisma-monthly-close-unit-of-work.integration.test.ts`
 * (stamp prefix `achp-`). FK-safe cleanup convention P2.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { prisma } from "@/lib/prisma";
import { lastDayOfUTCMonth } from "@/lib/date-utils";
import { monthNameEs } from "@/modules/fiscal-periods/domain/month-names";
import { makeAnnualCloseService } from "@/modules/annual-close/presentation/server";

const STAMP_PREFIX = "achp";

describe("annual-close happy path (E2E) — Postgres integration", () => {
  let testOrgId: string;
  let testUserId: string;
  let testAccountIds: {
    cashActivo: string;
    capitalPatrimonio: string;
    salesIngreso: string;
    expenseGasto: string;
    resultadoGestion: string;
  };
  const testYear = 2099;
  const periodIds: string[] = [];

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `${STAMP_PREFIX}-clerk-user-${stamp}`,
        email: `${STAMP_PREFIX}-${stamp}@test.local`,
        name: "AnnualCloseHappyPath Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `${STAMP_PREFIX}-clerk-org-${stamp}`,
        name: `AnnualCloseHappyPath Integration Test Org ${stamp}`,
        slug: `${STAMP_PREFIX}-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    await prisma.voucherTypeCfg.createMany({
      data: [
        {
          organizationId: testOrgId,
          code: "CC",
          prefix: "C",
          name: "Comprobante de Cierre",
          isAdjustment: true,
        },
        {
          organizationId: testOrgId,
          code: "CA",
          prefix: "A",
          name: "Comprobante de Apertura",
          isAdjustment: false,
        },
        {
          organizationId: testOrgId,
          code: "CD",
          prefix: "D",
          name: "Comprobante de Diario",
          isAdjustment: false,
        },
      ],
    });

    const cdType = await prisma.voucherTypeCfg.findUniqueOrThrow({
      where: { organizationId_code: { organizationId: testOrgId, code: "CD" } },
    });

    const cash = await prisma.account.create({
      data: {
        organizationId: testOrgId,
        code: "1.1.1",
        name: "Caja",
        type: "ACTIVO",
        nature: "DEUDORA",
        level: 3,
        isDetail: true,
      },
    });
    const capital = await prisma.account.create({
      data: {
        organizationId: testOrgId,
        code: "3.1.1",
        name: "Capital Social",
        type: "PATRIMONIO",
        nature: "ACREEDORA",
        level: 3,
        isDetail: true,
      },
    });
    const sales = await prisma.account.create({
      data: {
        organizationId: testOrgId,
        code: "4.1.1",
        name: "Ventas",
        type: "INGRESO",
        nature: "ACREEDORA",
        level: 3,
        isDetail: true,
      },
    });
    const expense = await prisma.account.create({
      data: {
        organizationId: testOrgId,
        code: "5.1.1",
        name: "Gastos Generales",
        type: "GASTO",
        nature: "DEUDORA",
        level: 3,
        isDetail: true,
      },
    });
    const resultadoGestion = await prisma.account.create({
      data: {
        organizationId: testOrgId,
        code: "3.2.2",
        name: "Resultado de la Gestión",
        type: "PATRIMONIO",
        nature: "ACREEDORA",
        level: 3,
        isDetail: true,
      },
    });
    testAccountIds = {
      cashActivo: cash.id,
      capitalPatrimonio: capital.id,
      salesIngreso: sales.id,
      expenseGasto: expense.id,
      resultadoGestion: resultadoGestion.id,
    };

    // 12 periods — months 1-11 CLOSED, month 12 OPEN (standard path).
    for (let month = 1; month <= 12; month++) {
      const startDate = new Date(Date.UTC(testYear, month - 1, 1));
      const endDate = lastDayOfUTCMonth(startDate);
      const period = await prisma.fiscalPeriod.create({
        data: {
          organizationId: testOrgId,
          name: `${monthNameEs(month)} ${testYear}`,
          year: testYear,
          month,
          startDate,
          endDate,
          status: month === 12 ? "OPEN" : "CLOSED",
          closedAt: month === 12 ? null : new Date(`${testYear}-${String(month).padStart(2, "0")}-28T12:00:00Z`),
          closedBy: month === 12 ? null : testUserId,
          createdById: testUserId,
        },
      });
      periodIds.push(period.id);
    }

    // Seed 3 balanced JEs across the year — LOCKED for months 1-11 (mirror
    // monthly-close having locked their period's JEs).
    const seedJE = async (
      periodIdx: number,
      voucherNumber: number,
      date: string,
      lines: Array<{ accountId: string; debit: string; credit: string }>,
    ) => {
      const status = periodIdx === 11 ? "POSTED" : "LOCKED"; // Dec (idx 11) is OPEN — its JEs are POSTED (none seeded here).
      const periodId = periodIds[periodIdx]!;
      await prisma.journalEntry.create({
        data: {
          number: voucherNumber,
          date: new Date(date),
          description: "Seed operating JE",
          status,
          periodId,
          voucherTypeId: cdType.id,
          createdById: testUserId,
          organizationId: testOrgId,
          lines: {
            create: lines.map((l, idx) => ({
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
              order: idx,
            })),
          },
        },
      });
    };

    await seedJE(0, 1, `${testYear}-01-15T12:00:00Z`, [
      { accountId: testAccountIds.cashActivo, debit: "100000.00", credit: "0.00" },
      { accountId: testAccountIds.capitalPatrimonio, debit: "0.00", credit: "100000.00" },
    ]);
    await seedJE(5, 1, `${testYear}-06-15T12:00:00Z`, [
      { accountId: testAccountIds.cashActivo, debit: "60000.00", credit: "0.00" },
      { accountId: testAccountIds.salesIngreso, debit: "0.00", credit: "60000.00" },
    ]);
    await seedJE(10, 1, `${testYear}-11-15T12:00:00Z`, [
      { accountId: testAccountIds.expenseGasto, debit: "40000.00", credit: "0.00" },
      { accountId: testAccountIds.cashActivo, debit: "0.00", credit: "40000.00" },
    ]);
  });

  afterAll(async () => {
    await prisma.journalLine.deleteMany({
      where: { journalEntry: { organizationId: testOrgId } },
    });
    await prisma.fiscalYear.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.journalEntry.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.accountBalance.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.account.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.voucherTypeCfg.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.fiscalPeriod.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.auditLog.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  it("standard path → returns AnnualCloseResult + persists CC/CA/FY/periods/lock-cascade", async () => {
    const service = makeAnnualCloseService();
    const justification =
      "Cierre de la gestión anual 2099 — verificación E2E happy path acceptance.";

    const result = await service.close(
      testOrgId,
      testYear,
      testUserId,
      justification,
    );

    // ── Result shape assertions ──────────────────────────────────────────
    expect(result.year).toBe(testYear);
    expect(result.status).toBe("CLOSED");
    expect(typeof result.fiscalYearId).toBe("string");
    expect(result.fiscalYearId.length).toBeGreaterThan(0);
    expect(typeof result.correlationId).toBe("string");
    expect(result.correlationId.length).toBeGreaterThan(0);
    expect(result.closingEntryId).toBeTruthy();
    expect(result.openingEntryId).toBeTruthy();
    expect(result.closedAt).toBeInstanceOf(Date);
    expect(result.yearPlus1.periodIds.length).toBe(12);
    expect(result.decClose).toBeDefined();
    expect(result.decClose!.locked.dispatches).toBe(0);
    expect(result.decClose!.locked.payments).toBe(0);
    expect(result.decClose!.locked.journalEntries).toBe(1); // the just-posted CC.
    expect(result.decClose!.locked.sales).toBe(0);
    expect(result.decClose!.locked.purchases).toBe(0);

    // ── FiscalYear row state ─────────────────────────────────────────────
    // FK columns closingEntryId/openingEntryId RETIRED per CAN-5.6 — link is
    // now reverse-lookup via JournalEntry.sourceId.
    const fyRow = await prisma.fiscalYear.findUniqueOrThrow({
      where: { id: result.fiscalYearId },
    });
    expect(fyRow.status).toBe("CLOSED");
    expect(fyRow.closedBy).toBe(testUserId);
    expect(fyRow.closedAt).toBeInstanceOf(Date);
    expect(fyRow.year).toBe(testYear);
    expect(fyRow.organizationId).toBe(testOrgId);

    // ── CC JournalEntry state ────────────────────────────────────────────
    const ccEntry = await prisma.journalEntry.findUniqueOrThrow({
      where: { id: result.closingEntryId! },
      include: { lines: true, voucherType: true },
    });
    expect(ccEntry.status).toBe("LOCKED"); // POSTED then locked in cascade.
    expect(ccEntry.voucherType.code).toBe("CC");
    expect(ccEntry.sourceType).toBe("annual-close");
    expect(ccEntry.sourceId).toBe(result.fiscalYearId);
    expect(ccEntry.periodId).toBe(periodIds[11]); // Dec 2099.
    expect(ccEntry.date.toISOString()).toBe(`${testYear}-12-31T12:00:00.000Z`);

    const ccDebit = ccEntry.lines.reduce(
      (s, l) => s.plus(new Decimal(l.debit.toString())),
      new Decimal(0),
    );
    const ccCredit = ccEntry.lines.reduce(
      (s, l) => s.plus(new Decimal(l.credit.toString())),
      new Decimal(0),
    );
    expect(ccDebit.equals(ccCredit)).toBe(true); // bit-perfect via Decimal.equals.

    // 3.2.2 should be on HABER 20k (profit year — Ventas 60k - Gastos 40k).
    const ccResultLine = ccEntry.lines.find(
      (l) => l.accountId === testAccountIds.resultadoGestion,
    );
    expect(ccResultLine).toBeDefined();
    expect(new Decimal(ccResultLine!.credit.toString()).equals(new Decimal("20000"))).toBe(true);
    expect(new Decimal(ccResultLine!.debit.toString()).equals(new Decimal(0))).toBe(true);

    // ── CA JournalEntry state ────────────────────────────────────────────
    const caEntry = await prisma.journalEntry.findUniqueOrThrow({
      where: { id: result.openingEntryId! },
      include: { lines: true, voucherType: true },
    });
    expect(caEntry.status).toBe("POSTED"); // CA is NOT locked (Jan 2100 is OPEN).
    expect(caEntry.voucherType.code).toBe("CA");
    expect(caEntry.sourceType).toBe("annual-close");
    expect(caEntry.sourceId).toBe(result.fiscalYearId);
    expect(caEntry.date.toISOString()).toBe(`${testYear + 1}-01-01T12:00:00.000Z`);

    const caDebit = caEntry.lines.reduce(
      (s, l) => s.plus(new Decimal(l.debit.toString())),
      new Decimal(0),
    );
    const caCredit = caEntry.lines.reduce(
      (s, l) => s.plus(new Decimal(l.credit.toString())),
      new Decimal(0),
    );
    expect(caDebit.equals(caCredit)).toBe(true);

    // CA should NOT contain any INGRESO/GASTO lines (zeroed by CC).
    const caAccountIds = new Set(caEntry.lines.map((l) => l.accountId));
    expect(caAccountIds.has(testAccountIds.salesIngreso)).toBe(false);
    expect(caAccountIds.has(testAccountIds.expenseGasto)).toBe(false);

    // CA should contain Caja (ACTIVO 120k DEBE) + Capital (PATRIMONIO 100k
    // HABER) + 3.2.2 (PATRIMONIO 20k HABER from the just-posted CC).
    const caCash = caEntry.lines.find((l) => l.accountId === testAccountIds.cashActivo);
    expect(caCash).toBeDefined();
    expect(new Decimal(caCash!.debit.toString()).equals(new Decimal("120000"))).toBe(true);

    const caCapital = caEntry.lines.find(
      (l) => l.accountId === testAccountIds.capitalPatrimonio,
    );
    expect(caCapital).toBeDefined();
    expect(new Decimal(caCapital!.credit.toString()).equals(new Decimal("100000"))).toBe(true);

    const caResult = caEntry.lines.find(
      (l) => l.accountId === testAccountIds.resultadoGestion,
    );
    expect(caResult).toBeDefined();
    expect(new Decimal(caResult!.credit.toString()).equals(new Decimal("20000"))).toBe(true);

    // ── 12 year+1 periods ────────────────────────────────────────────────
    const yearPlusOne = await prisma.fiscalPeriod.findMany({
      where: { organizationId: testOrgId, year: testYear + 1 },
      orderBy: { month: "asc" },
    });
    expect(yearPlusOne.length).toBe(12);
    for (const p of yearPlusOne) {
      expect(p.status).toBe("OPEN");
    }
    expect(yearPlusOne[0]!.name).toBe(`Enero ${testYear + 1}`);
    expect(yearPlusOne[11]!.name).toBe(`Diciembre ${testYear + 1}`);
    expect(yearPlusOne.map((p) => p.id)).toEqual(result.yearPlus1.periodIds);

    // ── Dec 2099 FiscalPeriod state ──────────────────────────────────────
    const decRow = await prisma.fiscalPeriod.findUniqueOrThrow({
      where: { id: periodIds[11]! },
    });
    expect(decRow.status).toBe("CLOSED");
    expect(decRow.closedBy).toBe(testUserId);
    expect(decRow.closedAt).toBeInstanceOf(Date);

    // ── audit_logs correlationId propagation ─────────────────────────────
    const auditRows = await prisma.auditLog.findMany({
      where: { correlationId: result.correlationId, organizationId: testOrgId },
      select: { entityType: true, action: true, changedById: true },
    });
    expect(auditRows.length).toBeGreaterThanOrEqual(7);
    expect(auditRows.every((r) => r.changedById === testUserId)).toBe(true);
  });
});
