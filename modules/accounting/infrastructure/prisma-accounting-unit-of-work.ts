import "server-only";

import { withAuditTx } from "@/features/shared/audit-tx";
import { PrismaFiscalPeriodsTxRepo } from "@/modules/shared/infrastructure/prisma-fiscal-periods-tx.repo";
import type { AuditContext } from "@/modules/shared/domain/ports/unit-of-work";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";

import type {
  AccountingScope,
  AccountingUnitOfWork,
} from "../domain/ports/unit-of-work";
import { PrismaAccountBalancesRepo } from "./prisma-account-balances.repo";
import { PrismaJournalEntriesRepository } from "./prisma-journal-entries.repo";

/**
 * Postgres-backed adapter for the accounting UnitOfWork port. Mirrors
 * `PrismaUnitOfWork` (shared) — delegates to `withAuditTx` so the 4 invariants
 * (correlationId pre-tx, SET LOCAL inside, fn invoke, return shape) are
 * inherited unchanged. Only the scope shape differs: AccountingScope adds
 * tx-bound `journalEntries` + `accountBalances` alongside `fiscalPeriods`.
 */
export class PrismaAccountingUnitOfWork implements AccountingUnitOfWork {
  constructor(private readonly repo: UnitOfWorkRepoLike) {}

  async run<T>(
    ctx: AuditContext,
    fn: (scope: AccountingScope) => Promise<T>,
  ): Promise<{ result: T; correlationId: string }> {
    return withAuditTx(this.repo, ctx, async (tx, correlationId) => {
      const scope: AccountingScope = {
        correlationId,
        fiscalPeriods: new PrismaFiscalPeriodsTxRepo(tx),
        journalEntries: new PrismaJournalEntriesRepository(tx),
        accountBalances: new PrismaAccountBalancesRepo(tx),
      };
      return fn(scope);
    });
  }
}
