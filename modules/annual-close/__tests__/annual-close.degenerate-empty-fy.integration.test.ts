/**
 * T-25 — degenerate empty-FY integration test (annual-close-canonical-flow).
 *
 * REQ refs: CAN-5.4 (SKIP-on-zero chain) + REQ-A.1 + REQ-A.4 SKIP-if-zero.
 * Cross-ref: spec #2697 REQ-A.1 + REQ-A.4 + CAN-5.4 + REQ-A.12.
 *
 * Scenario: a FiscalYear with NO movements (no journal entries posted in any
 * period). All 5 builders should produce empty line sets; no createAndPost
 * call should fire; FY.status should still transition to CLOSED; year+1
 * periods should be created.
 *
 * This is the SKIP-on-zero cascade in action: #1 SKIP (no GASTO) → #2 SKIP
 * (no INGRESO) → #3 SKIP (net=0) → #4 SKIP (empty balance) → #5 SKIP
 * (cascade from #4). Only FY markClosed runs.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { lastDayOfUTCMonth } from "@/lib/date-utils";
import { monthNameEs } from "@/modules/fiscal-periods/domain/month-names";

import { makeAnnualCloseService } from "../presentation/composition-root";

describe("annual-close degenerate empty FY (CAN-5.4 SKIP-on-zero chain)", () => {
  const testYear = 2097;
  let testOrgId: string;
  let testUserId: string;
  const periodIds: string[] = [];

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `degenerate-empty-clerk-user-${stamp}`,
        email: `degenerate-empty-${stamp}@test.local`,
        name: "Degenerate Empty Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `degenerate-empty-clerk-org-${stamp}`,
        name: `Degenerate Empty Test Org ${stamp}`,
        slug: `degenerate-empty-${stamp}`,
      },
    });
    testOrgId = org.id;

    // Voucher types CC + CA (required by writer adapter).
    await prisma.voucherTypeCfg.createMany({
      data: [
        {
          organizationId: testOrgId,
          code: "CC",
          prefix: "C",
          name: "Comprobante de Cierre",
          isAdjustment: false,
        },
        {
          organizationId: testOrgId,
          code: "CA",
          prefix: "A",
          name: "Comprobante de Apertura",
          isAdjustment: false,
        },
      ],
    });

    // Chart of accounts: 3.2.2 + 3.2.1 required by pre-TX gates.
    await prisma.account.create({
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
    await prisma.account.create({
      data: {
        organizationId: testOrgId,
        code: "3.2.1",
        name: "Resultados Acumulados",
        type: "PATRIMONIO",
        nature: "ACREEDORA",
        level: 3,
        isDetail: true,
      },
    });

    // 12 periods — months 1-11 CLOSED, month 12 OPEN (standard path); NO JEs.
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
          closedAt:
            month === 12
              ? null
              : new Date(
                  `${testYear}-${String(month).padStart(2, "0")}-28T12:00:00Z`,
                ),
          closedBy: month === 12 ? null : testUserId,
          createdById: testUserId,
        },
      });
      periodIds.push(period.id);
    }
  });

  afterAll(async () => {
    await prisma.journalLine.deleteMany({
      where: { journalEntry: { organizationId: testOrgId } },
    });
    await prisma.fiscalYear.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.journalEntry.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.accountBalance.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.account.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.voucherTypeCfg.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.fiscalPeriod.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.auditLog.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  it("empty FY → CAN-5.4 cascade: 0 journal entries emitted, FY still CLOSED", async () => {
    const service = makeAnnualCloseService();
    const justification =
      "Cierre de gestión sin movimientos: año contable degenerado para verificar el chain SKIP-on-zero canonical.";

    const result = await service.close(
      testOrgId,
      testYear,
      testUserId,
      justification,
    );

    // CAN-5.4: all 5 entries should be null (no createAndPost emitted).
    expect(result.closingEntries.gastos).toBeNull();
    expect(result.closingEntries.ingresos).toBeNull();
    expect(result.closingEntries.resultado).toBeNull();
    expect(result.closingEntries.balance).toBeNull();
    expect(result.closingEntries.apertura).toBeNull();

    // FY status MUST still be CLOSED (atomicity holds even for empty FY).
    expect(result.status).toBe("CLOSED");

    const fyRow = await prisma.fiscalYear.findUniqueOrThrow({
      where: { id: result.fiscalYearId },
    });
    expect(fyRow.status).toBe("CLOSED");

    // ZERO JournalEntry rows for this FY via sourceId reverse-lookup (CAN-5.6).
    const journalEntriesForFy = await prisma.journalEntry.findMany({
      where: {
        sourceType: "annual-close",
        sourceId: result.fiscalYearId,
      },
    });
    expect(journalEntriesForFy).toHaveLength(0);

    // Year+1 12 periods still created.
    const yearPlusOne = await prisma.fiscalPeriod.findMany({
      where: { organizationId: testOrgId, year: testYear + 1 },
    });
    expect(yearPlusOne).toHaveLength(12);
  });
});
