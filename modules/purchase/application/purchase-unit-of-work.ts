import type {
  BaseScope,
  UnitOfWork,
} from "@/modules/shared/domain/ports/unit-of-work";
import type { PurchaseRepository } from "../domain/ports/purchase.repository";

/**
 * Purchase-specific UoW scope. Tx-bound repos owned by purchase-hex use
 * cases. Cross-module repos (`payables`, `journalEntries`, `accountBalances`,
 * `journalEntryFactory`, `ivaBookRegenNotifier`, `ivaBookVoidCascade`) entran
 * al scope conforme los use cases que los necesitan landeen — strict TDD
 * per-test, sin speculative scaffolding (paridad con `SaleScope` A2 sale-hex
 * y `AccountingScope` POC #10 C2-A/B).
 *
 * `PayableRepository` vive INSIDE el scope porque createDraft/post/update
 * cascade requieren `createTx`/`voidTx`/`applyTrimPlanTx` (tx-aware). Será
 * agregado en C3/C4 cuando los use cases lo demanden.
 *
 * Los IVA cascade ports (`ivaBookRegenNotifier`, `ivaBookVoidCascade`)
 * entrarán al scope en C5/C6 — comparten la misma tx Postgres que el write
 * de purchase (paridad legacy: las mutaciones IVA rollback si purchase
 * rollback). Temporal §5.5; retirados en POC #11.0c.
 *
 * `IvaBookReaderPort` es read-only y vive OUTSIDE el scope (paralelo a
 * sale-hex y `FiscalPeriodsReadPort`).
 */
export interface PurchaseScope extends BaseScope {
  readonly purchases: PurchaseRepository;
}

export type PurchaseUnitOfWork = UnitOfWork<PurchaseScope>;
