import { describe, expect, it, vi, beforeEach } from "vitest";
import Decimal from "decimal.js";

/**
 * RED — Phase 4.7 PrismaYearAccountingReaderTxAdapter unit test (mocked TX).
 *
 * Adapter contract (`YearAccountingReaderTxPort` — design rev 2 §4 + §5):
 *   - `aggregateYearDebitCredit(orgId, year)` — same shape as NoTx, tx-bound.
 *   - `aggregateResultAccountsByYear(orgId, year)` — CC source per-account
 *      INGRESO/GASTO leaves with nature (C-2 — drives signed-net builder).
 *   - `aggregateBalanceSheetAccountsForCA(orgId, year)` — CA source THREE-STEP
 *      delta-from-most-recent-prior-CA (C-3):
 *        1. find prevCAdate (most-recent CA strictly before year-12-31, or null).
 *        2. aggregate delta (je.date > prevCAdate AND je.date <= year-12-31).
 *        3. if prevCA exists, sum prevCA per-account contribution + merge.
 *      Test discriminantes: (a) inception (no prevCA), (b) one prevCA (delta only),
 *      (c) two prevCAs (most-recent wins).
 *   - `findResultAccount(orgId)` — Tx-bound 3.2.2 lookup.
 *   - `reReadFiscalYearStatusTx(fyId)` — TOCTOU FY status.
 *   - `reReadPeriodStatusTx(periodId)` — TOCTOU Period status.
 *   - `reReadCcExistsForYearTx(orgId, year)` — TOCTOU CC existence.
 *
 * Mock-del-colaborador — mocked tx surface restricted to {$queryRaw,
 * fiscalYear.findUnique, fiscalPeriod.findUnique, journalEntry.findFirst,
 * account.findFirst}.
 */

const mockQueryRaw = vi.fn();
const mockFiscalYearFindUnique = vi.fn();
const mockFiscalPeriodFindUnique = vi.fn();
const mockJournalEntryFindFirst = vi.fn();
const mockAccountFindFirst = vi.fn();

const mockTx = {
  $queryRaw: mockQueryRaw,
  fiscalYear: { findUnique: mockFiscalYearFindUnique },
  fiscalPeriod: { findUnique: mockFiscalPeriodFindUnique },
  journalEntry: { findFirst: mockJournalEntryFindFirst },
  account: { findFirst: mockAccountFindFirst },
};

import { PrismaYearAccountingReaderTxAdapter } from "../../infrastructure/prisma-year-accounting-reader-tx.adapter";

describe("PrismaYearAccountingReaderTxAdapter", () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
    mockFiscalYearFindUnique.mockReset();
    mockFiscalPeriodFindUnique.mockReset();
    mockJournalEntryFindFirst.mockReset();
    mockAccountFindFirst.mockReset();
  });

  describe("aggregateYearDebitCredit (Tx variant)", () => {
    it("returns Decimal pair from full-year aggregate row (single \$queryRaw)", async () => {
      mockQueryRaw.mockResolvedValue([
        { debit_total: "200000.00", credit_total: "200000.00" },
      ]);

      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.aggregateYearDebitCredit("org-1", 2026);

      expect(result.debit.equals(new Decimal("200000.00"))).toBe(true);
      expect(result.credit.equals(new Decimal("200000.00"))).toBe(true);
      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    });

    it("returns Decimal(0) when COALESCE row has zero totals", async () => {
      mockQueryRaw.mockResolvedValue([{ debit_total: "0", credit_total: "0" }]);

      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.aggregateYearDebitCredit("org-empty", 2099);

      expect(result.debit.equals(new Decimal(0))).toBe(true);
      expect(result.credit.equals(new Decimal(0))).toBe(true);
    });
  });

  // aggregateResultAccountsByYear + aggregateBalanceSheetAccountsForCA test
  // suites REMOVED Phase J T-30 — both port methods retired (replaced by
  // gastos/ingresos/balanceSheetAtYearEnd in the canonical 5-asientos flow).

  describe.skip("aggregateBalanceSheetAccountsForCA — REMOVED (Phase J T-30)", () => {
    it.skip("INCEPTION", async () => {});
    it.skip("ONE PRIOR CA", async () => {});
    it.skip("PREV-CA-ONLY", async () => {});
    it.skip("DELTA-ONLY", async () => {});
  });

  describe("findResultAccount (Tx)", () => {
    it("returns {id, code, nature} when 3.2.2 exists", async () => {
      mockAccountFindFirst.mockResolvedValue({
        id: "acc-322",
        code: "3.2.2",
        nature: "ACREEDORA",
      });

      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.findResultAccount("org-1");

      expect(result).toEqual({
        id: "acc-322",
        code: "3.2.2",
        nature: "ACREEDORA",
      });
    });

    it("returns null when 3.2.2 missing", async () => {
      mockAccountFindFirst.mockResolvedValue(null);
      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.findResultAccount("org-1");
      expect(result).toBeNull();
    });
  });

  describe("reReadFiscalYearStatusTx (W-2)", () => {
    it("returns {status} when FY row exists", async () => {
      mockFiscalYearFindUnique.mockResolvedValue({ status: "OPEN" });

      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.reReadFiscalYearStatusTx("fy-1");

      expect(result).toEqual({ status: "OPEN" });
      expect(mockFiscalYearFindUnique).toHaveBeenCalledWith({
        where: { id: "fy-1" },
        select: { status: true },
      });
    });

    it("returns null when FY row vanished (defensive)", async () => {
      mockFiscalYearFindUnique.mockResolvedValue(null);
      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.reReadFiscalYearStatusTx("fy-ghost");
      expect(result).toBeNull();
    });
  });

  describe("reReadPeriodStatusTx (W-2)", () => {
    it("returns {status} when period exists", async () => {
      mockFiscalPeriodFindUnique.mockResolvedValue({ status: "CLOSED" });

      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.reReadPeriodStatusTx("p-dec-2026");

      expect(result).toEqual({ status: "CLOSED" });
      expect(mockFiscalPeriodFindUnique).toHaveBeenCalledWith({
        where: { id: "p-dec-2026" },
        select: { status: true },
      });
    });

    it("returns null when period vanished", async () => {
      mockFiscalPeriodFindUnique.mockResolvedValue(null);
      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.reReadPeriodStatusTx("p-ghost");
      expect(result).toBeNull();
    });
  });

  // reReadCcExistsForYearTx suite REMOVED Phase J T-30 — CAN-5.2 idempotency
  // is exclusively `FiscalYear.status='CLOSED'`. The port method itself was
  // removed from YearAccountingReaderTxPort.

  // ── annual-close-canonical-flow Phase C T-07: aggregateGastosByYear ─────
  describe("aggregateGastosByYear (asiento #1 source — REQ-A.1)", () => {
    it("returns Decimal-typed GASTO leaves with nature for the signed-net builder", async () => {
      mockQueryRaw.mockResolvedValue([
        {
          account_id: "acc-suel",
          code: "5.1.1",
          nature: "DEUDORA",
          type: "GASTO",
          subtype: "SUELDOS",
          debit_total: "80000.00",
          credit_total: "0",
        },
        {
          account_id: "acc-alq",
          code: "5.2.1",
          nature: "DEUDORA",
          type: "GASTO",
          subtype: "ALQUILER",
          debit_total: "12000.00",
          credit_total: "0",
        },
      ]);

      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.aggregateGastosByYear("org-1", 2026);

      expect(result).toHaveLength(2);
      expect(result[0].accountId).toBe("acc-suel");
      expect(result[0].type).toBe("GASTO");
      expect(result[0].debit).toBeInstanceOf(Decimal);
      expect(result[0].debit.equals(new Decimal("80000.00"))).toBe(true);
      expect(result[1].credit.equals(new Decimal(0))).toBe(true);
    });

    it("returns empty array when no GASTO movements", async () => {
      mockQueryRaw.mockResolvedValue([]);
      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.aggregateGastosByYear("org-1", 2099);
      expect(result).toEqual([]);
    });
  });

  // ── annual-close-canonical-flow Phase C T-08: aggregateIngresosByYear ──
  describe("aggregateIngresosByYear (asiento #2 source — REQ-A.2)", () => {
    it("returns Decimal-typed INGRESO leaves with nature", async () => {
      mockQueryRaw.mockResolvedValue([
        {
          account_id: "acc-vta",
          code: "4.1.1",
          nature: "ACREEDORA",
          type: "INGRESO",
          subtype: "VENTAS",
          debit_total: "0",
          credit_total: "100000.00",
        },
      ]);

      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.aggregateIngresosByYear("org-1", 2026);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        accountId: "acc-vta",
        code: "4.1.1",
        nature: "ACREEDORA",
        type: "INGRESO",
        subtype: "VENTAS",
        debit: new Decimal(0),
        credit: new Decimal("100000.00"),
      });
    });

    it("returns empty array when no INGRESO movements", async () => {
      mockQueryRaw.mockResolvedValue([]);
      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.aggregateIngresosByYear("org-1", 2099);
      expect(result).toEqual([]);
    });
  });

  // ── Phase C T-09: aggregateBalanceSheetAtYearEnd + findAccumulatedResultsAccountTx
  describe("aggregateBalanceSheetAtYearEnd (asiento #4 source — REQ-A.4 / REQ-A.11)", () => {
    it("returns ACTIVO/PASIVO/PATRIMONIO leaves with cumulative Decimal sums", async () => {
      mockQueryRaw.mockResolvedValue([
        {
          account_id: "acc-caja",
          code: "1.1.1",
          nature: "DEUDORA",
          type: "ACTIVO",
          subtype: "DISPONIBLE",
          debit_total: "5000.00",
          credit_total: "0",
        },
        {
          account_id: "acc-cxp",
          code: "2.1.1",
          nature: "ACREEDORA",
          type: "PASIVO",
          subtype: "CXP",
          debit_total: "0",
          credit_total: "2000.00",
        },
        {
          account_id: "acc-321",
          code: "3.2.1",
          nature: "ACREEDORA",
          type: "PATRIMONIO",
          subtype: null,
          debit_total: "0",
          credit_total: "3000.00",
        },
      ]);

      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.aggregateBalanceSheetAtYearEnd("org-1", 2026);

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.type).sort()).toEqual([
        "ACTIVO",
        "PASIVO",
        "PATRIMONIO",
      ]);
      expect(result[0].debit).toBeInstanceOf(Decimal);
    });

    it("returns empty when no balance-sheet movements (degenerate FY)", async () => {
      mockQueryRaw.mockResolvedValue([]);
      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.aggregateBalanceSheetAtYearEnd("org-1", 2099);
      expect(result).toEqual([]);
    });
  });

  describe("findAccumulatedResultsAccountTx (asiento #3 TOCTOU — REQ-A.3)", () => {
    it("returns {id, code, nature} when 3.2.1 exists", async () => {
      mockAccountFindFirst.mockResolvedValue({
        id: "acc-321",
        code: "3.2.1",
        nature: "ACREEDORA",
      });

      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.findAccumulatedResultsAccountTx("org-1");

      expect(result).toEqual({
        id: "acc-321",
        code: "3.2.1",
        nature: "ACREEDORA",
      });
      expect(mockAccountFindFirst).toHaveBeenCalledWith({
        where: { organizationId: "org-1", code: "3.2.1" },
        select: { id: true, code: true, nature: true },
      });
    });

    it("returns null when 3.2.1 is missing from chart of accounts", async () => {
      mockAccountFindFirst.mockResolvedValue(null);
      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.findAccumulatedResultsAccountTx("org-empty");
      expect(result).toBeNull();
    });
  });
});
