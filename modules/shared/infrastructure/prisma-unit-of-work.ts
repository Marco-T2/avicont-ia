import type { Prisma } from "@/generated/prisma/client";

import { withAuditTx } from "@/features/shared/audit-tx";

import type {
  AuditContext,
  UnitOfWork,
  UnitOfWorkScope,
} from "../domain/ports/unit-of-work";
import { PrismaFiscalPeriodsTxRepo } from "./prisma-fiscal-periods-tx.repo";

/**
 * Repository-like dependency required by PrismaUnitOfWork. Any object that
 * exposes a Prisma `transaction(fn, opts?)` matches — typically the prisma
 * client itself or a thin wrapper over it.
 */
export interface UnitOfWorkRepoLike {
  transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { timeout?: number; maxWait?: number },
  ): Promise<T>;
}

/**
 * Postgres-backed adapter for the UnitOfWork port.
 *
 * Delegates fully to the legacy `withAuditTx` helper so the four invariants
 * — correlationId pre-tx, SET LOCAL inside tx, fn invocation, return shape
 * — are inherited unchanged. The adapter never re-implements that ordering.
 *
 * The Prisma `tx` token is intentionally hidden: the consumer only sees
 * `UnitOfWorkScope` (correlationId + future cross-feature repos).
 */
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly repo: UnitOfWorkRepoLike) {}

  async run<T>(
    ctx: AuditContext,
    fn: (scope: UnitOfWorkScope) => Promise<T>,
  ): Promise<{ result: T; correlationId: string }> {
    return withAuditTx(this.repo, ctx, async (tx, correlationId) => {
      const scope: UnitOfWorkScope = {
        correlationId,
        fiscalPeriods: new PrismaFiscalPeriodsTxRepo(tx),
      };
      return fn(scope);
    });
  }
}
