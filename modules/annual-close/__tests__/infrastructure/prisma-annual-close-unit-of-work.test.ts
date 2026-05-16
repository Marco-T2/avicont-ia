import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * RED — Phase 4.13 PrismaAnnualCloseUnitOfWork unit test.
 *
 * Adapter contract (`AnnualCloseUnitOfWork` — design rev 2 §4 + §5):
 *   - `run(ctx, fn)` → `{result, correlationId}` via withAuditTx.
 *   - **60s timeout** wired explicitly (vs monthly-close 30s); design rev 2 §5
 *      S-4 — heavier annual workload (5 cross-table aggregates + CC + CA + 12
 *      period creates + lock cascade).
 *   - **SET LOCAL lock_timeout='5s' + statement_timeout='55s'** issued at TX
 *      entry (S-4 — bounds row-lock waits + runaway statements).
 *   - Scope wires the 6 Phase 4 adapters + BaseScope.fiscalPeriods +
 *      monthly-close AccountingReader + PeriodLockingWriter (REUSE per R3
 *      consumer-driven).
 *
 * Mock-del-colaborador — withAuditTx is mocked so we can assert:
 *   1. Options { timeout: 60_000 } passed.
 *   2. The fn passed to withAuditTx, when invoked with a fake tx +
 *      correlationId, runs SET LOCAL statements + returns the scope shape.
 */

const mockWithAuditTx = vi.hoisted(() => vi.fn());

vi.mock("@/features/shared/audit-tx", () => ({
  withAuditTx: mockWithAuditTx,
}));

import { PrismaAnnualCloseUnitOfWork } from "../../infrastructure/prisma-annual-close-unit-of-work";

describe("PrismaAnnualCloseUnitOfWork", () => {
  beforeEach(() => {
    mockWithAuditTx.mockReset();
  });

  it("passes options {timeout: 60_000} to withAuditTx (S-4 — annual heavier than monthly 30s)", async () => {
    mockWithAuditTx.mockResolvedValue({
      result: "ok",
      correlationId: "corr-1",
    });

    const repo = { transaction: vi.fn() };
    const uow = new PrismaAnnualCloseUnitOfWork(repo as never);

    await uow.run(
      { userId: "u-1", organizationId: "org-1", justification: "x".repeat(50) },
      async () => "ok",
    );

    const optsArg = mockWithAuditTx.mock.calls[0]?.[3];
    expect(optsArg?.timeout).toBe(60_000);
  });

  it("returns {result, correlationId} from withAuditTx unchanged", async () => {
    mockWithAuditTx.mockResolvedValue({
      result: { foo: 42 },
      correlationId: "corr-abc",
    });

    const repo = { transaction: vi.fn() };
    const uow = new PrismaAnnualCloseUnitOfWork(repo as never);

    const result = await uow.run(
      { userId: "u-1", organizationId: "org-1", justification: "x".repeat(50) },
      async () => ({ foo: 42 }),
    );

    expect(result).toEqual({ result: { foo: 42 }, correlationId: "corr-abc" });
  });

  it("SET LOCAL lock_timeout/statement_timeout issued at TX entry (S-4)", async () => {
    // We capture the inner fn that withAuditTx receives and execute it with
    // a fake tx so we can observe the SET LOCAL calls.
    const fakeTxExecuteRaw = vi.fn().mockResolvedValue(undefined);
    const fakeTx = {
      $executeRawUnsafe: fakeTxExecuteRaw,
    };

    mockWithAuditTx.mockImplementation(
      async (_repo, _ctx, fn, _opts) => {
        const result = await fn(fakeTx, "corr-test");
        return { result, correlationId: "corr-test" };
      },
    );

    const repo = { transaction: vi.fn() };
    const uow = new PrismaAnnualCloseUnitOfWork(repo as never);

    await uow.run(
      { userId: "u-1", organizationId: "org-1", justification: "x".repeat(50) },
      async (scope) => {
        // Service callback observes scope; nothing else needed.
        expect(scope).toBeDefined();
        return "ok";
      },
    );

    // SET LOCAL lock_timeout='5s' + SET LOCAL statement_timeout='55s'
    // (S-4 design rev 2 §5).
    const sqlCalls = fakeTxExecuteRaw.mock.calls.map((c) => c[0] as string);
    expect(sqlCalls.some((s) => /SET\s+LOCAL\s+lock_timeout\s*=\s*'5s'/i.test(s))).toBe(true);
    expect(sqlCalls.some((s) => /SET\s+LOCAL\s+statement_timeout\s*=\s*'55s'/i.test(s))).toBe(true);
  });

  it("scope exposes all 6 Phase 4 adapters + BaseScope.fiscalPeriods + REUSEd accounting/locking ports", async () => {
    const fakeTx = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    };

    let capturedScope: unknown = null;
    mockWithAuditTx.mockImplementation(async (_repo, _ctx, fn) => {
      const r = await fn(fakeTx, "corr-1");
      return { result: r, correlationId: "corr-1" };
    });

    const repo = { transaction: vi.fn() };
    const uow = new PrismaAnnualCloseUnitOfWork(repo as never);

    await uow.run(
      { userId: "u-1", organizationId: "org-1", justification: "x".repeat(50) },
      async (scope) => {
        capturedScope = scope;
        return "ok";
      },
    );

    const s = capturedScope as Record<string, unknown>;
    expect(s).toBeDefined();
    expect(s.correlationId).toBe("corr-1");
    expect(s.fiscalPeriods).toBeDefined();
    expect(s.fiscalYears).toBeDefined();
    expect(s.yearAccountingTx).toBeDefined();
    expect(s.closingJournals).toBeDefined();
    expect(s.periodAutoCreator).toBeDefined();
    expect(s.accounting).toBeDefined();
    expect(s.locking).toBeDefined();
  });
});
