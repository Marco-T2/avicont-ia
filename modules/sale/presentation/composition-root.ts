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
import { PrismaReceivablesRepository } from "@/modules/receivables/infrastructure/prisma-receivables.repository";
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
const accountsRepo = new AccountsRepository();
const voucherTypesRepo = new VoucherTypesRepository();
const autoEntryGen = new AutoEntryGenerator(accountsRepo, voucherTypesRepo);
const ivaBooksService = new IvaBooksService();
const journalEntriesReadAdapter = new LegacyJournalEntriesReadAdapter();
const accountLookupAdapter = new LegacyAccountLookupAdapter(accountsRepo);

export function makeSaleService(): SaleService {
  return new SaleService({
    repo: new PrismaSaleRepository(),
    receivables: new PrismaReceivablesRepository(),
    contacts: new PrismaContactRepository(),
    uow: new PrismaSaleUnitOfWork(
      repoLike,
      journalEntriesReadAdapter,
      accountLookupAdapter,
      autoEntryGen,
      () => ivaBooksService,
    ),
    accountLookup: accountLookupAdapter,
    orgSettings: new PrismaOrgSettingsReaderAdapter(makeOrgSettingsService()),
    fiscalPeriods: new FiscalPeriodsReadAdapter(),
    ivaBookReader: new PrismaIvaBookReaderAdapter(prisma),
    salePermissions: new LegacySalePermissionsAdapter(),
    journalEntriesRead: journalEntriesReadAdapter,
  });
}
