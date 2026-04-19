// Barrel de exports públicos del módulo financial-statements
// PR1: builders, calculator, resolver, money.utils, tipos, date-presets utils
// PR2: service, repository, tipos de entrada

export { buildBalanceSheet } from "./balance-sheet.builder";
export { buildIncomeStatement } from "./income-statement.builder";
export { calculateRetainedEarnings } from "./retained-earnings.calculator";
export { resolveBalances } from "./balance-source.resolver";
export { roundHalfUp, sumDecimals, eq, serializeStatement } from "./money.utils";
export {
  resolveDatePreset,
  applyFilterPrecedence,
  generateBreakdownBuckets,
  resolveComparativePeriod,
  computeDiffPercent,
} from "./date-presets.utils";
export type { DateRange, ResolveDatePresetOptions, FilterPrecedenceInput, ResolvedFilterRange } from "./date-presets.utils";
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
  DatePresetId,
  BreakdownBy,
  CompareWith,
  StatementColumn,
  SemanticRowClass,
} from "./financial-statements.types";
export {
  buildBalanceSheetTableRows,
  buildIncomeStatementTableRows,
  buildRowId,
} from "./statement-table-rows.utils";
export type {
  StatementTableRow,
  SerializedBalanceSheetResponse,
  SerializedIncomeStatementResponse,
  SerializedColumn,
} from "./statement-table-rows.utils";
