import "server-only";
import { PrismaFinancialStatementsRepo } from "@/modules/accounting/financial-statements/infrastructure/prisma-financial-statements.repo";
import type { IncomeStatementSourcePort } from "../application/income-statement-source.port";
import type { AccountMetadata, MovementAggregation } from "@/modules/accounting/financial-statements/domain/types/financial-statements.types";

/**
 * Thin adapter: delegates to PrismaFinancialStatementsRepo for the 2 methods
 * consumed by EquityStatementService to derive the income statement (REQ-4 / D9).
 *
 * REQ-004 ONE-LOCATION invariant: PrismaFinancialStatementsRepo lives at
 * modules/accounting/financial-statements/infrastructure/ (FS canonical home).
 * This adapter wraps it — does NOT re-implement the queries.
 *
 * INFRA→INFRA cross-module dep: this file imports PrismaFinancialStatementsRepo
 * from FS infrastructure. This is a TOLERATED infra-to-infra cross-module import
 * (different from D7 — this is application-concern infra, not pdf-rendering infra).
 * Flagged for potential consolidation at sub-POC 6 evaluation.
 *
 * REQ-012: implements IncomeStatementSourcePort (application/income-statement-source.port.ts).
 * Single canonical location — thin delegation only, no logic, no transformation.
 */
export class PrismaIncomeStatementSourceAdapter implements IncomeStatementSourcePort {
  private readonly fsRepo = new PrismaFinancialStatementsRepo();

  findAccountsWithSubtype(orgId: string): Promise<AccountMetadata[]> {
    return this.fsRepo.findAccountsWithSubtype(orgId);
  }

  aggregateJournalLinesInRange(
    orgId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<MovementAggregation[]> {
    return this.fsRepo.aggregateJournalLinesInRange(orgId, dateFrom, dateTo);
  }
}
