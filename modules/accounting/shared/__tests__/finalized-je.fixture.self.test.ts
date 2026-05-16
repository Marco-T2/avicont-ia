/**
 * Self-test for the parametric finalized-JE fixture builder (FIN-1 RED suite).
 *
 * Asserts:
 * 1. Builder is callable and returns `{ posted, locked }` shape.
 * 2. Builder constructs the correct Prisma write payload (POSTED in
 *    periodPostedId; LOCKED in periodLockedId; one balanced JournalLine pair
 *    per JE).
 *
 * RED failure mode: `import { ... } from "./_fixtures/finalized-je.fixture"`
 * throws `Cannot find module` (the _fixtures dir / file does not exist yet).
 *
 * Design choice — the production fixture body persists via a Prisma client.
 * We test it WITHOUT a live DB by injecting a thin fake client that records
 * calls. The aim of this self-test is to lock the BUILDER CONTRACT (shape,
 * required ctx fields, balanced lines, correct status routing per period) so
 * downstream adapter integration tests can rely on it.
 */

import { describe, expect, it, vi } from "vitest";

import {
  seedJournalEntriesAcrossStatuses,
  type FinalizedJeFixtureCtx,
} from "./_fixtures/finalized-je.fixture";

type Created = {
  id: string;
  organizationId: string;
  periodId: string;
  voucherTypeId: string;
  status: "POSTED" | "LOCKED";
  date: Date;
  createdById: string;
  description: string;
};

function makeFakePrisma() {
  let seq = 0;
  const createdEntries: Created[] = [];
  const createdLines: Array<{
    journalEntryId: string;
    accountId: string;
    debit: string;
    credit: string;
    order: number;
  }> = [];

  const fake = {
    journalEntry: {
      create: vi.fn(async ({ data }: { data: Omit<Created, "id"> }) => {
        seq += 1;
        const row: Created = { id: `je-${seq}`, ...data };
        createdEntries.push(row);
        return row;
      }),
    },
    journalLine: {
      createMany: vi.fn(async ({ data }: { data: typeof createdLines }) => {
        createdLines.push(...data);
        return { count: data.length };
      }),
    },
  };
  return { fake, createdEntries, createdLines };
}

function baseCtx(): FinalizedJeFixtureCtx {
  return {
    orgId: "org-1",
    accountId: "acct-1",
    voucherTypeId: "vt-1",
    createdById: "user-1",
    periodPostedId: "period-open-1",
    periodLockedId: "period-closed-1",
    date: new Date("2099-06-15T00:00:00Z"),
  };
}

describe("seedJournalEntriesAcrossStatuses — fixture self-test", () => {
  it("seeds POSTED and LOCKED JEs with correct status fields", async () => {
    const { fake, createdEntries } = makeFakePrisma();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await seedJournalEntriesAcrossStatuses(fake as any, baseCtx());

    expect(result.posted.status).toBe("POSTED");
    expect(result.locked.status).toBe("LOCKED");
    expect(result.posted.periodId).toBe("period-open-1");
    expect(result.locked.periodId).toBe("period-closed-1");
    expect(createdEntries).toHaveLength(2);
    expect(createdEntries[0].status).toBe("POSTED");
    expect(createdEntries[1].status).toBe("LOCKED");
  });

  it("each JE has one balanced JournalLine pair", async () => {
    const { fake, createdLines } = makeFakePrisma();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await seedJournalEntriesAcrossStatuses(fake as any, baseCtx());

    // 2 JEs × 2 lines = 4 lines
    expect(createdLines).toHaveLength(4);

    // Group by journalEntryId — each group should have one debit + one credit
    const byJe = new Map<string, typeof createdLines>();
    for (const l of createdLines) {
      const arr = byJe.get(l.journalEntryId) ?? [];
      arr.push(l);
      byJe.set(l.journalEntryId, arr);
    }
    expect(byJe.size).toBe(2);
    for (const lines of byJe.values()) {
      expect(lines).toHaveLength(2);
      const debits = lines.filter((l) => l.debit !== "0").length;
      const credits = lines.filter((l) => l.credit !== "0").length;
      expect(debits).toBe(1);
      expect(credits).toBe(1);
      // Balanced: debit total == credit total
      const sumDebit = lines.reduce((acc, l) => acc + Number(l.debit), 0);
      const sumCredit = lines.reduce((acc, l) => acc + Number(l.credit), 0);
      expect(sumDebit).toBe(sumCredit);
    }
  });
});
