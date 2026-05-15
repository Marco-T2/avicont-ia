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
