// Barrel de exports públicos del módulo financial-statements (PR1)
// Se irá completando con cada PR

export { buildBalanceSheet } from "./balance-sheet.builder";
export { buildIncomeStatement } from "./income-statement.builder";
export { calculateRetainedEarnings } from "./retained-earnings.calculator";
export { resolveBalances } from "./balance-source.resolver";
export { roundHalfUp, sumDecimals, eq, serializeStatement } from "./money.utils";
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
