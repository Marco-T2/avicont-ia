/**
 * FIN-1 RED→GREEN — TWO idioms migrated (REQ-2.6):
 *
 * 1. L113 sumDebitCreditNoTx — `$queryRaw` → must contain IN ('POSTED','LOCKED').
 * 2. L49,52,55 (countPostedByPeriod) + L66 (getJournalSummaryByVoucherType) —
 *    Prisma `where` shape → must use `{ status: { in: [...FINALIZED_JE_STATUSES] } }`.
 *
 * Per [[mock_hygiene_commit_scope]] the GREEN commit body names BOTH idioms.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { describe, it, expect, vi } from "vitest";
import { PrismaMonthlyCloseSummaryReaderAdapter } from "../prisma-monthly-close-summary-reader.adapter";

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

type Where = { status?: unknown; [k: string]: unknown };
type CountArgs = { where: Where };
type FindManyArgs = { where: Where; select?: unknown };

function makeFakeDb() {
  const calls: {
    dispatchCount: CountArgs[];
    paymentCount: CountArgs[];
    journalEntryCount: CountArgs[];
    journalEntryFindMany: FindManyArgs[];
    queryRaw: string[];
  } = {
    dispatchCount: [],
    paymentCount: [],
    journalEntryCount: [],
    journalEntryFindMany: [],
    queryRaw: [],
  };

  const fake = {
    dispatch: {
      count: vi.fn(async (args: CountArgs) => {
        calls.dispatchCount.push(args);
        return 0;
      }),
    },
    payment: {
      count: vi.fn(async (args: CountArgs) => {
        calls.paymentCount.push(args);
        return 0;
      }),
    },
    journalEntry: {
      count: vi.fn(async (args: CountArgs) => {
        calls.journalEntryCount.push(args);
        return 0;
      }),
      findMany: vi.fn(async (args: FindManyArgs) => {
        calls.journalEntryFindMany.push(args);
        return [];
      }),
    },
    $queryRaw: vi.fn(
      async (strings: ReadonlyArray<string>, ...values: unknown[]) => {
        calls.queryRaw.push(renderSql(strings, values));
        return [];
      },
    ),
  };

  return { fake, calls };
}

function expectFinalizedInClause(where: Where) {
  expect(where.status).toBeDefined();
  // Pre-GREEN this is the literal string "POSTED"; post-GREEN it is
  // `{ in: ["POSTED","LOCKED"] }`. Assert on the post-shape.
  expect(where.status).toEqual({ in: ["POSTED", "LOCKED"] });
}

describe("PrismaMonthlyCloseSummaryReaderAdapter — FIN-1 (2 idioms)", () => {
  it("countPostedByPeriod uses FIN-1 `in` clause on dispatch + payment + journalEntry count", async () => {
    const { fake, calls } = makeFakeDb();
    const adapter = new PrismaMonthlyCloseSummaryReaderAdapter(
      fake as unknown as PrismaClient,
    );
    await adapter.countPostedByPeriod("org-1", "period-1");

    expect(calls.dispatchCount).toHaveLength(1);
    expect(calls.paymentCount).toHaveLength(1);
    expect(calls.journalEntryCount).toHaveLength(1);
    expectFinalizedInClause(calls.dispatchCount[0].where);
    expectFinalizedInClause(calls.paymentCount[0].where);
    expectFinalizedInClause(calls.journalEntryCount[0].where);
  });

  it("getJournalSummaryByVoucherType uses FIN-1 `in` clause on journalEntry.findMany", async () => {
    const { fake, calls } = makeFakeDb();
    const adapter = new PrismaMonthlyCloseSummaryReaderAdapter(
      fake as unknown as PrismaClient,
    );
    await adapter.getJournalSummaryByVoucherType("org-1", "period-1");

    expect(calls.journalEntryFindMany).toHaveLength(1);
    expectFinalizedInClause(calls.journalEntryFindMany[0].where);
  });

  it("sumDebitCreditNoTx composes SQL with FIN-1 IN-clause (not bare POSTED)", async () => {
    const { fake, calls } = makeFakeDb();
    const adapter = new PrismaMonthlyCloseSummaryReaderAdapter(
      fake as unknown as PrismaClient,
    );
    await adapter.sumDebitCreditNoTx("org-1", "period-1");

    expect(calls.queryRaw).toHaveLength(1);
    expect(calls.queryRaw[0]).toContain("IN ('POSTED','LOCKED')");
    expect(calls.queryRaw[0]).not.toMatch(/je\.status\s*=\s*'POSTED'[^\n]*/);
  });
});
