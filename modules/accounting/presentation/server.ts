import "server-only";

export { JournalsService } from "../application/journals.service";
export type { AuditUserContext } from "../application/journals.service";
export { makeJournalsService } from "./composition-root";

// ── Ledger hex service (POC #7 OLEADA 6 C1) ──
export { LedgerService } from "../application/ledger.service";
export { makeLedgerService } from "./composition-root";

// ── Accounts hex service (POC #3c) ──
export { AccountsService } from "../application/accounts.service";
export type { AccountsServiceDeps } from "../application/accounts.service";
export { makeAccountsService } from "./composition-root";
export type * from "./dto/journal.types";
export type * from "./dto/accounts.types";
export type * from "./dto/ledger.types";

// ── Domain utils ──
export * from "../domain/account-code.utils";
export * from "../domain/correlative.utils";
export * from "../domain/accounting-helpers";
export * from "../domain/journal.dates";
export * from "../domain/account-subtype.utils";
export * from "../domain/account-subtype.resolve";

// ── Domain UI helpers ──
export * from "../domain/journal.ui";
