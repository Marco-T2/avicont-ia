import type {
  AuditContext,
  UnitOfWork,
  UnitOfWorkScope,
} from "../../../domain/ports/unit-of-work";
import type { FiscalPeriodsTxRepo } from "../../../domain/ports/fiscal-periods-tx.repo";

/**
 * In-memory fake for `FiscalPeriodsTxRepo`. Records every call so tests can
 * assert against `closeCalls` directly.
 */
export class FakeFiscalPeriodsTxRepo implements FiscalPeriodsTxRepo {
  closeCalls: Array<{
    organizationId: string;
    periodId: string;
    userId: string;
  }> = [];

  async markClosed(
    organizationId: string,
    periodId: string,
    userId: string,
  ): Promise<{ closedAt: Date; closedBy: string }> {
    this.closeCalls.push({ organizationId, periodId, userId });
    return { closedAt: new Date(), closedBy: userId };
  }
}

/**
 * In-memory UnitOfWork used by application-layer tests.
 *
 * Behaviour:
 *   - Generates `correlationId` BEFORE invoking fn — mirrors PrismaUnitOfWork.
 *   - Does NOT simulate a real DB transaction; fn just runs and the result
 *     is returned alongside the id.
 *   - Does NOT call `setAuditContext` — no Postgres SET LOCAL semantics here.
 *
 * NOTE: this does NOT replace the integration test against Postgres. The
 * SET LOCAL + PL/pgSQL trigger semantics are not simulated and MUST be
 * exercised by `prisma-unit-of-work.integration.test.ts` instead.
 *
 * Test-fixture knobs:
 *   - lastCtx: last AuditContext passed to run.
 *   - lastCorrelationId: correlationId of the most recent run.
 *   - runCount: number of times run was invoked.
 */
export class InMemoryUnitOfWork implements UnitOfWork {
  lastCtx: AuditContext | null = null;
  lastCorrelationId: string | null = null;
  runCount = 0;
  fiscalPeriodsRepo = new FakeFiscalPeriodsTxRepo();

  async run<T>(
    ctx: AuditContext,
    fn: (scope: UnitOfWorkScope) => Promise<T>,
  ): Promise<{ result: T; correlationId: string }> {
    this.runCount++;
    this.lastCtx = ctx;
    const correlationId = crypto.randomUUID();
    this.lastCorrelationId = correlationId;
    const scope: UnitOfWorkScope = {
      correlationId,
      fiscalPeriods: this.fiscalPeriodsRepo,
    };
    const result = await fn(scope);
    return { result, correlationId };
  }
}
