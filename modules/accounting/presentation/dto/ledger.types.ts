/**
 * Canonical hex DTO — ledger/trial-balance types (§13.X).
 *
 * Monetary fields serialize as `string` at the JSON boundary
 * (poc-money-math-decimal-convergence — OLEADA 7 POC #2). Service-side
 * arithmetic uses `Prisma.Decimal` internally; `.toFixed(2)` is the
 * serialization point. Consumers parse via `Number()` / `parseFloat()` at
 * display time (UI), preserving wire precision.
 */
import type { AccountType } from "@/generated/prisma/client";

// ── Ledger types ──

export interface LedgerEntry {
  date: Date;
  entryNumber: number;
  description: string;
  debit: string;
  credit: string;
  balance: string;
}

/**
 * Paginated ledger DTO at the API/service boundary.
 *
 * Architectural distinction vs `LedgerPageResult` (port):
 *   - `LedgerPageResult` — port contract, monetary fields raw (`unknown`
 *     to abstract Prisma.Decimal), `items: LedgerLineRow[]`.
 *   - `LedgerPaginatedDto` — DTO at API boundary, monetary fields `string`
 *     (serialized via roundHalfUp+toFixed(2)), `items: LedgerEntry[]`.
 *
 * Same separation as LedgerLineRow (port) vs LedgerEntry (DTO) precedent.
 * Cumulative-state DTO 1st evidence (§13 NEW candidate).
 */
export interface LedgerPaginatedDto {
  items: LedgerEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Opening balance for this page (sum of all debit-credit BEFORE the
   *  current page window), serialized as string via roundHalfUp+toFixed(2).
   *  Page 1 → "0.00". UI banner row hidden when openingBalance === "0.00". */
  openingBalance: string;
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  totalDebit: string;
  totalCredit: string;
  balance: string;
}

export interface DateRangeFilter {
  dateFrom?: Date;
  dateTo?: Date;
}
