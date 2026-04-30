import "server-only";

import { AccountsRepository } from "@/features/accounting/accounts.repository";
import { AutoEntryGenerator } from "@/features/accounting/auto-entry-generator";
import { IvaBooksService } from "@/features/accounting/iva-books/iva-books.service";
import { VoucherTypesRepository } from "@/features/voucher-types/server";
import { prisma } from "@/lib/prisma";
import { FiscalPeriodsReadAdapter } from "@/modules/accounting/infrastructure/fiscal-periods-read.adapter";
import { LegacyJournalEntriesReadAdapter } from "@/modules/accounting/infrastructure/legacy-journal-entries-read.adapter";
import { PrismaContactRepository } from "@/modules/contacts/infrastructure/prisma-contact.repository";
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
 * §17.1 cross-module concrete imports (composition root carve-out — wiring
 * autorizado a importar adapters concretos de otros módulos, cada uno
 * implementa un port en `domain/` del módulo dueño, R3 vigente):
 *   - `payables/PrismaPayablesRepository`         (port `payables/domain/payable.repository` — sustituye Receivables del sale C6)
 *   - `contacts/PrismaContactRepository`          (port `contacts/domain/contact.repository`)
 *   - `accounting/FiscalPeriodsReadAdapter`       (port `accounting/domain/ports/fiscal-periods-read.port`)
 *   - `accounting/LegacyJournalEntriesReadAdapter`(port `accounting/domain/ports/journal-entries-read.port` — reusado: dep UoW + spread service)
 *   - `org-settings/LegacyAccountLookupAdapter`   (port `org-settings/domain/ports/account-lookup.port` — reusado: dep UoW + spread service, `accountsRepo` shared via D-4 sale C6)
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
const ivaBooksService = new IvaBooksService();
const journalEntriesReadAdapter = new LegacyJournalEntriesReadAdapter();
const accountLookupAdapter = new LegacyAccountLookupAdapter(accountsRepo);

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
      ivaBooksService,
    ),
    accountLookup: accountLookupAdapter,
    orgSettings: new PrismaOrgSettingsReaderAdapter(makeOrgSettingsService()),
    fiscalPeriods: new FiscalPeriodsReadAdapter(),
    ivaBookReader: new PrismaIvaBookReaderAdapter(prisma),
    purchasePermissions: new LegacyPurchasePermissionsAdapter(),
    journalEntriesRead: journalEntriesReadAdapter,
  });
}
