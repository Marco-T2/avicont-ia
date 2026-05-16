import { describe, expect, it, vi, beforeEach } from "vitest";
import Decimal from "decimal.js";

/**
 * RED — Phase 4.5 PrismaYearAccountingReaderAdapter (NoTx) unit test.
 *
 * Adapter contract (`YearAccountingReaderPort` — design rev 2 §4 + §5):
 *   - `aggregateYearDebitCreditNoTx(orgId, year)` → {debit, credit} where
 *      both are decimal.js Decimal instances (DEC-1 boundary). Raw SQL
 *      JOIN journal_lines + journal_entries + fiscal_periods filtered to
 *      (orgId, year, POSTED). Returns string from numeric(18,2) cast →
 *      `new Decimal(str)`.
 *
 * C-1 + C-4 invariant — year-aggregate (single query across all 12 months),
 * NOT per-period sums. Unconditional (no Dec-status branching).
 *
 * Mock-del-colaborador — mocked `db.$queryRaw` only.
 */

const mockQueryRaw = vi.fn();
const mockDb = { $queryRaw: mockQueryRaw };

import { PrismaYearAccountingReaderAdapter } from "../../infrastructure/prisma-year-accounting-reader.adapter";

describe("PrismaYearAccountingReaderAdapter (NoTx)", () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
  });

  describe("aggregateYearDebitCreditNoTx", () => {
    it("returns Decimal(debit) + Decimal(credit) for full-year aggregate row", async () => {
      mockQueryRaw.mockResolvedValue([
        { debit_total: "125000.50", credit_total: "125000.50" },
      ]);

      const adapter = new PrismaYearAccountingReaderAdapter(mockDb as never);
      const result = await adapter.aggregateYearDebitCreditNoTx("org-1", 2026);

      expect(result.debit).toBeInstanceOf(Decimal);
      expect(result.credit).toBeInstanceOf(Decimal);
      expect(result.debit.equals(new Decimal("125000.50"))).toBe(true);
      expect(result.credit.equals(new Decimal("125000.50"))).toBe(true);

      // Single $queryRaw call, no per-period decomposition.
      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    });

    it("returns Decimal(0) when no rows (empty year / orgId)", async () => {
      // Postgres COALESCE returns the 0 row even when no matching JEs exist.
      mockQueryRaw.mockResolvedValue([{ debit_total: "0", credit_total: "0" }]);

      const adapter = new PrismaYearAccountingReaderAdapter(mockDb as never);
      const result = await adapter.aggregateYearDebitCreditNoTx("org-empty", 2099);

      expect(result.debit.equals(new Decimal(0))).toBe(true);
      expect(result.credit.equals(new Decimal(0))).toBe(true);
    });

    it("handles unbalanced year (debit !== credit) without throwing — gate runs in service", async () => {
      mockQueryRaw.mockResolvedValue([
        { debit_total: "100.00", credit_total: "99.50" },
      ]);

      const adapter = new PrismaYearAccountingReaderAdapter(mockDb as never);
      const result = await adapter.aggregateYearDebitCreditNoTx("org-unbal", 2026);

      expect(result.debit.equals(new Decimal("100.00"))).toBe(true);
      expect(result.credit.equals(new Decimal("99.50"))).toBe(true);
      // Adapter returns the raw aggregate; BalanceNotZeroError lives in the
      // service (C-1 gate evaluation).
    });

    it("falls back to Decimal(0) if Postgres returns empty array (defensive)", async () => {
      mockQueryRaw.mockResolvedValue([]);

      const adapter = new PrismaYearAccountingReaderAdapter(mockDb as never);
      const result = await adapter.aggregateYearDebitCreditNoTx("org-empty", 2099);

      expect(result.debit.equals(new Decimal(0))).toBe(true);
      expect(result.credit.equals(new Decimal(0))).toBe(true);
    });
  });
});
