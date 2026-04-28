import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";

import { PrismaUnitOfWork } from "../prisma-unit-of-work";
import type { UnitOfWorkRepoLike } from "../prisma-unit-of-work";

/**
 * Postgres-real integration test for PrismaUnitOfWork.
 *
 * Layered ON TOP of the unit + contract suite (which already validate
 * delegation shape with mocks). This test exercises the four invariants
 * that live in Postgres, not in TypeScript:
 *
 *   1. correlationId is generated BEFORE the tx opens (the consumer reads
 *      `scope.correlationId` synchronously and that id matches the row that
 *      the trigger writes — so the id must exist before any DB work).
 *   2. SET LOCAL `app.current_user_id` runs INSIDE the tx — observable
 *      via `audit_logs.changedById`, which the trigger reads from
 *      `current_setting('app.current_user_id')`. If this is correct, the
 *      session var was set within the same tx that performed the mutation.
 *   3. A trivial mutation inside the tx fires the PL/pgSQL trigger and a
 *      row appears in `audit_logs` with the correlationId from `scope`.
 *   4. On rollback (fn throws), the consumer still has the correlationId
 *      that was read pre-throw, but NO audit row persists for that id.
 *
 * Setup uses a fresh User + Organization + FiscalPeriod created in
 * `beforeAll`. The fiscal_periods trigger fires only on UPDATE/DELETE
 * (verified against migrations) so the INSERT in beforeAll does NOT pollute
 * `audit_logs`. Cleanup is strict: filter ONLY by correlationId or by
 * the test's fiscal_period entityId — never by timestamp or wider filters.
 *
 * Database: uses DATABASE_URL (the dev DB). Assumes the dev has it running.
 */

const repo: UnitOfWorkRepoLike = {
  transaction: (fn, options) => prisma.$transaction(fn, options),
};

describe("PrismaUnitOfWork — Postgres integration", () => {
  let testOrgId: string;
  let testUserId: string;
  let testPeriodId: string;
  const capturedCorrelationIds: string[] = [];

  beforeAll(async () => {
    const stamp = Date.now();
    const user = await prisma.user.create({
      data: {
        clerkUserId: `uow-test-clerk-user-${stamp}`,
        email: `uow-test-${stamp}@test.local`,
        name: "UoW Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `uow-test-clerk-org-${stamp}`,
        name: `UoW Integration Test Org ${stamp}`,
        slug: `uow-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "uow-integration-period",
        year: 2099,
        month: 1,
        startDate: new Date("2099-01-01T00:00:00Z"),
        endDate: new Date("2099-01-31T23:59:59Z"),
        createdById: testUserId,
      },
    });
    testPeriodId = period.id;
  });

  afterEach(async () => {
    if (capturedCorrelationIds.length === 0) return;
    const ids = [...capturedCorrelationIds];
    capturedCorrelationIds.length = 0;
    await prisma.auditLog.deleteMany({
      where: { correlationId: { in: ids } },
    });
  });

  afterAll(async () => {
    await prisma.fiscalPeriod.delete({ where: { id: testPeriodId } });
    await prisma.auditLog.deleteMany({
      where: { entityType: "fiscal_periods", entityId: testPeriodId },
    });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  async function ensurePeriodOpen(): Promise<void> {
    await prisma.fiscalPeriod.update({
      where: { id: testPeriodId },
      data: { status: "OPEN", closedAt: null, closedBy: null },
    });
  }

  it("commit: scope.fiscalPeriods.markClosed → audit row with correlationId pre-tx + changedById from SET LOCAL", async () => {
    await ensurePeriodOpen();
    const uow = new PrismaUnitOfWork(repo);
    let scopeIdInsideFn: string | undefined;

    const { result, correlationId } = await uow.run(
      { userId: testUserId, organizationId: testOrgId },
      async (scope) => {
        scopeIdInsideFn = scope.correlationId;
        return scope.fiscalPeriods.markClosed(
          testOrgId,
          testPeriodId,
          testUserId,
        );
      },
    );
    capturedCorrelationIds.push(correlationId);

    expect(scopeIdInsideFn).toBe(correlationId);
    expect(result.closedBy).toBe(testUserId);
    expect(result.closedAt).toBeInstanceOf(Date);

    const periodAfter = await prisma.fiscalPeriod.findUniqueOrThrow({
      where: { id: testPeriodId },
    });
    expect(periodAfter.status).toBe("CLOSED");
    expect(periodAfter.closedBy).toBe(testUserId);

    const auditRows = await prisma.auditLog.findMany({
      where: {
        correlationId,
        entityType: "fiscal_periods",
        entityId: testPeriodId,
      },
    });
    expect(auditRows.length).toBe(1);
    expect(auditRows[0].correlationId).toBe(correlationId);
    expect(auditRows[0].changedById).toBe(testUserId);
    expect(auditRows[0].action).toBe("STATUS_CHANGE");
  });

  it("rollback: fn throws after markClosed → no audit row persists and period stays OPEN", async () => {
    await ensurePeriodOpen();
    const uow = new PrismaUnitOfWork(repo);
    let scopeIdBeforeThrow: string | undefined;
    const boom = new Error("rollback-me");

    await expect(
      uow.run(
        { userId: testUserId, organizationId: testOrgId },
        async (scope) => {
          scopeIdBeforeThrow = scope.correlationId;
          await scope.fiscalPeriods.markClosed(
            testOrgId,
            testPeriodId,
            testUserId,
          );
          throw boom;
        },
      ),
    ).rejects.toBe(boom);

    expect(scopeIdBeforeThrow).toBeDefined();
    capturedCorrelationIds.push(scopeIdBeforeThrow!);

    const auditRows = await prisma.auditLog.findMany({
      where: { correlationId: scopeIdBeforeThrow! },
    });
    expect(auditRows.length).toBe(0);

    const periodAfter = await prisma.fiscalPeriod.findUniqueOrThrow({
      where: { id: testPeriodId },
    });
    expect(periodAfter.status).toBe("OPEN");
    expect(periodAfter.closedAt).toBeNull();
    expect(periodAfter.closedBy).toBeNull();
  });
});
