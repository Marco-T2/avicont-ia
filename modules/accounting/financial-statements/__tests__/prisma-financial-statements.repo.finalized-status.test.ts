/**
 * FIN-1 RED→GREEN — aggregateJournalLinesUpTo + InRange must include
 * LOCKED-period rows (REQ-2.2 — L128 + L173).
 *
 * Same fake-db SQL-capture pattern as prisma-trial-balance.repo.finalized-status
 * (sister, T-05). Two methods migrated in this commit.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { describe, it, expect, vi } from "vitest";
import { PrismaFinancialStatementsRepo } from "../infrastructure/prisma-financial-statements.repo";

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

function makeCapturingDb() {
  const captures: string[] = [];
  const mockDb = {
    $queryRaw: vi.fn(
      async (strings: ReadonlyArray<string>, ...values: unknown[]) => {
        captures.push(renderSql(strings, values));
        return [];
      },
    ),
  };
  return { mockDb, captures };
}

describe("PrismaFinancialStatementsRepo — FIN-1 aggregators include LOCKED rows", () => {
  it("aggregateJournalLinesUpTo composes SQL with FIN-1 IN-clause (not bare POSTED)", async () => {
    const { mockDb, captures } = makeCapturingDb();
    const repo = new PrismaFinancialStatementsRepo(
      mockDb as unknown as PrismaClient,
    );
    await repo.aggregateJournalLinesUpTo("org-1", new Date("2099-12-31"));

    expect(captures).toHaveLength(1);
    expect(captures[0]).toContain("IN ('POSTED','LOCKED')");
    expect(captures[0]).not.toMatch(/je\.status\s*=\s*'POSTED'[^\n]*/);
  });

  it("aggregateJournalLinesInRange composes SQL with FIN-1 IN-clause (not bare POSTED)", async () => {
    const { mockDb, captures } = makeCapturingDb();
    const repo = new PrismaFinancialStatementsRepo(
      mockDb as unknown as PrismaClient,
    );
    await repo.aggregateJournalLinesInRange(
      "org-1",
      new Date("2099-01-01"),
      new Date("2099-12-31"),
    );

    expect(captures).toHaveLength(1);
    expect(captures[0]).toContain("IN ('POSTED','LOCKED')");
    expect(captures[0]).not.toMatch(/je\.status\s*=\s*'POSTED'[^\n]*/);
  });
});
