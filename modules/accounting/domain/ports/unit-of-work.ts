import type {
  BaseScope,
  UnitOfWork,
} from "@/modules/shared/domain/ports/unit-of-work";
import type { JournalEntriesRepository } from "./journal-entries.repo";

/**
 * Accounting-specific UoW scope. Extends the shared `BaseScope` with the
 * tx-aware repos owned by this module. The Prisma adapter (C3) will populate
 * `journalEntries` with a tx-bound implementation; the in-memory fake used by
 * application-layer tests provides a recording stub.
 *
 * `accountBalances` is added to this scope when `createAndPost` /
 * `transitionStatus` use cases require it (TDD strict per-test — no
 * speculative scaffolding).
 */
export interface AccountingScope extends BaseScope {
  readonly journalEntries: JournalEntriesRepository;
}

/**
 * Concrete UoW type accounting use cases depend on. Specialises the shared
 * generic `UnitOfWork<TScope>` to `AccountingScope` so consumers see
 * `scope.journalEntries` available alongside `scope.fiscalPeriods` and
 * `scope.correlationId`.
 */
export type AccountingUnitOfWork = UnitOfWork<AccountingScope>;
