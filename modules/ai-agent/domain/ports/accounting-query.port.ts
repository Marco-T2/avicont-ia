/**
 * Umbrella read-side port for accounting Q&A on the chat agent (F2 — REQ-16).
 *
 * Six methods, one coherent domain (read-side accounting queries), wired
 * via a SINGLE adapter at the composition root (`AccountingQueryAdapter`).
 * Per design §10: this is a Marco-lock — a single umbrella port over six
 * per-service ports trades grain for composition-root simplicity (one adapter
 * to construct, one mock in handler tests).
 *
 * DTOs serialize MonetaryAmount via `roundHalfUp(...).toFixed(2)` at the
 * adapter boundary (REQ-18). All dates are ISO yyyy-mm-dd strings. The
 * JournalEntry DTO is TRIMMED — `lines[]` is dropped to keep the LLM
 * context cost bounded (design §10).
 *
 * Per-method status enums are inlined as string-literal unions rather than
 * importing module-specific value-object types — keeps the chat-agent
 * domain layer free of cross-module value-import coupling. Source of truth:
 *   modules/{sale,purchase,payment}/domain/value-objects/*-status.ts
 *   modules/payment/domain/value-objects/payment-direction.ts
 */

export interface JournalEntrySummaryDto {
  id: string;
  date: string; // ISO yyyy-mm-dd
  displayNumber: string;
  description: string;
  status: "DRAFT" | "POSTED" | "LOCKED" | "VOIDED";
  totalDebit: string; // roundHalfUp(...).toFixed(2)
  totalCredit: string;
}

export interface LedgerEntryDto {
  entryId: string;
  date: string;
  displayNumber: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
}

export interface SaleSummaryDto {
  id: string;
  date: string;
  sequenceNumber: number | null;
  status: "DRAFT" | "POSTED" | "LOCKED" | "VOIDED";
  contactId: string;
  description: string;
  totalAmount: string;
}

export interface PurchaseSummaryDto {
  id: string;
  date: string;
  sequenceNumber: number | null;
  status: "DRAFT" | "POSTED" | "LOCKED" | "VOIDED";
  purchaseType: "FLETE" | "POLLO_FAENADO" | "COMPRA_GENERAL" | "SERVICIO";
  contactId: string;
  description: string;
  totalAmount: string;
}

export interface PaymentSummaryDto {
  id: string;
  date: string;
  status: "DRAFT" | "POSTED" | "LOCKED" | "VOIDED";
  method: string;
  /** `null` when the payment has no allocations to derive a direction from. */
  direction: "COBRO" | "PAGO" | null;
  /** Falls back to `contactId` string when the payments service doesn't expose
   *  a denormalized counterparty name (Marco lock — design §10). */
  contactId: string;
  amount: string;
  description: string;
}

export interface AccountBalanceDto {
  accountId: string;
  /** Running balance via ledger last row. Empty ledger → `"0.00"` sentinel. */
  balance: string;
  /** ISO date of the last movement, or `null` when ledger is empty. */
  asOf: string | null;
}

export interface AccountingQueryPort {
  listRecentJournalEntries(
    orgId: string,
    limit: number,
  ): Promise<JournalEntrySummaryDto[]>;

  getAccountMovements(
    orgId: string,
    accountId: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<LedgerEntryDto[]>;

  getAccountBalance(
    orgId: string,
    accountId: string,
  ): Promise<AccountBalanceDto>;

  listSales(
    orgId: string,
    dateFrom?: string,
    dateTo?: string,
    limit?: number,
  ): Promise<SaleSummaryDto[]>;

  listPurchases(
    orgId: string,
    dateFrom?: string,
    dateTo?: string,
    limit?: number,
  ): Promise<PurchaseSummaryDto[]>;

  listPayments(
    orgId: string,
    dateFrom?: string,
    dateTo?: string,
    limit?: number,
  ): Promise<PaymentSummaryDto[]>;
}
