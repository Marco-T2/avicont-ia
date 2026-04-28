import type { FiscalPeriodsTxRepo } from "./fiscal-periods-tx.repo";

/**
 * UnitOfWork port — encapsulates the transactional + audit-context boundary
 * so the domain never sees `Prisma.TransactionClient` (architecture.md §4.3).
 *
 * The adapter is responsible for:
 *   1. Generating `correlationId` BEFORE opening the tx (preserved on rollback).
 *   2. Opening the tx and calling `setAuditContext` INSIDE it (Postgres SET LOCAL).
 *   3. Invoking `fn(scope)` with `scope.correlationId` populated.
 *   4. Returning `{ result, correlationId }` regardless of whether the consumer
 *      used the id or not — callers that expose it spread it into their result.
 *
 * Audit rows are written automatically by PL/pgSQL triggers on mutating tables
 * once `setAuditContext` is set. There is no `recordAudit` primitive — the
 * domain never asks to record an audit row, it just mutates and the trigger
 * captures the session vars.
 */
export interface AuditContext {
  userId: string;
  organizationId: string;
  /** Required for LOCKED-document mutations; optional otherwise. */
  justification?: string;
}

/**
 * Minimum scope every UoW exposes. Modules extend this with their own
 * tx-bound repos by declaring `XxxScope extends BaseScope { ... }` and
 * specialising the port as `UnitOfWork<XxxScope>`.
 */
export interface BaseScope {
  /**
   * Correlation id for this run. Generated BEFORE the tx opens, so it is
   * stable across the entire fn execution and remains accessible to the
   * caller even if the tx rolls back.
   */
  readonly correlationId: string;

  /**
   * Tx-bound fiscal_periods writer. Mirrors the legacy
   * `MonthlyCloseRepository.markPeriodClosed`. First scope repo introduced
   * during POC #9 — the shape grows as other modules migrate.
   */
  readonly fiscalPeriods: FiscalPeriodsTxRepo;
}

/**
 * Backward-compat alias. Pre-POC-10 callers reference `UnitOfWorkScope`;
 * keeping the alias means POC #9 code is unaffected by the generic refactor.
 */
export type UnitOfWorkScope = BaseScope;

export interface UnitOfWork<TScope extends BaseScope = BaseScope> {
  run<T>(
    ctx: AuditContext,
    fn: (scope: TScope) => Promise<T>,
  ): Promise<{ result: T; correlationId: string }>;
}
