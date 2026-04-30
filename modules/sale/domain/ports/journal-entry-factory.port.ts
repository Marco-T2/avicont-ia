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
 * Purchase journal template — paridad simétrica de `SaleJournalTemplate`.
 * Distinción semántica vía `sourceType: "purchase"` literal.
 * `PurchaseJournalLineTemplate` reusa shape `SaleJournalLineTemplate`
 * (line-level no tiene asimetría purchase/sale). Port shared por sale-hex
 * (id: 1378 step 0 decision 1: heredar + extender).
 */
export type PurchaseJournalLineTemplate = SaleJournalLineTemplate;

export interface PurchaseJournalTemplate {
  organizationId: string;
  contactId: string;
  date: Date;
  periodId: string;
  description: string;
  sourceType: "purchase";
  sourceId: string;
  createdById: string;
  lines: PurchaseJournalLineTemplate[];
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
export interface RegenerateJournalResult {
  /** Old journal aggregate (POSTED) — passed to `accountBalances.applyVoid`. */
  old: Journal;
  /** New journal aggregate (POSTED, hydrated from DB) — passed to `accountBalances.applyPost`. */
  new: Journal;
}

export interface JournalEntryFactoryPort {
  generateForSale(template: SaleJournalTemplate): Promise<Journal>;

  /**
   * Espejo simétrico de `generateForSale` para purchase-hex use cases
   * (`post`, `createAndPost`). Adapter wraps `AutoEntryGenerator.generate`
   * con `voucherTypeCode: "CE"` (paridad legacy purchase.service.ts:460,
   * "Compra-Egreso"). Heredado + extendido aquí (sale/domain/ports) por
   * decisión step 0 A2 lockeada (id 1378). POC #11.0c evaluará si promote
   * a `accounting/domain/ports/` o ambos modules.
   */
  generateForPurchase(template: PurchaseJournalTemplate): Promise<Journal>;

  /**
   * Edit-flow counterpart to `generateForSale`. Encapsulates the
   * load-mutate-persist cycle for a sale's journal entry when sale's totals,
   * details, or header change. The A3 adapter:
   *
   *   1. Loads the old `Journal` (via internal `JournalEntriesReadPort`).
   *   2. Resolves code → id for the new lines (via internal AccountLookupPort).
   *   3. Mutates the aggregate (`update().replaceLines()`).
   *   4. Persists via `JournalEntriesRepository.update(journal, {replaceLines:true})`.
   *
   * Returns both `old` and `new` so the sale-hex use case can drive the
   * accountBalances cascade (`applyVoid(old)` then `applyPost(new)`) without
   * importing the accounting domain `Journal` aggregate, `LineSide`, or
   * `Money` VOs. Refactor §13 emergente Ciclo 6b — same philosophy as
   * generate (Ciclo 5b decision #1 Opción B): adapter encapsulates accounting
   * complexity; sale-hex stays clean.
   */
  regenerateForSaleEdit(
    oldJournalId: string,
    template: SaleJournalTemplate,
  ): Promise<RegenerateJournalResult>;
}
