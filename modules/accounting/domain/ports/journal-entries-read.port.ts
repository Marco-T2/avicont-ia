import type { Journal } from "../journal.entity";

/**
 * Read-only port for journal entries. Non-tx — entries are hydrated BEFORE the
 * UoW tx opens, mirroring legacy `journal.service.ts:557` (`this.repo.findById`
 * runs above `withAuditTx`). Keeping the read OUTSIDE the tx preserves parity
 * pre-tx for use cases that need to fail fast on NotFound, AUTO_ENTRY_VOID,
 * I7 (VOIDED inmutable) or I5 (invalid transition) without opening a Postgres
 * transaction + audit context that would otherwise rollback empty.
 *
 * Lives OUTSIDE `AccountingScope` for the same reason `PermissionsPort`,
 * `AccountsReadPort`, `FiscalPeriodsReadPort`, `ContactsReadPort` and
 * `VoucherTypesReadPort` do: read-non-tx vs write-tx-aware is a module rule.
 * Mixing both into the same port would mislead readers about the semantics
 * (the C2-B `JournalEntriesRepository` stays tx-aware in the scope; this is a
 * separate port).
 *
 * Adapter (C3) wraps the legacy `journalRepository.findById` (or service
 * equivalent) and rehydrates a `Journal` aggregate via `Journal.fromPersistence`.
 * The adapter MUST return null when the entry does not exist so the use case
 * surfaces `NotFoundError("Asiento contable")` (parity legacy l558).
 */
export interface JournalEntriesReadPort {
  findById(
    organizationId: string,
    entryId: string,
  ): Promise<Journal | null>;
}
