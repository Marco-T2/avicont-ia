/**
 * FIN-1 RED→GREEN — aggregateByAdjustmentFlag must include LOCKED-period rows
 * (REQ-2.4 — L83). Same fake-db SQL-capture pattern as T-05 sister.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { describe, it, expect, vi } from "vitest";
import { PrismaWorksheetRepo } from "../infrastructure/prisma-worksheet.repo";

function renderSql(strings: ReadonlyArray<string>, values: unknown[]): string {
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

describe("PrismaWorksheetRepo — FIN-1 aggregator includes LOCKED rows", () => {
  it("aggregateByAdjustmentFlag composes SQL with FIN-1 IN-clause (not bare POSTED)", async () => {
    let capturedSql = "";
    const mockDb = {
      $queryRaw: vi.fn(
        async (strings: ReadonlyArray<string>, ...values: unknown[]) => {
          capturedSql = renderSql(strings, values);
          return [];
        },
      ),
    };
    const repo = new PrismaWorksheetRepo(mockDb as unknown as PrismaClient);
    await repo.aggregateByAdjustmentFlag(
      "org-1",
      { dateFrom: new Date("2099-01-01"), dateTo: new Date("2099-12-31") },
      false,
    );

    expect(capturedSql).toContain("IN ('POSTED','LOCKED')");
    expect(capturedSql).not.toMatch(/je\.status\s*=\s*'POSTED'[^\n]*/);
  });
});
