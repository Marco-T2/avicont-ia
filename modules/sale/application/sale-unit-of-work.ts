import type {
  BaseScope,
  UnitOfWork,
} from "@/modules/shared/domain/ports/unit-of-work";
import type { JournalEntriesRepository } from "@/modules/accounting/domain/ports/journal-entries.repo";
import type { AccountBalancesRepository } from "@/modules/accounting/domain/ports/account-balances.repo";
import type { ReceivableRepository } from "@/modules/receivables/domain/receivable.repository";
import type { SaleRepository } from "../domain/ports/sale.repository";
import type { IvaBookRegenNotifierPort } from "../domain/ports/iva-book-regen-notifier.port";
import type { IvaBookVoidCascadePort } from "../domain/ports/iva-book-void-cascade.port";
import type { JournalEntryFactoryPort } from "../domain/ports/journal-entry-factory.port";

/**
 * Sale-specific UoW scope. Tx-bound repos owned by sale-hex use cases.
 * Cross-module repos (`journalEntries`, `accountBalances`, `receivables`)
 * enter the scope as the use cases that need them land — strict TDD per-test,
 * no speculative scaffolding (parity with `AccountingScope` POC #10 C2-A/B).
 *
 * IVA cascade ports (`ivaBookRegenNotifier`, `ivaBookVoidCascade`) live inside
 * the scope because they MUST share the same Postgres tx as the sale write
 * (legacy parity: `editPosted`/`voidCascadeTx` — IVA mutations rollback if the
 * sale rollback). Temporal §5.5; retired in POC #11.0c.
 *
 * `journalEntryFactory` lives inside the scope because the concrete
 * `PrismaJournalEntryFactoryAdapter` (Ciclo 4 c2 DI lockeada D-2) takes the
 * Prisma tx in its constructor — a singleton at composition-root build time
 * cannot capture the per-run tx. Surfaced as §13 emergente E-6.a in Ciclo 6;
 * α resolution lockeada Marco.
 *
 * `IvaBookReaderPort` is read-only and lives OUTSIDE the scope (parity with
 * `FiscalPeriodsReadPort`).
 */
export interface SaleScope extends BaseScope {
  readonly sales: SaleRepository;
  readonly journalEntries: JournalEntriesRepository;
  readonly accountBalances: AccountBalancesRepository;
  readonly receivables: ReceivableRepository;
  readonly journalEntryFactory: JournalEntryFactoryPort;
  readonly ivaBookRegenNotifier: IvaBookRegenNotifierPort;
  readonly ivaBookVoidCascade: IvaBookVoidCascadePort;
}

export type SaleUnitOfWork = UnitOfWork<SaleScope>;
