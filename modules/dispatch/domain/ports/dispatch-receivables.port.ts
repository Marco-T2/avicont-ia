/**
 * Outbound port for receivable operations from dispatch-hex use cases.
 * Adapter wraps legacy PrismaReceivablesRepository — TEMPORARY bridge.
 */
export interface CreateReceivableInput {
  organizationId: string;
  contactId: string;
  description: string;
  amount: number;
  dueDate: Date;
  sourceType: "dispatch";
  sourceId: string;
  journalEntryId: string;
}

export interface DispatchReceivablesPort {
  /** Creates a receivable within the current transaction. */
  createTx(input: CreateReceivableInput): Promise<string>;

  /** Voids a receivable within the current transaction. */
  voidTx(organizationId: string, receivableId: string): Promise<void>;
}
