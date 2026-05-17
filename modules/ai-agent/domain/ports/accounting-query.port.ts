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
  /** Raw counterparty id — kept for downstream consumers that need the link. */
  contactId: string;
  /**
   * Denormalized counterparty name (QA Fix #3 — resuelve drift detectado por
   * Marco: el sidebar QA mostraba UUID raw en lugar del nombre). Adapter
   * resolves via `ContactsService.getById`; cuando el lookup falla (contacto
   * borrado / sin nombre), fallback al `contactId` string para no romper la
   * query.
   */
  contactName: string;
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

/**
 * Compact account row returned by `findAccountsByName` / `listAccounts`.
 *
 * Inline string-literal union for `type` mirrors the per-method status enum
 * convention above — keeps the chat-agent domain free of cross-module value
 * imports. Source of truth: `enum AccountType` in `prisma/schema.prisma`
 * (ACTIVO / PASIVO / PATRIMONIO / INGRESO / GASTO).
 */
export interface AccountSummaryDto {
  accountId: string;
  code: string;
  name: string;
  type: "ACTIVO" | "PASIVO" | "PATRIMONIO" | "INGRESO" | "GASTO";
  /** `true` when the account is a leaf (postable) account. */
  isDetail: boolean;
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
    limit?: number,
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

  /**
   * Resolves nombre→accountId. Case-insensitive substring match against
   * `code` OR `name`. Default limit 10, adapter caps at 50.
   * Lets the LLM chain getAccountBalance/getAccountMovements when the user
   * mentions a cuenta por su nombre (no por CUID).
   */
  findAccountsByName(
    orgId: string,
    query: string,
    limit?: number,
  ): Promise<AccountSummaryDto[]>;

  /**
   * Lista cuentas con filtros opcionales. Default limit 20, max 50.
   * Útil para preguntas abiertas ("qué cajas tengo", "qué bancos hay").
   */
  listAccounts(
    orgId: string,
    type?: "ACTIVO" | "PASIVO" | "PATRIMONIO" | "INGRESO" | "GASTO",
    isDetail?: boolean,
    limit?: number,
  ): Promise<AccountSummaryDto[]>;
}
