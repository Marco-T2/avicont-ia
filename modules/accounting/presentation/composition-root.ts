import "server-only";

import { prisma } from "@/lib/prisma";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";

import { JournalsService } from "../application/journals.service";
import { ContactsReadAdapter } from "../infrastructure/contacts-read.adapter";
import { FiscalPeriodsReadAdapter } from "../infrastructure/fiscal-periods-read.adapter";
import { LegacyAccountsReadAdapter } from "../infrastructure/legacy-accounts-read.adapter";
import { PrismaJournalEntriesReadAdapter } from "../infrastructure/prisma-journal-entries-read.adapter";
import { LegacyPermissionsAdapter } from "../infrastructure/legacy-permissions.adapter";
import { PrismaAccountingUnitOfWork } from "../infrastructure/prisma-accounting-unit-of-work";
import { VoucherTypesReadAdapter } from "../infrastructure/voucher-types-read.adapter";
import { AccountsService } from "../application/accounts.service";
import { PrismaAccountsRepo } from "../infrastructure/prisma-accounts.repo";

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
