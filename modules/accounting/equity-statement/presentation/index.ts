// Client-safe barrel for modules/accounting/equity-statement.
//
// D5 INVERSE — no client directive (not needed: this file exports only
// TYPE-only re-exports; all types are environment-neutral).
// Client directives are only required when the file declares a client bundle entry
// point for interactive components (state, event handlers, hooks) — this barrel has none.
// Does not contain the server-only import nor the client directive.
//
// Consumers:
// - Client components importing TYPES (EquityStatement, ColumnKey, RowKey, etc.)
// - API routes and RSC pages may also import from here if they only need types
// - test files asserting serialized statement shapes

// ── TYPE-only re-exports (safe in client bundle — no server-only code) ──
export type {
  EquityStatement,
  ColumnKey,
  RowKey,
  EquityCell,
  EquityRow,
  EquityColumn,
  EquityColumnTotals,
  BuildEquityStatementInput,
  EquityAccountMetadata,
  SerializedEquityCell,
  SerializedEquityRow,
  SerializedEquityStatement,
} from "../domain/equity-statement.types";
