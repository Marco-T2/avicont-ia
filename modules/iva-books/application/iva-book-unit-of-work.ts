import type {
  BaseScope,
  UnitOfWork,
} from "@/modules/shared/domain/ports/unit-of-work";
import type { IvaSalesBookEntryRepository } from "../domain/ports/iva-sales-book-entry-repository.port";
import type { IvaPurchaseBookEntryRepository } from "../domain/ports/iva-purchase-book-entry-repository.port";

/**
 * IVA-specific UoW scope. Tx-bound repos owned by IVA-hex use cases.
 *
 * **B locked (POC #11.0c A2)** — single UoW con 2 repos sale + purchase
 * (NO split por aggregate). Razones:
 *   1. Mirror estructural POC #10 / POC #11.0a / POC #11.0b — 1 UoW por
 *      módulo, no por aggregate. D-A1#2 split aggregates fue por fidelidad
 *      legacy 2 tablas, pero UoW es construct hex — no necesita mirror
 *      legacy en cantidad.
 *   2. `applyVoidCascade` legacy es un solo flujo que toca ambas tablas —
 *      split forzaría `UoW.run()` anidados con semántica Postgres ambigua.
 *   3. Composition root simpler: 1 factory `makeIvaBookService()`.
 *
 * **C locked (POC #11.0c A2)** — 0 cross-module §17 carve-outs en
 * `IvaBookScope`. Asimetría intencional con `SaleScope` / `PurchaseScope`
 * (que sí incluyen `journalEntries` / `accountBalances` / `receivables` ó
 * `payables`): IVA NO escribe journals ni balances directamente — el
 * bridge `Sale/PurchaseJournalRegenNotifierPort` es side-effect
 * cross-module con tx propia hex (D-1 lockeada). Los repos tx-bound del
 * scope son solo los del propio aggregate IVA.
 *
 * **F-α lockeada (POC #11.0c A2)** — `applyVoidCascade` NO usa
 * `uow.run()` interno; recibe `scope: IvaBookScope` directamente como
 * parámetro porque el caller (legacy `voidCascadeTx` chain) ya tiene una
 * tx parent abierta. Razón: legacy recibe `tx` por parámetro (líneas
 * 559-602 + 618-659), nested tx Postgres semantics ambiguas + caller
 * pierde atomicidad cross-module si IVA abre tx propia. Asimetría con
 * regenerate / recompute / void / reactivate (que sí usan `uow.run()`)
 * intencional — paralelo D-A1#3 wrapper pattern: cascade entry point
 * recibe scope/tx del caller.
 *
 * **Temporal §5.5 — note**: durante POC #11.0c A2-A4-a permanecen vivos
 * los 4 ports cascade legacy en `SaleScope` / `PurchaseScope`
 * (`IvaBookRegenNotifier` + `IvaBookVoidCascade` × {sale, purchase}) más
 * 2 readers temporales (`IvaBookReaderPort` × {sale, purchase}). Retire
 * coordinado en POC #11.0c A5 cleanup integral cuando IVA-hex sea destino
 * via inversion de dirección — patrón paralelo POC #11.0b ports cleanup.
 */
export interface IvaBookScope extends BaseScope {
  readonly ivaSalesBooks: IvaSalesBookEntryRepository;
  readonly ivaPurchaseBooks: IvaPurchaseBookEntryRepository;
}

export type IvaBookUnitOfWork = UnitOfWork<IvaBookScope>;
