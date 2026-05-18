import "server-only";

import { PrismaAccountsRepo } from "@/modules/accounting/infrastructure/prisma-accounts.repo";
import { AutoEntryGenerator } from "@/modules/accounting/application/auto-entry-generator";
import { makeVoucherTypeRepository } from "@/modules/voucher-types/presentation/server";
import { prisma } from "@/lib/prisma";
import { FiscalPeriodsReadAdapter } from "@/modules/accounting/infrastructure/fiscal-periods-read.adapter";
import { PrismaJournalEntriesReadAdapter } from "@/modules/accounting/infrastructure/prisma-journal-entries-read.adapter";
import { PrismaContactRepository } from "@/modules/contacts/infrastructure/prisma-contact.repository";
import { LegacyAccountLookupAdapter } from "@/modules/org-settings/infrastructure/legacy-account-lookup.adapter";
import { makeOrgSettingsService } from "@/modules/org-settings/presentation/composition-root";
import { PrismaOperationalDocTypesRepository } from "@/modules/operational-doc-type/presentation/server";
import { makeReceivablesRepository } from "@/modules/receivables/presentation/server";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";

import { SaleService } from "../application/sale.service";
import { LegacySalePermissionsAdapter } from "../infrastructure/legacy-sale-permissions.adapter";
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
 * IVA book reader + IVA service/scope factories retired in
 * lcv-feature-retirement (RND 102100000011 Dec-2021). SaleService deps reduced
 * from 10 to 8: removed `ivaBookReader` + UoW factories
 * (`makeIvaBookService`, `makeIvaScopeFactory`).
 *
 * `journalEntryFactory` + IVA cascade ports ya NO son deps de `SaleService`
 * — viven en el `SaleScope` construido per-tx por `PrismaSaleUnitOfWork`
 * (E-6.a α Ciclo 6 lockeada Marco). El UoW recibe 4 cross-module deps en
 * constructor (autoEntryGen, journalEntriesReadPort, accountLookupPort) —
 * Ciclo 4 D-2 c2 DI per-tx via composition root.
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
// journal-physical-document Phase 6 — OperationalDocType lookup repo,
// injected into the sale UoW so the per-tx PrismaJournalEntryFactoryAdapter
// resolves VG / FL / PF / CG / SV via findByCode at JE creation.
const operationalDocTypesRepo = new PrismaOperationalDocTypesRepository();

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
      operationalDocTypesRepo,
    ),
    accountLookup: accountLookupAdapter,
    orgSettings: new PrismaOrgSettingsReaderAdapter(makeOrgSettingsService()),
    fiscalPeriods: new FiscalPeriodsReadAdapter(),
    salePermissions: new LegacySalePermissionsAdapter(),
    journalEntriesRead: journalEntriesReadAdapter,
  });
}
