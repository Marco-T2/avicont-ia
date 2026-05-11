/**
 * Outbound factory port for journal entry generation from dispatch-hex use cases.
 *
 * Mirror: modules/sale/domain/ports/journal-entry-factory.port.ts pattern.
 * Adapter wraps legacy `AutoEntryGenerator.generate(tx, template)` from
 * features/accounting — TEMPORARY bridge until accounting migrates to hex.
 *
 * R5 preserved: domain layer ZERO Prisma imports. The adapter (infrastructure)
 * handles all Prisma interaction.
 */

export interface DispatchJournalLineTemplate {
  accountCode: string;
  side: "DEBIT" | "CREDIT";
  amount: number;
  contactId?: string;
  description?: string;
}

export interface DispatchJournalTemplate {
  organizationId: string;
  contactId: string;
  date: Date;
  periodId: string;
  description: string;
  sourceType: "dispatch";
  sourceId: string;
  createdById: string;
  lines: DispatchJournalLineTemplate[];
}

export interface DispatchRegenerateJournalResult {
  /** Old journal ID — for applyVoid cascade. */
  oldJournalId: string;
  /** New journal ID — for applyPost cascade. */
  newJournalId: string;
}

export interface DispatchJournalEntryFactoryPort {
  /**
   * Generates a POSTED journal entry for a dispatch.
   * Returns the journal entry ID.
   */
  generateForDispatch(
    template: DispatchJournalTemplate,
  ): Promise<string>;

  /**
   * Edit-flow: regenerate journal for a posted dispatch edit.
   * Load old, mutate, persist, return both IDs for balance cascade.
   */
  regenerateForDispatchEdit(
    oldJournalId: string,
    template: DispatchJournalTemplate,
  ): Promise<DispatchRegenerateJournalResult>;
}
