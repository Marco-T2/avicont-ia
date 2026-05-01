import "server-only";

import { AccountsRepository } from "@/features/accounting/accounts.repository";
import { AutoEntryGenerator } from "@/features/accounting/auto-entry-generator";
import { VoucherTypesRepository } from "@/features/voucher-types/server";
import { prisma } from "@/lib/prisma";
import { FiscalPeriodsReadAdapter } from "@/modules/accounting/infrastructure/fiscal-periods-read.adapter";
import { LegacyJournalEntriesReadAdapter } from "@/modules/accounting/infrastructure/legacy-journal-entries-read.adapter";
import { PrismaContactRepository } from "@/modules/contacts/infrastructure/prisma-contact.repository";
import {
  makeIvaBookService,
  makeIvaScopeFactory,
} from "@/modules/iva-books/presentation/composition-root";
import { LegacyAccountLookupAdapter } from "@/modules/org-settings/infrastructure/legacy-account-lookup.adapter";
import { makeOrgSettingsService } from "@/modules/org-settings/presentation/composition-root";
import { PrismaPayablesRepository } from "@/modules/payables/infrastructure/prisma-payables.repository";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";

import { PurchaseService } from "../application/purchase.service";
import { LegacyPurchasePermissionsAdapter } from "../infrastructure/legacy-purchase-permissions.adapter";
import { PrismaIvaBookReaderAdapter } from "../infrastructure/prisma-iva-book-reader.adapter";
import { PrismaOrgSettingsReaderAdapter } from "../infrastructure/prisma-org-settings-reader.adapter";
import { PrismaPurchaseRepository } from "../infrastructure/prisma-purchase.repository";
import { PrismaPurchaseUnitOfWork } from "../infrastructure/prisma-purchase-unit-of-work";

/**
 * Composition root for the purchase module (POC #11.0b A3 Ciclo 6b) — single
 * point of wiring concrete adapters to `PurchaseService`. Mirror sale C6
 * `modules/sale/presentation/composition-root.ts` (commit `31830b0`)
 * byte-equivalent salvo asimetrías declaradas: object DI spread vs positional
 * (§11.1 STICK `PurchaseServiceDeps` 10 fields opcionales — A2 Ciclo 5b
 * lockeada Marco 6+ deps), `payables` ↔ `receivables`, `purchasePermissions`
 * ↔ `salePermissions`, `PrismaIvaBookReaderAdapter` purchase-side propio
 * (Ciclo 5a). Único archivo bajo `presentation/` autorizado a importar de
 * `infrastructure/` (architecture.md R4 carve-out).
 *
 * `journalEntryFactory` + `ivaBookRegenNotifier` + `ivaBookVoidCascade` viven
 * en el `PurchaseScope` construido per-tx por `PrismaPurchaseUnitOfWork` —
 * NO son deps de `PurchaseService` (heredado de A2 #1378 + extensión A3 C4
 * sale `generateForPurchase`/`regenerateForPurchaseEdit` cross-module). El
 * UoW recibe 4 cross-module deps en constructor (`journalEntriesReadPort`,
 * `accountLookupPort`, `autoEntryGen`, `ivaBooksService`) — Ciclo 4 D-2 c2
 * DI per-tx via composition root.
 *
 * `makeOrgSettingsService()` cross-module reuse (presentation → presentation
 * factory) NO viola R4. Bookmark E-2 POC #11.0c reorg cross-module ports por
 * dominio target.
 */

const repoLike: UnitOfWorkRepoLike = {
  transaction: (fn, options) => prisma.$transaction(fn, options),
};

// Legacy cross-module singletons — instanciados una sola vez. `accountsRepo`
// se reusa entre AutoEntryGenerator (in-tx code→id resolution) y
// LegacyAccountLookupAdapter (pre-tx id→code resolution) — D-4 lockeada Ciclo
// 4 sale.
const accountsRepo = new AccountsRepository();
const voucherTypesRepo = new VoucherTypesRepository();
const autoEntryGen = new AutoEntryGenerator(accountsRepo, voucherTypesRepo);
const journalEntriesReadAdapter = new LegacyJournalEntriesReadAdapter();
const accountLookupAdapter = new LegacyAccountLookupAdapter(accountsRepo);

/**
 * **POC #11.0c A4-c C2 GREEN cutover hex (P1 (b) + P4 (ii) + cycle-break
 * Opción α lockeada Marco)**: UoW recibe `() => makeIvaBookService()` (hex
 * factory wrap) en lugar de legacy singleton wrap. Memoización iva root
 * (P4 (ii)) garantiza single-instance contract intent Opción α. `makeIvaScopeFactory()`
 * provee closure cross-module cerrando sobre prisma adapters iva-side;
 * purchase infrastructure adapter recibe factory shape, NO importa concrete
 * iva adapters (§17 preservado). Mirror simétrico sale comp-root.
 */
export function makePurchaseService(): PurchaseService {
  return new PurchaseService({
    repo: new PrismaPurchaseRepository(),
    payables: new PrismaPayablesRepository(),
    contacts: new PrismaContactRepository(),
    uow: new PrismaPurchaseUnitOfWork(
      repoLike,
      journalEntriesReadAdapter,
      accountLookupAdapter,
      autoEntryGen,
      () => makeIvaBookService(),
      makeIvaScopeFactory(),
    ),
    accountLookup: accountLookupAdapter,
    orgSettings: new PrismaOrgSettingsReaderAdapter(makeOrgSettingsService()),
    fiscalPeriods: new FiscalPeriodsReadAdapter(),
    ivaBookReader: new PrismaIvaBookReaderAdapter(prisma),
    purchasePermissions: new LegacyPurchasePermissionsAdapter(),
    journalEntriesRead: journalEntriesReadAdapter,
  });
}
