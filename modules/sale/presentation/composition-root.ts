import "server-only";

import { PrismaAccountsRepo } from "@/modules/accounting/infrastructure/prisma-accounts.repo";
import { AutoEntryGenerator } from "@/features/accounting/auto-entry-generator";
import { makeVoucherTypeRepository } from "@/modules/voucher-types/presentation/server";
import { prisma } from "@/lib/prisma";
import { FiscalPeriodsReadAdapter } from "@/modules/accounting/infrastructure/fiscal-periods-read.adapter";
import { PrismaJournalEntriesReadAdapter } from "@/modules/accounting/infrastructure/prisma-journal-entries-read.adapter";
import { PrismaContactRepository } from "@/modules/contacts/infrastructure/prisma-contact.repository";
import {
  makeIvaBookService,
  makeIvaScopeFactory,
} from "@/modules/iva-books/presentation/composition-root";
import { LegacyAccountLookupAdapter } from "@/modules/org-settings/infrastructure/legacy-account-lookup.adapter";
import { makeOrgSettingsService } from "@/modules/org-settings/presentation/composition-root";
import { makeReceivablesRepository } from "@/modules/receivables/presentation/server";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";

import { SaleService } from "../application/sale.service";
import { LegacySalePermissionsAdapter } from "../infrastructure/legacy-sale-permissions.adapter";
import { PrismaIvaBookReaderAdapter } from "../infrastructure/prisma-iva-book-reader.adapter";
import { PrismaOrgSettingsReaderAdapter } from "../infrastructure/prisma-org-settings-reader.adapter";
import { PrismaSaleRepository } from "../infrastructure/prisma-sale.repository";
import { PrismaSaleUnitOfWork } from "../infrastructure/prisma-sale-unit-of-work";

/**
 * Composition root for the sale module (POC #11.0a A3 Ciclo 6) — single point
 * of wiring concrete adapters to `SaleService`. Mirror POC #10
 * `modules/accounting/presentation/composition-root.ts`. Único archivo bajo
 * `presentation/` autorizado a importar de `infrastructure/` (architecture.md
 * R4 carve-out).
 *
 * SaleService deps (10): 4 sale-hex own (`SaleRepository`, `OrgSettingsReader`,
 * `SalePermissions`, `SaleUnitOfWork`) + 1 IVA shim Reader (Prisma directo,
 * deps-level — el único IVA port read-only) + 5 reads/repos heredados
 * (`Contact`, `Receivable`, `AccountLookup`, `FiscalPeriodsRead`,
 * `JournalEntriesRead`).
 *
 * `journalEntryFactory` + `ivaBookRegenNotifier` + `ivaBookVoidCascade` ya NO
 * son deps de `SaleService` — viven en el `SaleScope` construido per-tx por
 * `PrismaSaleUnitOfWork` (E-6.a α Ciclo 6 lockeada Marco). El UoW recibe 4
 * cross-module deps en constructor (autoEntryGen, ivaBooksService,
 * journalEntriesReadPort, accountLookupPort) — Ciclo 4 D-2 c2 DI per-tx via
 * composition root.
 */

const repoLike: UnitOfWorkRepoLike = {
  transaction: (fn, options) => prisma.$transaction(fn, options),
};

// Legacy cross-module singletons — instanciados una sola vez. `accountsRepo`
// se reusa entre AutoEntryGenerator (in-tx code→id resolution) y
// LegacyAccountLookupAdapter (pre-tx id→code resolution) — D-4 lockeada Ciclo 4.
const accountsRepo = new PrismaAccountsRepo();
const voucherTypesRepo = makeVoucherTypeRepository();
const autoEntryGen = new AutoEntryGenerator(accountsRepo, voucherTypesRepo);
const journalEntriesReadAdapter = new PrismaJournalEntriesReadAdapter();
const accountLookupAdapter = new LegacyAccountLookupAdapter(accountsRepo);

/**
 * **POC #11.0c A4-c C2 GREEN cutover hex (P1 (b) + P4 (ii) + cycle-break
 * Opción α lockeada Marco)**: UoW recibe `() => makeIvaBookService()` (hex
 * factory wrap) en lugar de legacy singleton wrap. Memoización iva root
 * (P4 (ii)) garantiza single-instance contract intent Opción α —
 * invocaciones múltiples del factory retornan misma instance. `makeIvaScopeFactory()`
 * provee closure cross-module cerrando sobre prisma adapters iva-side; sale
 * infrastructure adapter recibe factory shape, NO importa concrete iva
 * adapters (§17 preservado).
 */
export function makeSaleService(): SaleService {
  return new SaleService({
    repo: new PrismaSaleRepository(),
    receivables: makeReceivablesRepository(),
    contacts: new PrismaContactRepository(),
    uow: new PrismaSaleUnitOfWork(
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
    salePermissions: new LegacySalePermissionsAdapter(),
    journalEntriesRead: journalEntriesReadAdapter,
  });
}
