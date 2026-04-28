import type {
  BaseScope,
  UnitOfWork,
} from "@/modules/shared/domain/ports/unit-of-work";
import type { AccountBalancesRepository } from "./account-balances.repo";
import type { JournalEntriesRepository } from "./journal-entries.repo";

/**
 * Accounting-specific UoW scope. Extends the shared `BaseScope` with the
 * tx-aware repos owned by this module. The Prisma adapter (C3) populates each
 * field with a tx-bound implementation; the in-memory fake used by
 * application-layer tests provides recording stubs.
 *
 * Repos enter this scope as the use cases that require them land — strict TDD
 * per-test, no speculative scaffolding. C2-A introduced `journalEntries`;
 * C2-B (createAndPost) introduces `accountBalances`.
 */
export interface AccountingScope extends BaseScope {
  readonly journalEntries: JournalEntriesRepository;
  readonly accountBalances: AccountBalancesRepository;
}

/**
 * Concrete UoW type accounting use cases depend on. Specialises the shared
 * generic `UnitOfWork<TScope>` to `AccountingScope` so consumers see
 * `scope.journalEntries` available alongside `scope.fiscalPeriods` and
 * `scope.correlationId`.
 */
export type AccountingUnitOfWork = UnitOfWork<AccountingScope>;
