import type {
  BaseScope,
  UnitOfWork,
} from "@/modules/shared/domain/ports/unit-of-work";
import type { AccountingReaderPort } from "../domain/ports/accounting-reader.port";
import type { PeriodLockingWriterPort } from "../domain/ports/period-locking-writer.port";

/**
 * Monthly-close-specific UoW scope. Tx-bound ports owned/consumed by
 * monthly-close-hex use cases enter via scope-membership (R5 NO Prisma leak
 * — port signatures permanecen domain pure, adapter C3 wires tx context).
 *
 * - `accounting`: AccountingReaderPort C1 enters scope tx-bound — `sumDebitCredit`
 *   raw SQL JOIN `journal_lines + journal_entries` MUST run INSIDE-TX para
 *   atomicity (snapshot consistency under lock cascade). NoTx variant defer
 *   C2.5 getSummary axis-distinto (read-only outside-tx use case).
 * - `locking`: PeriodLockingWriterPort C2.1 5 methods cross-entity tx-bound
 *   — STRICT ORDER preserved at service-level (Dispatch → Payment → JE →
 *   Sale → Purchase) C2.2 orchestration responsibility.
 * - `fiscalPeriods.markClosed` consumido directo via `BaseScope.fiscalPeriods`
 *   (cumulative POC #9 shared `FiscalPeriodsTxRepo` — JSDoc explicit future
 *   monthly-close target migrate hex). NO new port owned monthly-close.
 * - `correlationId` consumido directo via `BaseScope` — generated PRE-TX por
 *   adapter, propagated audit_logs vía PL/pgSQL triggers post `setAuditContext`.
 * - `AuditContext {userId, organizationId, justification?}` passed PARAMETER
 *   de `UoW.run(ctx, fn)` — adapter llama `setAuditContext` INSIDE-tx auto.
 */
export interface MonthlyCloseScope extends BaseScope {
  readonly accounting: AccountingReaderPort;
  readonly locking: PeriodLockingWriterPort;
}

export type MonthlyCloseUnitOfWork = UnitOfWork<MonthlyCloseScope>;
