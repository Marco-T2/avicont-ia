import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { makePurchaseService } from "@/modules/purchase/presentation/composition-root";
import { makeSaleService } from "@/modules/sale/presentation/composition-root";
import { PrismaFiscalPeriodsTxRepo } from "@/modules/shared/infrastructure/prisma-fiscal-periods-tx.repo";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";

import { IvaBookService } from "../application/iva-book.service";
import type { IvaBookScope } from "../application/iva-book-unit-of-work";
import { LegacyFiscalPeriodsAdapter } from "../infrastructure/legacy-fiscal-periods.adapter";
import { PrismaIvaBookUnitOfWork } from "../infrastructure/prisma-iva-book-unit-of-work";
import { PrismaIvaPurchaseBookEntryRepo } from "../infrastructure/prisma-iva-purchase-book-entry.repo";
import { PrismaIvaSalesBookEntryRepo } from "../infrastructure/prisma-iva-sales-book-entry.repo";
import { PrismaPurchaseReaderAdapter } from "../infrastructure/prisma-purchase-reader.adapter";
import { PrismaSaleReaderAdapter } from "../infrastructure/prisma-sale-reader.adapter";
import { PurchaseJournalRegenNotifierAdapter } from "../infrastructure/purchase-journal-regen-notifier.adapter";
import { SaleJournalRegenNotifierAdapter } from "../infrastructure/sale-journal-regen-notifier.adapter";

/**
 * Composition root for the iva-books module (POC #11.0c A3 Ciclo 6.b) —
 * single point of wiring concrete adapters to `IvaBookService`. Mirror
 * precedent purchase C6 `modules/purchase/presentation/composition-root.ts`
 * (commit `5b61594`) + sale C6 (commit `31830b0`) salvo asimetrías
 * declaradas:
 *   - 6 deps (vs 10 purchase / 9 sale). El delta lo absorbe lock C textual
 *     (`iva-book-unit-of-work.ts:21-27`): IVA NO escribe journals ni
 *     balances directamente — bridge cross-module va por
 *     `Sale/PurchaseJournalRegenNotifierPort`. No hay `accountLookup` /
 *     `journalEntries` / `accountBalances` / `voucherTypes` / etc.
 *   - 0 cross-module concrete imports en este archivo — TODOS los adapters
 *     infrastructure son del propio módulo iva-books (heredado lock C
 *     aplicado a toda la stack hex). Cross-module reuse va por
 *     presentation→presentation factories `makeSaleService()` /
 *     `makePurchaseService()` (precedent purchase root reutiliza
 *     `makeOrgSettingsService()` mismo patrón — NO viola R4).
 *
 * **R4 carve-out** (architecture.md): único archivo bajo `presentation/`
 * autorizado a importar de `infrastructure/`. ESLint glob
 * `eslint.config.mjs:152` `modules/<m>/presentation/composition-root.ts`
 * cubre este archivo automáticamente sin modificación. NO §17 carve-out
 * cite — TODOS los imports infrastructure son del propio módulo
 * iva-books; §17 aplica solo a cross-module concrete imports y este
 * composition root no tiene ninguno (ver POC #11.0b A3
 * `cross-module-imports-catalog` para la asimetría con purchase root que
 * tampoco cita §17 — sigue R4 carve-out only).
 *
 * **Cross-module deps via factories**:
 *   - `SaleJournalRegenNotifierAdapter` (C4) consume `SaleService` instance
 *     vía `makeSaleService()` cross-module factory. Bridge inbound:
 *     IVA-hex → sale-hex `regenerateJournalForIvaChange` use case wrap
 *     (D-A1#3 wrap-thin lockeada).
 *   - `PurchaseJournalRegenNotifierAdapter` (C5) consume `PurchaseService`
 *     instance vía `makePurchaseService()`. Mismo patrón simétrico.
 *
 * `repoLike` pattern paridad sale/purchase: thin wrapper sobre
 * `prisma.$transaction` que `PrismaIvaBookUnitOfWork` consume vía
 * `withAuditTx` (las 4 invariantes correlationId pre-tx, SET LOCAL,
 * fn invoke, return shape inherited unchanged).
 *
 * NO test integration dedicado (mirror purchase / sale composition root
 * estricto): factory single-shot trivial wiring; integration downstream
 * (PrismaIvaBookUnitOfWork + adapters propios) cubre el shape end-to-end.
 */

const repoLike: UnitOfWorkRepoLike = {
  transaction: (fn, options) => prisma.$transaction(fn, options),
};

/**
 * **POC #11.0c A4-c C2 GREEN P4 (ii) lockeada Marco** — module-level
 * memoización single-instance. Cumple intent Opción α "single-instance"
 * lockeada Marco en C1 cycle-break: factory captured at composition,
 * resolved at runtime first method call → mismo instance reused across
 * cascade flows. Sin memo, cada invocación de factory en sale/purchase
 * UoW alocaba IvaBookService nuevo + transitivamente makeSaleService /
 * makePurchaseService cross-module re-construcción.
 *
 * Asimetría documentada vs POC #10 `makeJournalsService` (NO memoiza):
 * POC #10 standalone sin cycle, no requiere single-instance contract.
 * POC #11.0c con cycle IVA<>Sale/Purchase rompido por factory shape
 * lazy callback — single-instance via memoización completa el contrato.
 */
let _instance: IvaBookService | undefined;

export function makeIvaBookService(): IvaBookService {
  if (_instance) return _instance;
  _instance = new IvaBookService({
    uow: new PrismaIvaBookUnitOfWork(repoLike),
    fiscalPeriods: new LegacyFiscalPeriodsAdapter(),
    saleReader: new PrismaSaleReaderAdapter(prisma),
    purchaseReader: new PrismaPurchaseReaderAdapter(prisma),
    saleJournalRegenNotifier: new SaleJournalRegenNotifierAdapter(
      makeSaleService(),
    ),
    purchaseJournalRegenNotifier: new PurchaseJournalRegenNotifierAdapter(
      makePurchaseService(),
    ),
    ivaSalesBooks: new PrismaIvaSalesBookEntryRepo(prisma),
    ivaPurchaseBooks: new PrismaIvaPurchaseBookEntryRepo(prisma),
  });
  return _instance;
}

/**
 * Test-only reset hook (P4 (ii) lockeada Marco). Industry-standard test
 * isolation pattern para module-level memoization — cada `beforeEach` en
 * integration tests cleanup mirror C3 invoca este reset para evitar
 * memo persist cross-test. Naming `__` prefix señala intent test-only.
 */
export function __resetForTesting(): void {
  _instance = undefined;
}

/**
 * **POC #11.0c A4-c C2 GREEN P1 (b) lockeada Marco** — scopeFactory
 * injection cross-module via closure. Sale/purchase notifier adapters
 * reciben este factory por ctor (vía sale/purchase UoW que lo recibe
 * como dep en composition); body invoca `factory(tx, correlationId)`
 * para construir scope tx-bound al momento del cascade hex call.
 *
 * Closure cierra sobre prisma adapters iva-side + shared `PrismaFiscalPeriodsTxRepo`.
 * CERO cross-module concrete imports en sale/purchase infrastructure
 * (§17 preservado) — adapter consume scope blueprint vía factory shape,
 * no instancia adapters concretos por su cuenta.
 *
 * Mirror precedent estructural: sale UoW ya inyecta
 * `PrismaJournalEntryFactoryAdapter` construido in-callback con tx outer
 * shared (E-6.a α + paridad scope-bound POC #10) — mismo patrón aquí
 * para IvaBookScope construction.
 */
export function makeIvaScopeFactory(): (
  tx: Prisma.TransactionClient,
  correlationId: string,
) => IvaBookScope {
  return (tx, correlationId) => ({
    correlationId,
    fiscalPeriods: new PrismaFiscalPeriodsTxRepo(tx),
    ivaSalesBooks: new PrismaIvaSalesBookEntryRepo(tx),
    ivaPurchaseBooks: new PrismaIvaPurchaseBookEntryRepo(tx),
  });
}
