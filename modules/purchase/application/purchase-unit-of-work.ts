import type {
  BaseScope,
  UnitOfWork,
} from "@/modules/shared/domain/ports/unit-of-work";
import type { JournalEntriesRepository } from "@/modules/accounting/domain/ports/journal-entries.repo";
import type { AccountBalancesRepository } from "@/modules/accounting/domain/ports/account-balances.repo";
import type { PayableRepository } from "@/modules/payables/domain/payable.repository";
import type { PurchaseRepository } from "../domain/ports/purchase.repository";
import type { JournalEntryFactoryPort } from "@/modules/sale/domain/ports/journal-entry-factory.port";
import type { IvaBookRegenNotifierPort } from "../domain/ports/iva-book-regen-notifier.port";

/**
 * Purchase-specific UoW scope. Tx-bound repos owned by purchase-hex use
 * cases. Cross-module repos (`payables`, `journalEntries`, `accountBalances`,
 * `journalEntryFactory`) están dentro del scope (paridad con `SaleScope`
 * A2 sale-hex y `AccountingScope` POC #10 C2-A/B). Los IVA cascade ports
 * (`ivaBookRegenNotifier`, `ivaBookVoidCascade`) entrarán al scope en C5/C6
 * cuando los use cases los demanden.
 *
 * `payables` (PayableRepository) vive INSIDE — `post` / `update` requieren
 * `createTx`/`voidTx`/`applyTrimPlanTx` tx-aware. Mismo patrón sale-hex
 * con `receivables`.
 *
 * `journalEntryFactory` heredado del port sale-hex (decisión step 0 A2
 * lockeada, id 1378) extendido con `generateForPurchase` en C4. Vive
 * INSIDE porque el `PrismaJournalEntryFactoryAdapter` toma la tx en su
 * constructor — singleton at composition-root no puede capturar per-run tx.
 *
 * `IvaBookReaderPort` es read-only y vive OUTSIDE (paridad sale-hex y
 * `FiscalPeriodsReadPort`).
 */
export interface PurchaseScope extends BaseScope {
  readonly purchases: PurchaseRepository;
  readonly journalEntries: JournalEntriesRepository;
  readonly accountBalances: AccountBalancesRepository;
  readonly payables: PayableRepository;
  readonly journalEntryFactory: JournalEntryFactoryPort;
  readonly ivaBookRegenNotifier: IvaBookRegenNotifierPort;
}

export type PurchaseUnitOfWork = UnitOfWork<PurchaseScope>;
