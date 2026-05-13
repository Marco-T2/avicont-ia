// Client-safe barrel for modules/accounting/worksheet.
//
// D5 INVERSE — no client directive (not needed: this file exports only
// TYPE-only re-exports; all types are environment-neutral).
// Client directives are only required when the file declares a client bundle entry
// point for interactive components (state, event handlers, hooks) — this barrel has none.
// Does not contain the server-only import nor the client directive.
//
// Consumers:
// - Client components importing TYPES (WorksheetReport, WorksheetFilters, etc.)
// - API routes and RSC pages may also import from here if they only need types
// - Test files asserting report shapes

// ── TYPE-only re-exports (safe in client bundle — no server-only code) ──
export type {
  WorksheetReport,
  WorksheetFilters,
  WorksheetRow,
  WorksheetTotals,
  WorksheetGroup,
} from "../domain/worksheet.types";
