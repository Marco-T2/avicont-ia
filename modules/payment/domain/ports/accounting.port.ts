/**
 * Account nature mirrors `Account.nature` from the accounting module — DEBIT
 * accounts (assets/expenses) accumulate on debit, CREDIT accounts on credit.
 * Carried in the entry line snapshot so the balances port can compute deltas
 * without a separate account lookup.
 */
export type AccountNature = "DEBIT" | "CREDIT";

export interface JournalEntryLineSnapshot {
  accountId: string;
  /** Numeric amount; zero when the line is on the opposite side. */
  debit: number;
  credit: number;
  contactId: string | null;
  accountNature: AccountNature;
}

/**
 * Snapshot of a journal entry as seen by the payment orchestrator. Carries
 * exactly what payment.service.ts needs to chain post → balances → linkage:
 *
 *   - id            (so the payment can be linked to the entry)
 *   - organizationId / periodId  (passed to balances upsert)
 *   - lines         (passed to balances apply/void)
 *
 * Defined locally so this port does not import from `features/accounting`.
 */
export interface JournalEntrySnapshot {
  id: string;
  organizationId: string;
  periodId: string;
  lines: JournalEntryLineSnapshot[];
}

export interface JournalEntryLineDraft {
  accountCode: string;
  side: "DEBIT" | "CREDIT";
  amount: number;
  contactId?: string;
  description?: string;
}

export interface GenerateEntryParams {
  organizationId: string;
  voucherTypeCode: string;
  contactId: string;
  date: Date;
  periodId: string;
  description: string;
  referenceNumber?: number;
  sourceType: string;
  sourceId: string;
  createdById: string;
  lines: JournalEntryLineDraft[];
}

export interface UpdateEntryParams {
  date?: Date;
  description?: string;
  contactId?: string;
  referenceNumber?: number;
}

export interface ResolvedEntryLine {
  accountId: string;
  debit: number;
  credit: number;
  contactId?: string;
  description?: string;
  order: number;
}

export interface AccountReference {
  id: string;
  code: string;
}

/**
 * Cross-feature port for the slice of `features/accounting/` the payment
 * module consumes. Wraps three legacy collaborators:
 *
 *   - AutoEntryGenerator.generate     → generateEntryTx
 *   - JournalRepository.findByIdForBalancesTx → findEntryByIdTx
 *   - JournalRepository.updateTx       → updateEntryTx
 *   - AccountsRepository.findByCode    → findAccountByCodeTx
 *
 * Voucher-types is consumed indirectly via AutoEntryGenerator — no separate
 * port (closed decision #4 of POC #8 plan).
 *
 * All methods are tx-aware: take `tx: unknown`, adapter casts internally.
 */
export interface AccountingPort {
  generateEntryTx(
    tx: unknown,
    params: GenerateEntryParams,
  ): Promise<JournalEntrySnapshot>;

  findEntryByIdTx(
    tx: unknown,
    organizationId: string,
    id: string,
  ): Promise<JournalEntrySnapshot | null>;

  /**
   * Marks the journal entry as VOIDED and returns the entry snapshot
   * (status not exposed in the snapshot — the orchestrator does not need
   * it after void; callers use the returned lines to drive balance
   * reversal).
   */
  voidEntryTx(
    tx: unknown,
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<JournalEntrySnapshot>;

  /**
   * Replaces metadata + lines on an existing entry. Returns the updated
   * entry snapshot suitable for re-applying balances.
   */
  updateEntryTx(
    tx: unknown,
    organizationId: string,
    id: string,
    data: UpdateEntryParams,
    lines: ResolvedEntryLine[],
    userId: string,
  ): Promise<JournalEntrySnapshot>;

  /**
   * Resolves a chart-of-accounts code to {id, code} inside the tx. Used by
   * `applyCreditToInvoice` to look up the CxC account before stitching new
   * lines into an existing journal entry.
   */
  findAccountByCodeTx(
    tx: unknown,
    organizationId: string,
    code: string,
  ): Promise<AccountReference | null>;
}
