// Client-safe barrel for modules/accounting/financial-statements.
//
// D5 INVERSE — no client directive (not needed: this file exports only
// TYPE-only re-exports + one environment-neutral runtime function).
// Client directives are only required when the file declares a client bundle entry
// point for interactive components (state, event handlers, hooks) — this barrel has none.
//
// Consumers:
// - Client components importing TYPES (BalanceSheet, IncomeStatement, etc.)
// - Any environment that needs serializeStatement (environment-neutral pure function)
// - API routes and RSC pages may also import from here if they only need types

// ── Environment-neutral runtime ──
export { serializeStatement } from "../domain/money.utils";

// ── Client-safe RUNTIME helpers (pure functions over serialized statements) ──
// C4 surface extension — symmetric with old features/.../statement-table-rows.utils
// consumer surface. Used by 2 page-client components (client-directive bundles)
// to transform server-fetched serialized statements into TanStack table rows.
export {
  buildBalanceSheetTableRows,
  buildIncomeStatementTableRows,
} from "../domain/value-objects/statement-table-rows.utils";

// ── TYPE-only re-exports (safe in client bundle — no server-only code) ──
export type {
  BalanceSheet,
  BalanceSheetCurrent,
  IncomeStatement,
  IncomeStatementCurrent,
  StatementColumn,
  DatePresetId,
  BreakdownBy,
  CompareWith,
  SubtypeGroup,
} from "../domain/types/financial-statements.types";

export type {
  StatementTableRow,
  SerializedColumn,
  SerializedBalanceSheetResponse,
  SerializedIncomeStatementResponse,
} from "../domain/value-objects/statement-table-rows.utils";
