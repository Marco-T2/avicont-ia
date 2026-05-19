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
  /**
   * Denormalized doc-type code for glosa-builder LOOKUP-B (REQ-GE-5; design D7).
   * "ND" for NOTA_DESPACHO, "BC" for BOLETA_CERRADA. Required by the glosa
   * builder via AccountsReceivable.sourceTypeCode. Optional in this port for
   * additive compatibility while callers migrate.
   */
  sourceTypeCode?: string | null;
  journalEntryId: string;
}

export interface DispatchReceivablesPort {
  /** Creates a receivable within the current transaction. */
  createTx(input: CreateReceivableInput): Promise<string>;

  /** Voids a receivable within the current transaction. */
  voidTx(organizationId: string, receivableId: string): Promise<void>;
}
