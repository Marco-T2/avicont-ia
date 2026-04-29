import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaAccountingUnitOfWork } from "../prisma-accounting-unit-of-work";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";
import type { AuditContext } from "@/modules/shared/domain/ports/unit-of-work";
import { describeUnitOfWorkContract } from "@/modules/shared/application/__tests__/unit-of-work.contract";

/**
 * Unit + contract tests for PrismaAccountingUnitOfWork (POC #10 C3-D Ciclo 1).
 *
 * Mirror of `prisma-unit-of-work.test.ts` (shared) — fakeTx + makeRepo pattern
 * delegates to `withAuditTx` so the 4 invariants (correlationId pre-tx, SET
 * LOCAL inside, fn invocation, return shape) are inherited unchanged.
 *
 * Postgres-real behaviour exercised by the integration test for shared
 * `PrismaUnitOfWork`; this adapter is structurally identical, only the scope
 * shape changes.
 */

const fakeTx = {
  $executeRawUnsafe: vi.fn(async () => 0 as unknown as number),
};

function makeRepo(): UnitOfWorkRepoLike {
  return {
    transaction: vi.fn(async (fn) => fn(fakeTx as never)),
  };
}

const auditCtx: AuditContext = {
  userId: "user-1",
  organizationId: "org-1",
};

describe("PrismaAccountingUnitOfWork — accounting-specific scope", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fakeTx.$executeRawUnsafe.mockClear();
  });

  it("exposes tx-bound journalEntries and accountBalances on scope", async () => {
    const repo = makeRepo();
    const uow = new PrismaAccountingUnitOfWork(repo);
    let observedJournalEntries: unknown;
    let observedAccountBalances: unknown;

    await uow.run(auditCtx, async (scope) => {
      observedJournalEntries = scope.journalEntries;
      observedAccountBalances = scope.accountBalances;
      return null;
    });

    expect(
      typeof (observedJournalEntries as { create: unknown }).create,
    ).toBe("function");
    expect(
      typeof (observedAccountBalances as { applyPost: unknown }).applyPost,
    ).toBe("function");
  });
});

describeUnitOfWorkContract(
  "PrismaAccountingUnitOfWork (with fake RepoLike)",
  () => new PrismaAccountingUnitOfWork(makeRepo()),
);
