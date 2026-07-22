import type { AuditContext } from "@/modules/shared/domain/ports/unit-of-work";

/**
 * Payment UnitOfWork port — opens the audited tx boundary and runs `fn` with
 * the opaque `tx` token + the pre-generated `correlationId`, returning
 * `{ result, correlationId }`.
 *
 * Minimal PASSTHROUGH shape (§18 design-lock executed): unlike accounting's
 * Scope-based UoW, the payment ports are already `tx: unknown` end-to-end, so
 * the port keeps the opaque token instead of a scope object.
 */
export interface PaymentUnitOfWork {
  run<T>(
    ctx: AuditContext,
    fn: (tx: unknown, correlationId: string) => Promise<T>,
  ): Promise<{ result: T; correlationId: string }>;
}
