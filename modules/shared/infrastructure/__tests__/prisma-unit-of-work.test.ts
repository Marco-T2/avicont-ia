import { beforeEach, describe, expect, it, vi } from "vitest";

import * as auditTxModule from "@/features/shared/audit-tx";

import {
  PrismaUnitOfWork,
  type UnitOfWorkRepoLike,
} from "../prisma-unit-of-work";
import type { AuditContext } from "../../domain/ports/unit-of-work";
import { describeUnitOfWorkContract } from "../../application/__tests__/unit-of-work.contract";

/**
 * Unit + contract tests for PrismaUnitOfWork.
 *
 * Strategy: spy on `withAuditTx` and provide a fake RepoLike that runs the
 * inner callback synchronously with a stub tx that supports `$executeRawUnsafe`
 * (so `setAuditContext` is a no-op). This lets us observe the delegation
 * shape without standing up a real Postgres tx.
 *
 * Postgres-real behaviour (SET LOCAL semantics, trigger emission, rollback)
 * is exercised separately by the integration test (T4).
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
  justification: "test-justification",
};

describe("PrismaUnitOfWork — delegation to withAuditTx", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fakeTx.$executeRawUnsafe.mockClear();
  });

  it("delegates run() to withAuditTx with the same repo and ctx", async () => {
    const spy = vi.spyOn(auditTxModule, "withAuditTx");
    const repo = makeRepo();
    const uow = new PrismaUnitOfWork(repo);

    await uow.run(auditCtx, async () => "ignored");

    expect(spy).toHaveBeenCalledTimes(1);
    const [passedRepo, passedCtx, passedFn] = spy.mock.calls[0];
    expect(passedRepo).toBe(repo);
    expect(passedCtx).toBe(auditCtx);
    expect(typeof passedFn).toBe("function");
  });

  it("returns the { result, correlationId } shape produced by withAuditTx", async () => {
    const repo = makeRepo();
    const uow = new PrismaUnitOfWork(repo);

    const out = await uow.run(auditCtx, async () => "the-result");

    expect(out.result).toBe("the-result");
    expect(typeof out.correlationId).toBe("string");
    expect(out.correlationId.length).toBeGreaterThan(0);
  });

  it("invokes consumer fn with a scope whose correlationId matches the returned id", async () => {
    const repo = makeRepo();
    const uow = new PrismaUnitOfWork(repo);
    let observed: string | undefined;

    const out = await uow.run(auditCtx, async (scope) => {
      observed = scope.correlationId;
      return null;
    });

    expect(observed).toBe(out.correlationId);
  });

  it("runs setAuditContext via $executeRawUnsafe BEFORE invoking consumer fn", async () => {
    const repo = makeRepo();
    const uow = new PrismaUnitOfWork(repo);

    let executeCallsAtFnEntry = 0;
    await uow.run(auditCtx, async () => {
      executeCallsAtFnEntry = fakeTx.$executeRawUnsafe.mock.calls.length;
      return null;
    });

    expect(executeCallsAtFnEntry).toBeGreaterThan(0);
  });

  it("propagates errors thrown by consumer fn", async () => {
    const repo = makeRepo();
    const uow = new PrismaUnitOfWork(repo);
    const err = new Error("boom");

    await expect(
      uow.run(auditCtx, async () => {
        throw err;
      }),
    ).rejects.toBe(err);
  });
});

describeUnitOfWorkContract(
  "PrismaUnitOfWork (with fake RepoLike)",
  () => new PrismaUnitOfWork(makeRepo()),
);
