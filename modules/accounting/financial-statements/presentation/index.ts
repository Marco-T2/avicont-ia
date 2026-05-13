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

// ── TYPE-only re-exports (safe in client bundle — no server-only code) ──
export type {
  BalanceSheet,
  IncomeStatement,
  StatementColumn,
  DatePresetId,
  BreakdownBy,
  CompareWith,
} from "../domain/types/financial-statements.types";

export type {
  StatementTableRow,
  SerializedColumn,
} from "../domain/value-objects/statement-table-rows.utils";
