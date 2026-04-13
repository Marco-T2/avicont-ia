// Barrel de exports públicos del módulo financial-statements
// PR1: builders, calculator, resolver, money.utils, tipos
// PR2: service, repository, tipos de entrada

export { buildBalanceSheet } from "./balance-sheet.builder";
export { buildIncomeStatement } from "./income-statement.builder";
export { calculateRetainedEarnings } from "./retained-earnings.calculator";
export { resolveBalances } from "./balance-source.resolver";
export { roundHalfUp, sumDecimals, eq, serializeStatement } from "./money.utils";
export { FinancialStatementsService } from "./financial-statements.service";
export { FinancialStatementsRepository } from "./financial-statements.repository";
export type {
  BalanceSheet,
  BalanceSheetCurrent,
  IncomeStatement,
  IncomeStatementCurrent,
  SubtypeGroup,
  StatementLine,
  StatementPeriod,
  AccountMetadata,
  ResolvedBalance,
  BuildBalanceSheetInput,
  BuildISInput,
  MovementAggregation,
} from "./financial-statements.types";
export type {
  GenerateBalanceSheetInput,
  GenerateIncomeStatementInput,
} from "./financial-statements.service";
