import "server-only";

export { JournalRepository } from "./journal.repository";
export { JournalService } from "./journal.service";
export type * from "./journal.types";
export { parseEntryDate } from "./journal.dates";

export { LedgerService } from "./ledger.service";

export { AutoEntryGenerator } from "@/modules/accounting/application/auto-entry-generator";
export type { EntryLineTemplate } from "@/modules/accounting/application/auto-entry-generator";

export {
  computeReceivableStatus,
  computePayableStatus,
} from "./accounting-helpers";

export {
  validateTransition,
  validateEditable,
  validateDraftOnly,
  validateLockedEdit,
  validatePeriodOpen,
} from "@/modules/accounting/domain/document-lifecycle";
export type {
  DocumentStatus,
  TrimPreviewItem,
} from "@/modules/accounting/domain/document-lifecycle";

export * from "./accounting.validation";
export * from "./correlative.utils";
