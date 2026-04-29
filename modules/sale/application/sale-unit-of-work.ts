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
 * `IvaBookReaderPort` is read-only and lives OUTSIDE the scope (parity with
 * `FiscalPeriodsReadPort`).
 */
export interface SaleScope extends BaseScope {
  readonly sales: SaleRepository;
  readonly journalEntries: JournalEntriesRepository;
  readonly accountBalances: AccountBalancesRepository;
  readonly receivables: ReceivableRepository;
  readonly ivaBookRegenNotifier: IvaBookRegenNotifierPort;
  readonly ivaBookVoidCascade: IvaBookVoidCascadePort;
}

export type SaleUnitOfWork = UnitOfWork<SaleScope>;
