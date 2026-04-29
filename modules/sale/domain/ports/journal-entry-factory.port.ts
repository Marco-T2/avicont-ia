import type { Journal } from "@/modules/accounting/domain/journal.entity";

export interface SaleJournalLineTemplate {
  accountCode: string;
  side: "DEBIT" | "CREDIT";
  amount: number;
  contactId?: string;
  description?: string;
}

export interface SaleJournalTemplate {
  organizationId: string;
  contactId: string;
  date: Date;
  periodId: string;
  description: string;
  sourceType: "sale";
  sourceId: string;
  createdById: string;
  lines: SaleJournalLineTemplate[];
}

/**
 * Outbound factory port for journal entry generation from sale-hex use cases.
 *
 * **Outside `SaleScope`** (decisión §13 emergente Ciclo 5 lockeada por Marco,
 * Opción B-iii): the factory is not a CRUD repo — it is a service that
 * resolves voucher type + account codes + balance validation + persists a
 * POSTED `Journal` aggregate. The A3 adapter wraps the legacy
 * `AutoEntryGenerator.generate(tx, template)` and is instantiated per-tx by
 * the composition root inside the UoW callback (parity with scope-bound
 * repos). Tests inject an `InMemoryJournalEntryFactory` configured with
 * pre-built `Journal` aggregates.
 *
 * Sale-hex domain coupling justified: the return type `Journal` is a
 * cross-module domain entity (already imported by sale-hex via
 * `JournalEntriesRepository` in `SaleScope`). No infrastructure leak.
 */
export interface JournalEntryFactoryPort {
  generateForSale(template: SaleJournalTemplate): Promise<Journal>;
}
