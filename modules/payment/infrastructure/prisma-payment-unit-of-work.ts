import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { withAuditTx } from "@/modules/shared/infrastructure/audit-tx";
import { setAuditContext } from "@/modules/shared/infrastructure/audit-context";
import type { AuditContext } from "@/modules/shared/domain/ports/unit-of-work";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";

import type { PaymentUnitOfWork } from "../domain/ports/payment-unit-of-work";

/**
 * Postgres-backed adapter for the payment UnitOfWork port. Delegates to
 * `withAuditTx` so the 4 invariants (correlationId pre-tx, SET LOCAL inside,
 * fn invoke, return shape) are inherited unchanged. Minimal PASSTHROUGH: the
 * payment ports are `tx: unknown` end-to-end, so `fn` receives the opaque
 * `Prisma.TransactionClient` token directly — no scope object is built
 * (contrast `PrismaAccountingUnitOfWork`).
 */
export class PrismaPaymentUnitOfWork implements PaymentUnitOfWork {
  constructor(private readonly repo: UnitOfWorkRepoLike) {}

  async run<T>(
    ctx: AuditContext,
    fn: (tx: unknown, correlationId: string) => Promise<T>,
  ): Promise<{ result: T; correlationId: string }> {
    return withAuditTx(this.repo, ctx, (tx, correlationId) =>
      fn(tx, correlationId),
    );
  }
}

/**
 * Tx-bound variant for `makePaymentsServiceForTx(tx)` — runs `fn` against the
 * PROVIDED outer transaction instead of opening a new one, still installing
 * the audit session vars (setAuditContext) with a fresh correlationId so the
 * PL/pgSQL audit triggers fire. NOTE: SET LOCAL scopes to the OUTER tx, so
 * this overwrites any audit context the outer caller installed for the
 * remainder of that tx.
 */
export class BoundPaymentUnitOfWork implements PaymentUnitOfWork {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async run<T>(
    ctx: AuditContext,
    fn: (tx: unknown, correlationId: string) => Promise<T>,
  ): Promise<{ result: T; correlationId: string }> {
    const correlationId = crypto.randomUUID();
    await setAuditContext(
      this.tx,
      ctx.userId,
      ctx.organizationId,
      ctx.justification,
      correlationId,
    );
    const result = await fn(this.tx, correlationId);
    return { result, correlationId };
  }
}
