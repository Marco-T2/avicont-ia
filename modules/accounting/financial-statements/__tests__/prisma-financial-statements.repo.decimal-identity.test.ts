/**
 * Runtime sentinel: DEC-1 identity at the infra→domain boundary, third
 * sister of the same fix shape applied to worksheet (b711046e) and
 * trial-balance (f0d3a00e).
 *
 * PrismaFinancialStatementsRepo has TWO aggregation paths that both
 * return `new Prisma.Decimal(...)`:
 *  - aggregateJournalLinesUpTo (Balance General — cutoff date)
 *  - aggregateJournalLinesInRange (Estado de Resultados — date range)
 *
 * Each yields Prisma's inlined Decimal2 whose class identity is NOT the
 * top-level decimal.js@10.6.0 Decimal. Per DEC-1, the adapter must
 * normalize at the boundary.
 *
 * Expected failure mode (pre-GREEN): toBeInstanceOf(Decimal) FAILS on
 * both methods.
 */
import Decimal from "decimal.js";
import type { PrismaClient } from "@/generated/prisma/client";
import { describe, it, expect, vi } from "vitest";
import { PrismaFinancialStatementsRepo } from "../infrastructure/prisma-financial-statements.repo";

describe("PrismaFinancialStatementsRepo — DEC-1 identity at infra→domain boundary", () => {
  it("aggregateJournalLinesUpTo returns top-level decimal.js Decimal instances", async () => {
    const fakeRows = [
      {
        account_id: "acc-1",
        total_debit: "100.50",
        total_credit: "20.00",
        nature: "DEUDORA" as const,
        subtype: null,
      },
    ];
    const mockDb = { $queryRaw: vi.fn().mockResolvedValue(fakeRows) };
    const repo = new PrismaFinancialStatementsRepo(mockDb as unknown as PrismaClient);

    const result = await repo.aggregateJournalLinesUpTo("org-1", new Date("2026-12-31"));

    expect(result).toHaveLength(1);
    expect(result[0].totalDebit).toBeInstanceOf(Decimal);
    expect(result[0].totalCredit).toBeInstanceOf(Decimal);
    expect(result[0].totalDebit.toFixed(2)).toBe("100.50");
    expect(result[0].totalCredit.toFixed(2)).toBe("20.00");
  });

  it("aggregateJournalLinesInRange returns top-level decimal.js Decimal instances", async () => {
    const fakeRows = [
      {
        account_id: "acc-1",
        total_debit: "300.00",
        total_credit: "150.00",
        nature: "ACREEDORA" as const,
        subtype: null,
      },
    ];
    const mockDb = { $queryRaw: vi.fn().mockResolvedValue(fakeRows) };
    const repo = new PrismaFinancialStatementsRepo(mockDb as unknown as PrismaClient);

    const result = await repo.aggregateJournalLinesInRange(
      "org-1",
      new Date("2026-01-01"),
      new Date("2026-12-31"),
    );

    expect(result).toHaveLength(1);
    expect(result[0].totalDebit).toBeInstanceOf(Decimal);
    expect(result[0].totalCredit).toBeInstanceOf(Decimal);
    expect(result[0].totalDebit.toFixed(2)).toBe("300.00");
    expect(result[0].totalCredit.toFixed(2)).toBe("150.00");
  });
});
