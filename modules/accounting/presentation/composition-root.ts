import "server-only";

import { prisma } from "@/lib/prisma";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";

import { AccountingDashboardService } from "../application/dashboard.service";
import { JournalsService } from "../application/journals.service";
import { LedgerService } from "../application/ledger.service";
import { makeFinancialStatementsService } from "../financial-statements/presentation/server";
import { ContactsReadAdapter } from "../infrastructure/contacts-read.adapter";
import { FiscalPeriodsReadAdapter } from "../infrastructure/fiscal-periods-read.adapter";
import { LegacyAccountsReadAdapter } from "../infrastructure/legacy-accounts-read.adapter";
import { PrismaJournalEntriesReadAdapter } from "../infrastructure/prisma-journal-entries-read.adapter";
import { PrismaJournalLedgerQueryAdapter } from "../infrastructure/prisma-journal-ledger-query.adapter";
import { LegacyPermissionsAdapter } from "../infrastructure/legacy-permissions.adapter";
import { PrismaAccountingUnitOfWork } from "../infrastructure/prisma-accounting-unit-of-work";
import { VoucherTypesReadAdapter } from "../infrastructure/voucher-types-read.adapter";
import { AccountsService } from "../application/accounts.service";
import { PrismaAccountsRepo } from "../infrastructure/prisma-accounts.repo";
import { AccountBalancesService } from "@/modules/account-balances/application/account-balances.service";
import { makeOrgProfileService } from "@/modules/org-profile/presentation/server";
import { makeDocumentSignatureConfigService } from "@/modules/document-signature-config/presentation/server";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";

/**
 * Composition root for the accounting module — the single place where
 * concrete adapters are wired to JournalsService. The only file under
 * presentation/ allowed to import from infrastructure/ (architecture.md
 * R4 carve-out at L455).
 */

const repoLike: UnitOfWorkRepoLike = {
  transaction: (fn, options) => prisma.$transaction(fn, options),
};

export function makeJournalsService(): JournalsService {
  return new JournalsService(
    new PrismaAccountingUnitOfWork(repoLike),
    new LegacyAccountsReadAdapter(),
    new ContactsReadAdapter(),
    new FiscalPeriodsReadAdapter(),
    new VoucherTypesReadAdapter(),
    new LegacyPermissionsAdapter(),
    new PrismaJournalEntriesReadAdapter(),
    new PrismaJournalLedgerQueryAdapter(),
    // C3 — exportVoucherPdf use case deps. Injected as concrete services
    // (not ports) mirroring legacy `journal.service.ts:67-87` — the voucher
    // PDF is a reporting path, no new ports per the resolved open question.
    makeOrgProfileService(),
    makeDocumentSignatureConfigService(),
    makeFiscalPeriodsService(),
  );
}

/**
 * Factory for LedgerService — wires the journal-ledger query adapter +
 * accounts repo + account-balances service. POC #7 OLEADA 6 C1: LedgerService
 * folded onto the hex (zero hex equivalent pre-C1). R4 carve-out: this file
 * is the ONLY legitimate presentation/ → infrastructure/ import.
 */
export function makeLedgerService(): LedgerService {
  return new LedgerService(
    new PrismaJournalLedgerQueryAdapter(),
    new PrismaAccountsRepo(),
    new AccountBalancesService(),
  );
}

/**
 * Factory for AccountsService — wires PrismaAccountsRepo + prisma client.
 * Mirrors makePaymentsService() pattern: no-args, all deps resolved here.
 * R4 carve-out: this file is the ONLY legitimate presentation/ → infrastructure/ import.
 * DRIFT-2 vs spec REQ-10: no-args (not Partial<deps>?) — simpler, mirrors makePaymentsService exactly.
 */
export function makeAccountsService(): AccountsService {
  return new AccountsService({
    repo: new PrismaAccountsRepo(),
    prisma,
  });
}

/**
 * Factory for AccountingDashboardService — composes JournalsService,
 * LedgerService, and FiscalPeriodsService into a single read-model
 * orchestrator consumed by the accounting hub page. No new infra
 * adapters; this factory wires already-composed services to keep the
 * R4 carve-out surface minimal.
 */
export function makeAccountingDashboardService(): AccountingDashboardService {
  return new AccountingDashboardService(
    makeJournalsService(),
    makeLedgerService(),
    makeFiscalPeriodsService(),
    makeFinancialStatementsService(),
  );
}
