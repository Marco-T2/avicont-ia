import type {
  AccountMetadata,
  MovementAggregation,
} from "@/modules/accounting/financial-statements/domain/types/financial-statements.types";

/**
 * Application-layer port abstracting the income statement computation
 * infrastructure. Returns RAW FS-repo data; the equity-statement application
 * service calls buildIncomeStatement + calculateRetainedEarnings (FS domain
 * pure functions) directly on this data (D10 — DOMAIN→DOMAIN cross-module
 * tolerated at application layer).
 *
 * Return types re-use FS domain types (AccountMetadata, MovementAggregation)
 * via cross-module DOMAIN→DOMAIN import — tolerated per D10.
 * No duplication of FS domain type definitions.
 *
 * REQ-012: adapter at infrastructure/prisma-income-statement-source.adapter.ts
 * wraps PrismaFinancialStatementsRepo — thin delegation only.
 *
 * Method names are pinned to exact PrismaFinancialStatementsRepo signatures
 * (lines 66 + 146 — verified at spec-time): no wrapping, no rename.
 */
export interface IncomeStatementSourcePort {
  findAccountsWithSubtype(orgId: string): Promise<AccountMetadata[]>;

  aggregateJournalLinesInRange(
    orgId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<MovementAggregation[]>;
}
