import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";

import { withAuditTx } from "@/features/shared/audit-tx";
import { PrismaAccountingReaderAdapter } from "@/modules/monthly-close/infrastructure/prisma-accounting-reader.adapter";
import { PrismaPeriodLockingWriterAdapter } from "@/modules/monthly-close/infrastructure/prisma-period-locking-writer.adapter";
import { JournalRepository } from "@/modules/accounting/infrastructure/prisma-journal-entries.repo";
import type { AuditContext } from "@/modules/shared/domain/ports/unit-of-work";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";
import { PrismaFiscalPeriodsTxRepo } from "@/modules/shared/infrastructure/prisma-fiscal-periods-tx.repo";

import type {
  AnnualCloseScope,
  AnnualCloseUnitOfWork,
} from "../application/annual-close-unit-of-work";
import { PrismaAnnualClosingJournalWriterTxAdapter } from "./prisma-annual-closing-journal-writer-tx.adapter";
import { PrismaFiscalYearWriterTxAdapter } from "./prisma-fiscal-year-writer-tx.adapter";
import { PrismaPeriodAutoCreatorTxAdapter } from "./prisma-period-auto-creator-tx.adapter";
import { PrismaYearAccountingReaderTxAdapter } from "./prisma-year-accounting-reader-tx.adapter";

/**
 * Postgres-backed adapter for `AnnualCloseUnitOfWork` (design rev 2 §4 + §5,
 * Phase 4.14 GREEN).
 *
 * Mirror `PrismaMonthlyCloseUnitOfWork` shape EXACT — delegates to the shared
 * `withAuditTx` helper so the 4 invariants (correlationId pre-tx, SET LOCAL
 * audit context inside, fn invocation, return shape) are inherited
 * unchanged. The annual-close adapter adds two divergences:
 *
 * **Timeout 60_000** (design rev 2 §5, S-4). Monthly-close ships 30_000; the
 * annual workload is heavier (5 cross-table aggregates + CC + 5 lock cascades
 * + 12 period creates + CA + FY markClosed). 60s leaves margin under the
 * Postgres default-tx-cap-via-app-layer (no infinite hangs).
 *
 * **SET LOCAL lock_timeout='5s' + statement_timeout='55s'** issued
 * IMMEDIATELY after `setAuditContext` (which `withAuditTx` runs inside the
 * TX). These bound:
 *   - `lock_timeout`: row-lock waits — prevents the annual-close TX from
 *      blocking concurrent monthly closes (e.g. another org's TX) for >5s.
 *   - `statement_timeout='55s'`: 5s under the 60s TX timeout — leaves time
 *      for trigger cleanup before the TX is force-aborted.
 *
 * **§17 carve-out — adapter scope-membership**:
 * The 6 Phase 4 adapters + REUSEd monthly-close adapters are instantiated
 * INSIDE the withAuditTx callback (they require `Prisma.TransactionClient`,
 * which doesn't exist pre-TX). Cross-module concrete imports cited inline.
 *
 * **R3 — consumer-driven cross-module port reuse**:
 *   - `accounting: PrismaAccountingReaderAdapter` (monthly-close) — provides
 *      INSIDE-TX `sumDebitCredit` per-period (annual-close uses it indirectly
 *      via the lock cascade context; the year-aggregate variant lives in
 *      `yearAccountingTx`).
 *   - `locking: PrismaPeriodLockingWriterAdapter` (monthly-close) — STRICT
 *      ORDER 5-method cascade for Dec lock on standard close path.
 *   - `JournalRepository` (accounting hex) — wired via factory into the
 *      annual-closing-journal-writer adapter (W-1 createWithRetryTx reuse).
 */
export class PrismaAnnualCloseUnitOfWork implements AnnualCloseUnitOfWork {
  constructor(private readonly repo: UnitOfWorkRepoLike) {}

  async run<T>(
    ctx: AuditContext,
    fn: (scope: AnnualCloseScope) => Promise<T>,
  ): Promise<{ result: T; correlationId: string }> {
    return withAuditTx(
      this.repo,
      ctx,
      async (tx, correlationId) => {
        // S-4 — SET LOCAL lock_timeout + statement_timeout at TX entry.
        // tx.$executeRawUnsafe used so the literal SQL is observable; the
        // values are constants under our control (no SQL injection risk).
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '55s'");

        const scope: AnnualCloseScope = {
          correlationId,
          fiscalPeriods: new PrismaFiscalPeriodsTxRepo(tx),
          fiscalYears: new PrismaFiscalYearWriterTxAdapter(tx),
          yearAccountingTx: new PrismaYearAccountingReaderTxAdapter(tx),
          closingJournals: new PrismaAnnualClosingJournalWriterTxAdapter(
            tx,
            // JournalRepository extends BaseRepository whose ctor accepts a
            // full PrismaClient. createWithRetryTx only uses the `tx` arg
            // passed at call time (never `this.db`), so the cast is safe
            // at runtime. Surfaced honest per [[shim_retirement_signature_drift]].
            (t) => new JournalRepository(t as unknown as PrismaClient),
          ),
          periodAutoCreator: new PrismaPeriodAutoCreatorTxAdapter(tx),
          accounting: new PrismaAccountingReaderAdapter(tx),
          locking: new PrismaPeriodLockingWriterAdapter(tx),
        };
        return fn(scope);
      },
      { timeout: 60_000 },
    );
  }
}
