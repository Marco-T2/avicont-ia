import "server-only";

import { DispatchService } from "../application/dispatch.service";
import { PrismaDispatchRepository } from "../infrastructure/prisma-dispatch.repository";
import { LegacyJournalEntryFactoryAdapter } from "../infrastructure/legacy-journal-entry-factory.adapter";
import { LegacyAccountBalancesAdapter } from "../infrastructure/legacy-account-balances.adapter";
import { LegacyOrgSettingsReaderAdapter } from "../infrastructure/legacy-org-settings-reader.adapter";
import { LegacyContactsAdapter } from "../infrastructure/legacy-contacts.adapter";
import { LegacyFiscalPeriodsAdapter } from "../infrastructure/legacy-fiscal-periods.adapter";
import { LegacyReceivablesAdapter } from "../infrastructure/legacy-receivables.adapter";
import { PrismaOperationalDocTypesRepository } from "@/modules/operational-doc-type/presentation/server";

/**
 * Composition root for the dispatch module (POC dispatch-hex).
 * Single point of wiring concrete adapters to DispatchService.
 * Mirror: modules/sale/presentation/composition-root.ts pattern.
 *
 * journal-physical-document Phase 6: LegacyJournalEntryFactoryAdapter now
 * takes OperationalDocTypesRepository in its constructor (R-D1 DI refactor)
 * so it can resolve the physical doc-type FK at JE creation.
 */
export function makeDispatchService(): DispatchService {
  return new DispatchService({
    repo: new PrismaDispatchRepository(),
    journalEntryFactory: new LegacyJournalEntryFactoryAdapter(
      new PrismaOperationalDocTypesRepository(),
    ),
    accountBalances: new LegacyAccountBalancesAdapter(),
    orgSettings: new LegacyOrgSettingsReaderAdapter(),
    contacts: new LegacyContactsAdapter(),
    fiscalPeriods: new LegacyFiscalPeriodsAdapter(),
    receivables: new LegacyReceivablesAdapter(),
  });
}
