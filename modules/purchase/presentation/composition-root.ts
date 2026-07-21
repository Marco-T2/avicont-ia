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
import { makePayablesRepository } from "@/modules/payables/presentation/server";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";

import type { PurchaseContactReaderPort } from "../domain/ports/purchase-contact-reader.port";
import type { PurchasePayableReaderPort } from "../domain/ports/purchase-payable-reader.port";
import { PurchaseService } from "../application/purchase.service";
import { LegacyPurchasePermissionsAdapter } from "../infrastructure/legacy-purchase-permissions.adapter";
import { PrismaOrgSettingsReaderAdapter } from "../infrastructure/prisma-org-settings-reader.adapter";
import { PrismaPurchaseContactReaderAdapter } from "../infrastructure/prisma-purchase-contact-reader.adapter";
import { PrismaPurchasePayableReaderAdapter } from "../infrastructure/prisma-purchase-payable-reader.adapter";
import { PrismaPurchaseRepository } from "../infrastructure/prisma-purchase.repository";
import { PrismaPurchaseUnitOfWork } from "../infrastructure/prisma-purchase-unit-of-work";

/**
 * Composition root for the purchase module (POC #11.0b A3 Ciclo 6b) — single
 * point of wiring concrete adapters to `PurchaseService`. Mirror sale C6
 * `modules/sale/presentation/composition-root.ts` byte-equivalent salvo
 * asimetrías declaradas: `payables` ↔ `receivables`, `purchasePermissions`
 * ↔ `salePermissions`. Único archivo bajo `presentation/` autorizado a
 * importar de `infrastructure/` (architecture.md R4 carve-out).
 *
 * IVA book reader + IVA service/scope factories retired in
 * lcv-feature-retirement (RND 102100000011 Dec-2021). PurchaseService deps
 * reduced: removed `ivaBookReader` + UoW factories
 * (`makeIvaBookService`, `makeIvaScopeFactory`). Mirror simétrico sale comp-root.
 *
 * `makeOrgSettingsService()` cross-module reuse (presentation → presentation
 * factory) NO viola R4.
 */

const repoLike: UnitOfWorkRepoLike = {
  transaction: (fn, options) => prisma.$transaction(fn, options),
};

// Legacy cross-module singletons — instanciados una sola vez. `accountsRepo`
// se reusa entre AutoEntryGenerator (in-tx code→id resolution) y
// LegacyAccountLookupAdapter (pre-tx id→code resolution) — D-4 lockeada
// Ciclo 4 sale.
const accountsRepo = new PrismaAccountsRepo();
const voucherTypesRepo = makeVoucherTypeRepository();
const autoEntryGen = new AutoEntryGenerator(accountsRepo, voucherTypesRepo);
const journalEntriesReadAdapter = new PrismaJournalEntriesReadAdapter();
const accountLookupAdapter = new LegacyAccountLookupAdapter(accountsRepo);
// journal-physical-document Phase 6 — OperationalDocType lookup repo for the
// purchase UoW factory wiring (resolves FL|PF|CG|SV via findByCode).
const operationalDocTypesRepo = new PrismaOperationalDocTypesRepository();

/**
 * Read facade for purchase detail page external deps (purchase-pure-read —
 * mirror sale-pure-read pilot) — groups the tenant-scoped read ports the page
 * consumes instead of querying Prisma directly. Wiring lives here (único
 * archivo bajo `presentation/` autorizado a importar de `infrastructure/` —
 * architecture.md R4 carve-out).
 */
export interface PurchaseReads {
  contact: PurchaseContactReaderPort;
  payable: PurchasePayableReaderPort;
}

export function makePurchaseReads(): PurchaseReads {
  return {
    contact: new PrismaPurchaseContactReaderAdapter(),
    payable: new PrismaPurchasePayableReaderAdapter(),
  };
}

export function makePurchaseService(): PurchaseService {
  return new PurchaseService({
    repo: new PrismaPurchaseRepository(),
    payables: makePayablesRepository(),
    contacts: new PrismaContactRepository(),
    uow: new PrismaPurchaseUnitOfWork(
      repoLike,
      journalEntriesReadAdapter,
      accountLookupAdapter,
      autoEntryGen,
      operationalDocTypesRepo,
    ),
    accountLookup: accountLookupAdapter,
    orgSettings: new PrismaOrgSettingsReaderAdapter(makeOrgSettingsService()),
    fiscalPeriods: new FiscalPeriodsReadAdapter(),
    purchasePermissions: new LegacyPurchasePermissionsAdapter(),
    journalEntriesRead: journalEntriesReadAdapter,
  });
}
