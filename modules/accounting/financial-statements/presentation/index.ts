// Client-safe barrel for modules/accounting/financial-statements.
//
// D5 INVERSE — no client directive (not needed: this file exports only
// TYPE-only re-exports + pure runtime helpers over already-serialized data).
// Client directives are only required when the file declares a client bundle entry
// point for interactive components (state, event handlers, hooks) — this barrel has none.
//
// BOUNDARY INVARIANT: this barrel MUST NOT re-export anything that transitively
// imports `@/generated/prisma/client` (drags `node:module` into the client chunk).
// `serializeStatement` was REMOVED from here — it does `instanceof Prisma.Decimal`
// at runtime, so it is server-only and lives in `./server` only. The previous
// "environment-neutral" claim was incorrect: it needs the Prisma.Decimal runtime.
// Guard: __tests__/client-safe-barrel-shape.poc-financial-statements-hex.test.ts
//
// Consumers:
// - Client components importing TYPES (BalanceSheet, IncomeStatement, etc.)
// - Client page components importing the pure table-row builders
// - API routes and RSC pages may also import from here if they only need types

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
