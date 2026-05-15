/**
 * Runtime sentinel: DEC-1 identity at the infra→domain boundary.
 *
 * Reproduces the bug where `aggregateByAdjustmentFlag` returns Prisma's
 * inlined `Decimal2` (from `@prisma/client-runtime-utils`) instead of
 * top-level `decimal.js@10.6.0` `Decimal`. Identity mismatch on `instanceof`
 * breaks `serializeStatement` (financial-statements/domain/money.utils.ts:127),
 * which falls through to the generic-object branch and serializes the row
 * Decimals as `{s, e, d}` — the worksheet UI then renders empty cells for
 * every detail row because `parseFloat({...}) === NaN`.
 *
 * Subtotals are NOT affected because `addTotals` starts from `zeroTotals()`
 * (top-level Decimal) and `.plus()` preserves the receiver's constructor —
 * so subtotal Decimals normalize accidentally. Only ROW values carry the
 * Prisma.Decimal identity directly from the repo to the serializer.
 *
 * Per DEC-1 (canonical rule, oleada-money-decimal-hex-purity archive):
 * "domain + application use decimal.js@10.6.0 direct. Prisma.Decimal is
 * forbidden outside infrastructure adapters." The adapter MUST convert
 * Prisma.Decimal → top-level Decimal at the boundary.
 *
 * Expected failure mode (pre-GREEN): toBeInstanceOf(Decimal) FAILS — repo
 * currently returns `new Prisma.Decimal(...)` whose class identity is
 * Prisma's inlined `Decimal2`, NOT top-level `decimal.js`.
 */
import Decimal from "decimal.js";
import type { PrismaClient } from "@/generated/prisma/client";
import { describe, it, expect, vi } from "vitest";
import { PrismaWorksheetRepo } from "../infrastructure/prisma-worksheet.repo";

describe("PrismaWorksheetRepo — DEC-1 identity at infra→domain boundary", () => {
  it("aggregateByAdjustmentFlag returns top-level decimal.js Decimal instances (not Prisma.Decimal)", async () => {
    const fakeRows = [
      {
        account_id: "acc-1",
        total_debit: "100.50",
        total_credit: "20.00",
        nature: "DEUDORA" as const,
      },
    ];
    const mockDb = {
      $queryRaw: vi.fn().mockResolvedValue(fakeRows),
    };

    const repo = new PrismaWorksheetRepo(mockDb as unknown as PrismaClient);
    const result = await repo.aggregateByAdjustmentFlag(
      "org-1",
      { dateFrom: new Date("2026-01-01"), dateTo: new Date("2026-12-31") },
      false,
    );

    expect(result).toHaveLength(1);
    expect(result[0].totalDebit).toBeInstanceOf(Decimal);
    expect(result[0].totalCredit).toBeInstanceOf(Decimal);
    expect(result[0].totalDebit.toFixed(2)).toBe("100.50");
    expect(result[0].totalCredit.toFixed(2)).toBe("20.00");
  });
});
