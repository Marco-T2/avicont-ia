/**
 * Phases 8.3 – 8.7 — annual-close error paths + idempotency (E2E).
 *
 * Bundled Postgres-real acceptance tests for the 5 user-facing rejection
 * cases identified in spec REQ-2.1 + REQ-2.5. Each test reuses the shared
 * org/user/accounts/voucher-types fixture (one beforeAll seed → many tests),
 * resetting fiscal_period + journal_entry state in `beforeEach`.
 *
 *   8.3 — missing months → FiscalYearGateNotMetError (HTTP 422 via service
 *         layer; assertion done on the thrown error class + code, since
 *         tests invoke `service.close()` directly, not the HTTP handler).
 *   8.4 — unbalanced year → BalanceNotZeroError with debit/credit/diff.
 *   8.5 — drafts in Dec → DraftEntriesInDecemberError with counts.
 *   8.6 — justification too short → JustificationTooShortError.
 *   8.7 — re-close on CLOSED FY → FiscalYearAlreadyClosedError; idempotent
 *         (no second CC, no second CA, no extra year+1 periods).
 *
 * **Why direct service.close instead of HTTP route**: the HTTP route is
 * covered by `app/api/.../annual-close/__tests__/route.test.ts` (Phase 5.5
 * with mocked service) at the unit level. Re-running it E2E would re-test
 * the Zod parse + handleError dispatch already exercised there. Here we
 * verify the SERVICE throws the correct typed error — the HTTP layer maps
 * 422/409 per spec REQ-2.3, validated at the unit level.
 *
 * For Zod/HTTP 400 on short justification (8.6) the test asserts on the
 * service-level JustificationTooShortError (HTTP 422); the API layer Zod
 * `.min(50)` rejection (HTTP 400) is covered by the route unit test (m, m').
 *
 * Fixture stamp prefix `acerr-` (AnnualCloseErrorPaths).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { prisma } from "@/lib/prisma";
import { lastDayOfUTCMonth } from "@/lib/date-utils";
import { monthNameEs } from "@/modules/fiscal-periods/domain/month-names";
import { makeAnnualCloseService } from "@/modules/annual-close/presentation/server";
import {
  BalanceNotZeroError,
  BALANCE_NOT_ZERO,
  DraftEntriesInDecemberError,
  DRAFT_ENTRIES_IN_DECEMBER,
  FiscalYearAlreadyClosedError,
  FISCAL_YEAR_ALREADY_CLOSED,
  FiscalYearGateNotMetError,
  FISCAL_YEAR_GATE_NOT_MET,
  JustificationTooShortError,
  JUSTIFICATION_TOO_SHORT,
} from "@/modules/annual-close/domain/errors/annual-close-errors";

const STAMP_PREFIX = "acerr";
const VALID_JUSTIFICATION =
  "Cierre acceptance tests E2E — justificación válida para invocar el flujo en estado RED por defecto.";
const TEST_YEAR = 2098;

describe("annual-close error paths + idempotency (E2E) — Postgres integration", () => {
  let testOrgId: string;
  let testUserId: string;
  let cdTypeId: string;
  let testAccountIds: {
    cashActivo: string;
    capitalPatrimonio: string;
    salesIngreso: string;
    expenseGasto: string;
    resultadoGestion: string;
    resultadosAcumulados: string;
  };
  const periodIds: string[] = [];

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `${STAMP_PREFIX}-clerk-user-${stamp}`,
        email: `${STAMP_PREFIX}-${stamp}@test.local`,
        name: "AnnualCloseErrorPaths Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `${STAMP_PREFIX}-clerk-org-${stamp}`,
        name: `AnnualCloseErrorPaths Integration Test Org ${stamp}`,
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
    cdTypeId = cdType.id;

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
    // REQ-A.3 (annual-close-canonical-flow) — 3.2.1 mandatory for asiento #3.
    const resultadosAcumulados = await prisma.account.create({
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
    testAccountIds = {
      cashActivo: cash.id,
      capitalPatrimonio: capital.id,
      salesIngreso: sales.id,
      expenseGasto: expense.id,
      resultadoGestion: resultadoGestion.id,
      resultadosAcumulados: resultadosAcumulados.id,
    };
  });

  beforeEach(async () => {
    // Reset state — wipe everything except the chart of accounts / vouchers /
    // org / user. Each test reseeds its own period + JE shape.
    await prisma.journalLine.deleteMany({
      where: { journalEntry: { organizationId: testOrgId } },
    });
    await prisma.fiscalYear.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.journalEntry.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.accountBalance.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.fiscalPeriod.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.auditLog.deleteMany({ where: { organizationId: testOrgId } });
    periodIds.length = 0;
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

  // ── helpers ─────────────────────────────────────────────────────────────

  async function seedPeriod(
    month: number,
    status: "OPEN" | "CLOSED",
  ): Promise<string> {
    const startDate = new Date(Date.UTC(TEST_YEAR, month - 1, 1));
    const endDate = lastDayOfUTCMonth(startDate);
    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: `${monthNameEs(month)} ${TEST_YEAR}`,
        year: TEST_YEAR,
        month,
        startDate,
        endDate,
        status,
        closedAt: status === "CLOSED" ? new Date(`${TEST_YEAR}-${String(month).padStart(2, "0")}-28T12:00:00Z`) : null,
        closedBy: status === "CLOSED" ? testUserId : null,
        createdById: testUserId,
      },
    });
    return period.id;
  }

  async function seedAllStandardPeriods(): Promise<void> {
    // Months 1-11 CLOSED, month 12 OPEN (standard path layout).
    for (let m = 1; m <= 11; m++) {
      periodIds.push(await seedPeriod(m, "CLOSED"));
    }
    periodIds.push(await seedPeriod(12, "OPEN"));
  }

  async function seedJE(
    periodIdx: number,
    voucherNumber: number,
    date: string,
    lines: Array<{ accountId: string; debit: string; credit: string }>,
    status: "DRAFT" | "POSTED" | "LOCKED" = "LOCKED",
  ): Promise<string> {
    const periodId = periodIds[periodIdx]!;
    const je = await prisma.journalEntry.create({
      data: {
        number: voucherNumber,
        date: new Date(date),
        description: "Seed JE",
        status,
        periodId,
        voucherTypeId: cdTypeId,
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
    return je.id;
  }

  async function seedBalancedYearLedger(): Promise<void> {
    await seedJE(0, 1, `${TEST_YEAR}-01-15T12:00:00Z`, [
      { accountId: testAccountIds.cashActivo, debit: "100000.00", credit: "0.00" },
      { accountId: testAccountIds.capitalPatrimonio, debit: "0.00", credit: "100000.00" },
    ]);
    await seedJE(5, 1, `${TEST_YEAR}-06-15T12:00:00Z`, [
      { accountId: testAccountIds.cashActivo, debit: "60000.00", credit: "0.00" },
      { accountId: testAccountIds.salesIngreso, debit: "0.00", credit: "60000.00" },
    ]);
    await seedJE(10, 1, `${TEST_YEAR}-11-15T12:00:00Z`, [
      { accountId: testAccountIds.expenseGasto, debit: "40000.00", credit: "0.00" },
      { accountId: testAccountIds.cashActivo, debit: "0.00", credit: "40000.00" },
    ]);
  }

  // ────────────────────────────────────────────────────────────────────────
  // 8.3 — missing months
  // ────────────────────────────────────────────────────────────────────────
  it("8.3 missing months → FiscalYearGateNotMetError (HTTP 422)", async () => {
    // Seed only 10 of 12 periods (months 1-10) CLOSED + month 12 OPEN.
    // Total = 11, missing month 11 → gate fails on periods.total !== 12.
    for (let m = 1; m <= 10; m++) {
      periodIds.push(await seedPeriod(m, "CLOSED"));
    }
    periodIds.push(await seedPeriod(12, "OPEN"));

    const service = makeAnnualCloseService();
    await expect(
      service.close(testOrgId, TEST_YEAR, testUserId, VALID_JUSTIFICATION),
    ).rejects.toMatchObject({
      constructor: FiscalYearGateNotMetError,
      code: FISCAL_YEAR_GATE_NOT_MET,
      statusCode: 422,
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 8.4 — unbalanced year
  // ────────────────────────────────────────────────────────────────────────
  it("8.4 unbalanced year → BalanceNotZeroError with debit/credit/diff", async () => {
    await seedAllStandardPeriods();
    // Seed JEs that are NOT balanced (debit-only line — would fail any
    // balanced-entry guard, but we bypass that by inserting raw rows).
    await seedJE(0, 1, `${TEST_YEAR}-01-15T12:00:00Z`, [
      { accountId: testAccountIds.cashActivo, debit: "100000.00", credit: "0.00" },
      { accountId: testAccountIds.capitalPatrimonio, debit: "0.00", credit: "100000.00" },
    ]);
    // Add a second JE that is intentionally unbalanced.
    await seedJE(5, 1, `${TEST_YEAR}-06-15T12:00:00Z`, [
      { accountId: testAccountIds.cashActivo, debit: "50000.00", credit: "0.00" },
      // Missing credit counterpart — year-aggregate DEBE > HABER by 50k.
    ]);

    const service = makeAnnualCloseService();
    let thrown: unknown;
    try {
      await service.close(testOrgId, TEST_YEAR, testUserId, VALID_JUSTIFICATION);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(BalanceNotZeroError);
    const err = thrown as BalanceNotZeroError;
    expect(err.code).toBe(BALANCE_NOT_ZERO);
    expect(err.statusCode).toBe(422);
    expect(err.debit).toBeInstanceOf(Decimal);
    expect(err.credit).toBeInstanceOf(Decimal);
    expect(err.debit.minus(err.credit).abs().equals(new Decimal("50000"))).toBe(true);
  });

  // ────────────────────────────────────────────────────────────────────────
  // 8.5 — drafts in December
  // ────────────────────────────────────────────────────────────────────────
  it("8.5 DRAFT entries in December → DraftEntriesInDecemberError with counts", async () => {
    await seedAllStandardPeriods();
    await seedBalancedYearLedger();
    // Insert a DRAFT JE in Dec (periodIds[11]).
    await seedJE(
      11,
      2,
      `${TEST_YEAR}-12-15T12:00:00Z`,
      [
        { accountId: testAccountIds.cashActivo, debit: "1000.00", credit: "0.00" },
        { accountId: testAccountIds.capitalPatrimonio, debit: "0.00", credit: "1000.00" },
      ],
      "DRAFT",
    );

    const service = makeAnnualCloseService();
    let thrown: unknown;
    try {
      await service.close(testOrgId, TEST_YEAR, testUserId, VALID_JUSTIFICATION);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(DraftEntriesInDecemberError);
    const err = thrown as DraftEntriesInDecemberError;
    expect(err.code).toBe(DRAFT_ENTRIES_IN_DECEMBER);
    expect(err.statusCode).toBe(422);
    expect(err.journalEntries).toBeGreaterThanOrEqual(1);
  });

  // ────────────────────────────────────────────────────────────────────────
  // 8.6 — justification too short (<50)
  // ────────────────────────────────────────────────────────────────────────
  it("8.6 justification < 50 chars → JustificationTooShortError (HTTP 422)", async () => {
    await seedAllStandardPeriods();
    await seedBalancedYearLedger();

    const service = makeAnnualCloseService();
    let thrown: unknown;
    try {
      await service.close(testOrgId, TEST_YEAR, testUserId, "muy corta");
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(JustificationTooShortError);
    const err = thrown as JustificationTooShortError;
    expect(err.code).toBe(JUSTIFICATION_TOO_SHORT);
    expect(err.statusCode).toBe(422);
  });

  // ────────────────────────────────────────────────────────────────────────
  // 8.7 — idempotency: re-close on CLOSED FY
  // ────────────────────────────────────────────────────────────────────────
  it("8.7 re-close on already-CLOSED FY → FiscalYearAlreadyClosedError + no side effects", async () => {
    await seedAllStandardPeriods();
    await seedBalancedYearLedger();

    const service = makeAnnualCloseService();
    // First close — succeeds.
    const first = await service.close(
      testOrgId,
      TEST_YEAR,
      testUserId,
      VALID_JUSTIFICATION,
    );
    expect(first.status).toBe("CLOSED");

    // Snapshot side-effect counts BEFORE second attempt.
    const ccCountBefore = await prisma.journalEntry.count({
      where: { organizationId: testOrgId, voucherType: { code: "CC" } },
    });
    const caCountBefore = await prisma.journalEntry.count({
      where: { organizationId: testOrgId, voucherType: { code: "CA" } },
    });
    const yearPlus1Before = await prisma.fiscalPeriod.count({
      where: { organizationId: testOrgId, year: TEST_YEAR + 1 },
    });

    // Second close — must reject.
    let thrown: unknown;
    try {
      await service.close(testOrgId, TEST_YEAR, testUserId, VALID_JUSTIFICATION);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(FiscalYearAlreadyClosedError);
    const err = thrown as FiscalYearAlreadyClosedError;
    expect(err.code).toBe(FISCAL_YEAR_ALREADY_CLOSED);
    expect(err.statusCode).toBe(409);

    // Idempotency — no extra CC, no extra CA, no extra year+1 periods.
    const ccCountAfter = await prisma.journalEntry.count({
      where: { organizationId: testOrgId, voucherType: { code: "CC" } },
    });
    const caCountAfter = await prisma.journalEntry.count({
      where: { organizationId: testOrgId, voucherType: { code: "CA" } },
    });
    const yearPlus1After = await prisma.fiscalPeriod.count({
      where: { organizationId: testOrgId, year: TEST_YEAR + 1 },
    });
    expect(ccCountAfter).toBe(ccCountBefore);
    expect(caCountAfter).toBe(caCountBefore);
    expect(yearPlus1After).toBe(yearPlus1Before);
  });
});
