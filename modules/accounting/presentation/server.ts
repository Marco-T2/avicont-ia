import "server-only";

export { JournalsService } from "../application/journals.service";
export type { AuditUserContext } from "../application/journals.service";
export { makeJournalsService } from "./composition-root";

// ── Ledger hex service (POC #7 OLEADA 6 C1) ──
export { LedgerService } from "../application/ledger.service";
export { makeLedgerService } from "./composition-root";

// ── Ledger + contact-ledger exporters — [EXPORT] cluster paydown ──
// PDF/XLSX generation now goes through LedgerService.exportLedgerPdf/exportLedgerXlsx/
// exportContactLedgerPdf/exportContactLedgerXlsx (injected LedgerExporterPort /
// ContactLedgerExporterPort, wired in composition-root.ts). This barrel no longer
// re-exports the raw exporter functions or their option types (that re-export was
// the R4 violation this paydown fixes) — route.ts calls the service methods instead.

// ── Accounts hex service (POC #3c) ──
export { AccountsService } from "../application/accounts.service";
export type { AccountsServiceDeps } from "../application/accounts.service";
export { makeAccountsService } from "./composition-root";

// ── Dashboard composition (accounting-dashboard-pro) ──
export { AccountingDashboardService } from "../application/dashboard.service";
export { makeAccountingDashboardService } from "./composition-root";
export type * from "../domain/journal.types";
export type * from "../domain/accounts.types";
export type * from "../domain/ledger.types";

// ── Validation schemas (POC #8 OLEADA 6 C1 — journal/ledger + account zod schemas) ──
// Surfaced here so app/ consumers import from a single hex barrel
// (`@/modules/accounting/presentation/server`) rather than reaching into
// `features/accounting/server` or the bare `./validation` sub-path.
export * from "./validation";

// ── Domain utils ──
export * from "../domain/account-code.utils";
export * from "../domain/accounting-helpers";
export * from "../domain/journal.dates";
export * from "../domain/account-subtype.utils";
export * from "../domain/account-subtype.resolve";

// ── Domain UI helpers ──
export * from "../domain/journal.ui";
