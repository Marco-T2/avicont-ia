import type { AuditContext } from "@/modules/shared/domain/ports/unit-of-work";
import type { PaymentUnitOfWork } from "../../../domain/ports/payment-unit-of-work";
import type { InMemoryPaymentRepository } from "./in-memory-payment.repository";

/**
 * In-memory PaymentUnitOfWork — runs `fn` through the fake repo's
 * `transaction()` (txToken) after emitting the same SET LOCAL audit SQL that
 * `setAuditContext` emits, so the audit suite's `executeRawCalls` /
 * correlationId assertions observe identical behavior to the real adapter.
 *
 * The SQL is REPLICATED (not imported) on purpose: this file lives under
 * `application/**` where the R2 eslint glob applies — importing
 * `shared/infrastructure/audit-context` here would add a new R2 violation.
 *
 * Test-fixture knob: `runCalls` records every `ctx` passed to `run()`.
 */
export class FakePaymentUnitOfWork implements PaymentUnitOfWork {
  readonly runCalls: AuditContext[] = [];

  constructor(private readonly repo: InMemoryPaymentRepository) {}

  async run<T>(
    ctx: AuditContext,
    fn: (tx: unknown, correlationId: string) => Promise<T>,
  ): Promise<{ result: T; correlationId: string }> {
    this.runCalls.push(ctx);
    const correlationId = crypto.randomUUID();
    const result = await this.repo.transaction(async (tx) => {
      const raw = tx as {
        $executeRawUnsafe: (...args: unknown[]) => Promise<number>;
      };
      // Mirror of setAuditContext (shared/infrastructure/audit-context.ts).
      await raw.$executeRawUnsafe(
        `SET LOCAL app.current_user_id = '${ctx.userId.replace(/'/g, "''")}'`,
      );
      await raw.$executeRawUnsafe(
        `SET LOCAL app.current_organization_id = '${ctx.organizationId.replace(/'/g, "''")}'`,
      );
      if (ctx.justification) {
        await raw.$executeRawUnsafe(
          `SET LOCAL app.audit_justification = '${ctx.justification.replace(/'/g, "''")}'`,
        );
      }
      await raw.$executeRawUnsafe(
        `SET LOCAL app.correlation_id = '${correlationId.replace(/'/g, "''")}'`,
      );
      return fn(tx, correlationId);
    });
    return { result, correlationId };
  }
}
