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

  describe("aggregateResultAccountsByYear (CC source — C-2)", () => {
    it("maps raw rows to YearAggregatedLine[] with Decimal debit/credit + nature", async () => {
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
        {
          account_id: "acc-suel",
          code: "5.1.1",
          nature: "DEUDORA",
          type: "GASTO",
          subtype: "SUELDOS",
          debit_total: "80000.00",
          credit_total: "0",
        },
      ]);

      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.aggregateResultAccountsByYear("org-1", 2026);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        accountId: "acc-vta",
        code: "4.1.1",
        nature: "ACREEDORA",
        type: "INGRESO",
        subtype: "VENTAS",
        debit: new Decimal("0"),
        credit: new Decimal("100000.00"),
      });
      expect(result[0].debit).toBeInstanceOf(Decimal);
      expect(result[1].credit.equals(new Decimal(0))).toBe(true);
      expect(result[1].debit.equals(new Decimal("80000.00"))).toBe(true);
    });

    it("returns empty array when no INGRESO/GASTO movements", async () => {
      mockQueryRaw.mockResolvedValue([]);

      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.aggregateResultAccountsByYear("org-1", 2099);

      expect(result).toEqual([]);
    });
  });

  describe("aggregateBalanceSheetAccountsForCA (CA source — C-3 delta-from-prior-CA)", () => {
    it("INCEPTION (no prevCA): aggregates from start of time → year-12-31 (single delta query)", async () => {
      // Step 1: prevCAdate query returns no row.
      mockQueryRaw.mockResolvedValueOnce([]);
      // Step 2: delta aggregation (inception fallback).
      mockQueryRaw.mockResolvedValueOnce([
        {
          account_id: "acc-caja",
          code: "1.1.1",
          nature: "DEUDORA",
          type: "ACTIVO",
          subtype: "DISPONIBLE",
          debit_total: "50000.00",
          credit_total: "10000.00",
        },
        {
          account_id: "acc-cap",
          code: "3.1.1",
          nature: "ACREEDORA",
          type: "PATRIMONIO",
          subtype: "CAPITAL",
          debit_total: "0",
          credit_total: "40000.00",
        },
      ]);

      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.aggregateBalanceSheetAccountsForCA("org-1", 2026);

      // Only 2 queries — step 1 (prevCAdate) + step 2 (delta). NO step 3 because
      // no prevCA found.
      expect(mockQueryRaw).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        accountId: "acc-caja",
        code: "1.1.1",
        nature: "DEUDORA",
        type: "ACTIVO",
        subtype: "DISPONIBLE",
        debit: new Decimal("50000.00"),
        credit: new Decimal("10000.00"),
      });
      expect(result[1].type).toBe("PATRIMONIO");
      expect(result[1].credit.equals(new Decimal("40000.00"))).toBe(true);
    });

    it("ONE PRIOR CA: aggregates delta (date > prevCAdate AND <= year-12-31) + merges prevCA contribution per account", async () => {
      const prevCADate = new Date("2025-01-01T12:00:00Z");
      // Step 1: prevCAdate row.
      mockQueryRaw.mockResolvedValueOnce([{ prev_ca_date: prevCADate }]);
      // Step 2: delta per-account.
      mockQueryRaw.mockResolvedValueOnce([
        {
          account_id: "acc-caja",
          code: "1.1.1",
          nature: "DEUDORA",
          type: "ACTIVO",
          subtype: null,
          debit_total: "20000.00",
          credit_total: "5000.00",
        },
      ]);
      // Step 3: prevCA per-account contribution.
      mockQueryRaw.mockResolvedValueOnce([
        {
          account_id: "acc-caja",
          code: "1.1.1",
          nature: "DEUDORA",
          type: "ACTIVO",
          subtype: null,
          prev_debit_total: "30000.00",
          prev_credit_total: "10000.00",
        },
      ]);

      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.aggregateBalanceSheetAccountsForCA("org-1", 2026);

      // 3 queries: prevCA discover + delta + prevCA contribution.
      expect(mockQueryRaw).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(1);
      // Merged: delta (20000 D, 5000 H) + prevCA (30000 D, 10000 H) = (50000 D, 15000 H).
      expect(result[0].accountId).toBe("acc-caja");
      expect(result[0].debit.equals(new Decimal("50000.00"))).toBe(true);
      expect(result[0].credit.equals(new Decimal("15000.00"))).toBe(true);
    });

    it("PREV-CA-ONLY ACCOUNT (no delta movement): prevCA contribution surfaces", async () => {
      // Account had movement in prevCA but no movement in delta window.
      mockQueryRaw.mockResolvedValueOnce([
        { prev_ca_date: new Date("2025-01-01T12:00:00Z") },
      ]);
      // Step 2: delta empty.
      mockQueryRaw.mockResolvedValueOnce([]);
      // Step 3: prevCA still has the account.
      mockQueryRaw.mockResolvedValueOnce([
        {
          account_id: "acc-banco",
          code: "1.1.2",
          nature: "DEUDORA",
          type: "ACTIVO",
          subtype: null,
          prev_debit_total: "100000.00",
          prev_credit_total: "0",
        },
      ]);

      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.aggregateBalanceSheetAccountsForCA("org-1", 2026);

      expect(result).toHaveLength(1);
      expect(result[0].accountId).toBe("acc-banco");
      expect(result[0].debit.equals(new Decimal("100000.00"))).toBe(true);
      expect(result[0].credit.equals(new Decimal(0))).toBe(true);
    });

    it("DELTA-ONLY ACCOUNT (new account this year): delta row surfaces unchanged", async () => {
      mockQueryRaw.mockResolvedValueOnce([
        { prev_ca_date: new Date("2025-01-01T12:00:00Z") },
      ]);
      // Delta has a new account "acc-prov" (introduced this year).
      mockQueryRaw.mockResolvedValueOnce([
        {
          account_id: "acc-prov",
          code: "2.1.5",
          nature: "ACREEDORA",
          type: "PASIVO",
          subtype: null,
          debit_total: "0",
          credit_total: "8000.00",
        },
      ]);
      // PrevCA has NO entry for acc-prov.
      mockQueryRaw.mockResolvedValueOnce([]);

      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.aggregateBalanceSheetAccountsForCA("org-1", 2026);

      expect(result).toHaveLength(1);
      expect(result[0].accountId).toBe("acc-prov");
      expect(result[0].type).toBe("PASIVO");
      expect(result[0].credit.equals(new Decimal("8000.00"))).toBe(true);
    });
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

  describe("reReadCcExistsForYearTx (W-2)", () => {
    it("returns true when CC posted in year", async () => {
      mockJournalEntryFindFirst.mockResolvedValue({ id: "je-cc-1" });

      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.reReadCcExistsForYearTx("org-1", 2026);

      expect(result).toBe(true);
    });

    it("returns false when no CC", async () => {
      mockJournalEntryFindFirst.mockResolvedValue(null);
      const adapter = new PrismaYearAccountingReaderTxAdapter(mockTx as never);
      const result = await adapter.reReadCcExistsForYearTx("org-1", 2026);
      expect(result).toBe(false);
    });
  });

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
});
