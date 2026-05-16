/**
 * FIN-1 RED→GREEN — libro mayor (general ledger) aggregator + slice
 * builders must include LOCKED-period rows (REQ-2.7 — L617 aggregateByAccount,
 * L780 buildLedgerLineWhere, L809 buildLedgerLinePriorWhere).
 *
 * Three Prisma-shape `where` clauses captured via a fake db that records each
 * call. Pre-GREEN each `where.journalEntry.status` is the literal `"POSTED"`.
 * Post-GREEN each is `{ in: ["POSTED","LOCKED"] }`.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { describe, it, expect, vi } from "vitest";
import { JournalRepository } from "../prisma-journal-entries.repo";

type Where = {
  journalEntry?: { status?: unknown; [k: string]: unknown };
  [k: string]: unknown;
};

function makeFakeDb() {
  const calls: {
    aggregate: Array<{ where: Where }>;
    findMany: Array<{ where: Where }>;
    count: Array<{ where: Where }>;
  } = {
    aggregate: [],
    findMany: [],
    count: [],
  };

  const fake = {
    journalLine: {
      aggregate: vi.fn(async (args: { where: Where }) => {
        calls.aggregate.push(args);
        return { _sum: { debit: null, credit: null } };
      }),
      findMany: vi.fn(async (args: { where: Where }) => {
        calls.findMany.push(args);
        return [];
      }),
      count: vi.fn(async (args: { where: Where }) => {
        calls.count.push(args);
        return 0;
      }),
    },
  };
  return { fake, calls };
}

function expectFinalizedInClause(where: Where) {
  expect(where.journalEntry).toBeDefined();
  expect(where.journalEntry!.status).toEqual({ in: ["POSTED", "LOCKED"] });
}

describe("JournalRepository (libro mayor) — FIN-1 includes LOCKED rows", () => {
  it("aggregateByAccount uses FIN-1 `in` clause on journalEntry.status (L617)", async () => {
    const { fake, calls } = makeFakeDb();
    const repo = new JournalRepository(fake as unknown as PrismaClient);
    await repo.aggregateByAccount("org-1", "acct-1", "period-1");

    expect(calls.aggregate).toHaveLength(1);
    expectFinalizedInClause(calls.aggregate[0].where);
  });

  it("findLinesByAccountPaginated page+count where uses FIN-1 (L780 buildLedgerLineWhere)", async () => {
    const { fake, calls } = makeFakeDb();
    const repo = new JournalRepository(fake as unknown as PrismaClient);
    await repo.findLinesByAccountPaginated("org-1", "acct-1");

    // findMany: page slice (1) + prior-rows slice (1, when skip>0; here page=1 so 1 call)
    // count: 1 call
    expect(calls.findMany.length).toBeGreaterThanOrEqual(1);
    expect(calls.count).toHaveLength(1);
    expectFinalizedInClause(calls.findMany[0].where);
    expectFinalizedInClause(calls.count[0].where);
  });

  it("findLinesByAccountPaginated historical aggregate uses FIN-1 (L809 buildLedgerLinePriorWhere)", async () => {
    const { fake, calls } = makeFakeDb();
    const repo = new JournalRepository(fake as unknown as PrismaClient);
    // Pass a dateFrom so the historical aggregate fires (REQ-2.7 third site).
    await repo.findLinesByAccountPaginated("org-1", "acct-1", {
      dateRange: { dateFrom: new Date("2099-06-15") },
    });

    expect(calls.aggregate).toHaveLength(1);
    expectFinalizedInClause(calls.aggregate[0].where);
  });
});
