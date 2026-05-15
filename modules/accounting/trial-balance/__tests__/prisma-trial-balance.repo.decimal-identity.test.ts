/**
 * Runtime sentinel: DEC-1 identity at the infra→domain boundary (sister of
 * modules/accounting/worksheet/__tests__/prisma-worksheet.repo.decimal-identity.test.ts).
 *
 * Reproduces the latent bug surfaced first in the worksheet module:
 * `aggregateAllVouchers` returns Prisma's inlined `Decimal2` (from
 * `@prisma/client-runtime-utils`) instead of top-level `decimal.js@10.6.0`.
 * Identity mismatch on `instanceof` breaks `serializeStatement` and the
 * trial-balance UI would silently render row Decimals as `{s, e, d}` JSON
 * (then `parseFloat` = NaN → empty cells).
 *
 * Per DEC-1 (canonical rule, oleada-money-decimal-hex-purity archive):
 * the adapter MUST convert Prisma.Decimal → top-level Decimal at the
 * boundary before returning to the domain.
 *
 * Expected failure mode (pre-GREEN): toBeInstanceOf(Decimal) FAILS — repo
 * currently returns `new Prisma.Decimal(...)` whose class identity is
 * Prisma's inlined `Decimal2`, NOT top-level `decimal.js`.
 */
import Decimal from "decimal.js";
import type { PrismaClient } from "@/generated/prisma/client";
import { describe, it, expect, vi } from "vitest";
import { PrismaTrialBalanceRepo } from "../infrastructure/prisma-trial-balance.repo";

describe("PrismaTrialBalanceRepo — DEC-1 identity at infra→domain boundary", () => {
  it("aggregateAllVouchers returns top-level decimal.js Decimal instances (not Prisma.Decimal)", async () => {
    const fakeRows = [
      { account_id: "acc-1", total_debit: "100.50", total_credit: "20.00" },
    ];
    const mockDb = {
      $queryRaw: vi.fn().mockResolvedValue(fakeRows),
    };

    const repo = new PrismaTrialBalanceRepo(mockDb as unknown as PrismaClient);
    const result = await repo.aggregateAllVouchers(
      "org-1",
      new Date("2026-01-01"),
      new Date("2026-12-31"),
    );

    expect(result).toHaveLength(1);
    expect(result[0].totalDebit).toBeInstanceOf(Decimal);
    expect(result[0].totalCredit).toBeInstanceOf(Decimal);
    expect(result[0].totalDebit.toFixed(2)).toBe("100.50");
    expect(result[0].totalCredit.toFixed(2)).toBe("20.00");
  });
});
