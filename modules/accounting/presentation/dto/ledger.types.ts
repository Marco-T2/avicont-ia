/** Canonical hex DTO — ledger/trial-balance types (§13.X). */
import type { AccountType } from "@/generated/prisma/client";

// ── Ledger types ──

export interface LedgerEntry {
  date: Date;
  entryNumber: number;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

export interface DateRangeFilter {
  dateFrom?: Date;
  dateTo?: Date;
}
