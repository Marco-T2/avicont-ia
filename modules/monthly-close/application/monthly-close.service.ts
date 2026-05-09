import type { FiscalPeriodReaderPort } from "../domain/ports/fiscal-period-reader.port";
import type { DraftDocumentsReaderPort } from "../domain/ports/draft-documents-reader.port";
import type { MonthlyCloseUnitOfWork } from "./monthly-close-unit-of-work";
import {
  PeriodAlreadyClosedError,
  BalanceNotZeroError,
  DraftEntriesPresentError,
} from "../domain/errors/monthly-close-errors";

/**
 * Resultado del cierre mensual. Inline service file (cumulative-precedent
 * ≥4 evidencias supersede — sale `PostSaleResult` + `CreateDraftResult` +
 * payment `LockedEditContext` + iva-book DTOs). Mirror legacy
 * `features/monthly-close/monthly-close.types.ts:8-20` shape EXACT —
 * `correlationId` se propaga via spread post-`UoW.run` return cumulative
 * pattern (sale 5 use cases + payment 5 use cases supersede absoluto).
 */
export interface CloseResult {
  periodId: string;
  periodStatus: "CLOSED";
  closedAt: Date;
  correlationId: string;
  locked: {
    dispatches: number;
    payments: number;
    journalEntries: number;
    sales: number;
    purchases: number;
  };
}

export interface MonthlyCloseServiceDeps {
  fiscalPeriods: FiscalPeriodReaderPort;
  draftDocuments: DraftDocumentsReaderPort;
  uow: MonthlyCloseUnitOfWork;
}

/**
 * Application service orquestador puro — cierre mensual de período fiscal.
 * Mirror legacy `features/monthly-close/monthly-close.service.ts:135-230`
 * (fidelidad regla #1) — flow EXACT preserved.
 *
 * **Pre-TX (outside scope read-only)**:
 *   1. `fiscalPeriods.getById` — adapter throws `NotFoundError(PERIOD_NOT_FOUND)`
 *      on miss (legacy parity).
 *   2. `period.status !== "OPEN"` string compare service-level (Snapshot LOCAL
 *      primitive C1 cementación textual `fiscal-period-reader.port.ts:20`
 *      explicit "consumer-side check, NO isOpen port method"; cumulative-
 *      precedent 4 evidencias supersede absoluto sale/purchase/payment/
 *      accounting). Throw `PeriodAlreadyClosedError` typed C1.
 *   3. `draftDocuments.countDraftsByPeriod` — 5-count Snapshot LOCAL primitive.
 *      Sum + total > 0 inline check (NO helper validateCanClose YAGNI 1
 *      callsite). Throw `DraftEntriesPresentError(...5 args)` typed C2.1
 *      single bundle 15ª evidencia.
 *
 * **INSIDE-TX (UoW.run callback, scope-membership tx-bound)**:
 *   1. `scope.accounting.sumDebitCredit` — raw SQL JOIN bajo same tx para
 *      atomicity snapshot consistency under lock cascade.
 *   2. `Money.equals` bit-perfect balance gate (Decimal raw equals; 1ra
 *      evidencia POC monthly-close paired sister 4ta cementación Money VO
 *      cross-POC). Throw `BalanceNotZeroError(debit, credit)` typed C1.
 *   3. Lock cascade STRICT ORDER (Dispatch → Payment → JournalEntry → Sale →
 *      Purchase) — service-level orchestration responsibility (port no impone
 *      orden, secuencial driver legacy parity §"Lock order" design.md).
 *   4. `scope.fiscalPeriods.markClosed` LAST inside-tx — destruct `closedAt`
 *      único campo consumido (BaseScope shared cumulative POC #9; `closedBy`
 *      retornado por port pero no propagado al CloseResult).
 *
 * `correlationId` lo genera el adapter UoW PRE-TX (BaseScope cumulative POC
 * #9) y vuelve via `{ result, correlationId }`; service spread cumulative-
 * precedent pattern. NO `crypto.randomUUID()` en service.
 *
 * TOCTOU Riesgo A heredado: NO duplicate INSIDE-TX status re-check; defer
 * scope POC. Idempotency Riesgo F heredado: si markClosed throws unique
 * violation, throw envuelve adapter (defer scope POC).
 */
export class MonthlyCloseService {
  constructor(private readonly deps: MonthlyCloseServiceDeps) {}

  async close(
    organizationId: string,
    periodId: string,
    userId: string,
    justification?: string,
  ): Promise<CloseResult> {
    // ── Pre-TX ────────────────────────────────────────────────────────────
    const period = await this.deps.fiscalPeriods.getById(organizationId, periodId);
    if (period.status !== "OPEN") {
      throw new PeriodAlreadyClosedError();
    }

    const drafts = await this.deps.draftDocuments.countDraftsByPeriod(
      organizationId,
      periodId,
    );
    const total =
      drafts.dispatches +
      drafts.payments +
      drafts.journalEntries +
      drafts.sales +
      drafts.purchases;
    if (total > 0) {
      throw new DraftEntriesPresentError(
        drafts.dispatches,
        drafts.payments,
        drafts.journalEntries,
        drafts.sales,
        drafts.purchases,
      );
    }

    // ── INSIDE-TX ─────────────────────────────────────────────────────────
    const { result, correlationId } = await this.deps.uow.run(
      { userId, organizationId, justification },
      async (scope) => {
        const balance = await scope.accounting.sumDebitCredit(
          organizationId,
          periodId,
        );
        if (!balance.debit.equals(balance.credit)) {
          throw new BalanceNotZeroError(balance.debit, balance.credit);
        }

        // Lock cascade STRICT ORDER — service-level orchestration responsibility.
        const dispatches = await scope.locking.lockDispatches(organizationId, periodId);
        const payments = await scope.locking.lockPayments(organizationId, periodId);
        const journalEntries = await scope.locking.lockJournalEntries(organizationId, periodId);
        const sales = await scope.locking.lockSales(organizationId, periodId);
        const purchases = await scope.locking.lockPurchases(organizationId, periodId);

        // markClosed LAST inside-tx.
        const { closedAt } = await scope.fiscalPeriods.markClosed(
          organizationId,
          periodId,
          userId,
        );

        return {
          periodId,
          periodStatus: "CLOSED" as const,
          closedAt,
          locked: { dispatches, payments, journalEntries, sales, purchases },
        };
      },
    );

    return { ...result, correlationId };
  }
}
