/**
 * FIN-1 RED→GREEN — aggregateAllVouchers must include LOCKED-period rows.
 *
 * Sister: prisma-trial-balance.repo.decimal-identity.test.ts (same fake-db
 * pattern: intercept $queryRaw, assert the composed SQL fragment.)
 *
 * The bug: L56 filters `je.status = 'POSTED'` literally, silently dropping
 * every JE locked by monthly-close. The fix: swap to FINALIZED_JE_STATUSES_SQL.
 *
 * RED failure mode (pre-GREEN): the captured Prisma.Sql template contains
 * the literal `'POSTED'` filter and does NOT contain `IN ('POSTED','LOCKED')`.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { describe, it, expect, vi } from "vitest";
import { PrismaTrialBalanceRepo } from "../infrastructure/prisma-trial-balance.repo";

function renderSql(strings: ReadonlyArray<string>, values: unknown[]): string {
  // Reconstruct an inspectable rendered string from Prisma's tagged template
  // call shape — values become `${i}` placeholders. Nested Prisma.Sql values
  // (e.g., FINALIZED_JE_STATUSES_SQL) expose `.sql` we can inline so the
  // assertion sees the full composed SQL.
  return strings
    .map((s, i) => {
      if (i === strings.length - 1) return s;
      const v = values[i];
      const inlined =
        v && typeof v === "object" && "sql" in v
          ? String((v as { sql: string }).sql)
          : `\${param${i}}`;
      return s + inlined;
    })
    .join("");
}

describe("PrismaTrialBalanceRepo — FIN-1 aggregator includes LOCKED rows", () => {
  it("aggregateAllVouchers composes SQL with FIN-1 IN-clause (not bare POSTED)", async () => {
    let capturedSql = "";
    const mockDb = {
      $queryRaw: vi.fn(
        async (strings: ReadonlyArray<string>, ...values: unknown[]) => {
          capturedSql = renderSql(strings, values);
          return [];
        },
      ),
    };

    const repo = new PrismaTrialBalanceRepo(mockDb as unknown as PrismaClient);
    await repo.aggregateAllVouchers(
      "org-1",
      new Date("2099-01-01"),
      new Date("2099-12-31"),
    );

    // FIN-1: SQL must contain IN-clause for POSTED+LOCKED. Pre-GREEN this
    // assertion fails because the rendered SQL contains `= 'POSTED'`.
    expect(capturedSql).toContain("IN ('POSTED','LOCKED')");
    // And must NOT contain the bare POSTED-only equality (line-bound check
    // tolerant of formatting). The fragment swap removes both `=` and `'POSTED'`.
    expect(capturedSql).not.toMatch(/je\.status\s*=\s*'POSTED'[^\n]*/);
  });
});
