/**
 * SettlementStatus — persisted settlement state of a JournalEntry's linked
 * receivable/payable (unified-comprobante-source-of-truth, D3).
 *
 * Shared mapping home for both repo sisters (prisma-receivables /
 * prisma-payables) so the CANCELLED/OVERDUE collapse can never drift between
 * them; the backfill SQL CASE mirrors this table textually.
 *
 * Mirrors the schema enum `SettlementStatus` (prisma/schema.prisma) as a pure
 * string union — no Prisma value-import in shared/domain. NOT the
 * `PaymentStatus` enum (Payment DOCUMENT lifecycle DRAFT|POSTED|LOCKED|VOIDED).
 */

export const SETTLEMENT_STATUSES = [
  "PENDING",
  "PARTIAL",
  "PAID",
  "VOIDED",
] as const;

export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

/**
 * Structural superset of ReceivableStatus and PayableStatus (both are this
 * exact union). Declared locally so shared/domain never imports upward from
 * feature modules; assignability is pinned type-level in the test file.
 */
type SourceDocumentStatus = SettlementStatus | "CANCELLED" | "OVERDUE";

const MAPPING: Record<SourceDocumentStatus, SettlementStatus> = {
  PENDING: "PENDING",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
  VOIDED: "VOIDED",
  CANCELLED: "VOIDED", // legacy pg-compat member — application writes VOIDED
  // REACHABLE from legacy data (Batch 3-POLISH L-2 — NOT unreachable): DEC-A
  // closed the write surface (zod status enums + ALLOWED tables +
  // persistence-boundary guard), so no NEW row can persist OVERDUE — but
  // scripts/lib/settlement-backfill-precedence.ts feeds statuses read RAW
  // from existing AR/AP rows into toSettlementStatus, so any surviving legacy
  // OVERDUE row hits this branch on every backfill/verify run. That is
  // exactly why this mapper stays TOTAL over the pg enum union. Overdue
  // semantics DO exist downstream: display derives ATRASADO (dueDate < now
  // over PENDING/PARTIAL) in the contact-ledger UI and PDF/XLSX exporters —
  // derived at read only.
  OVERDUE: "PENDING",
};

/**
 * Collapses a receivable/payable document status onto the persisted
 * settlement subset. Total over both source unions.
 */
export function toSettlementStatus(status: SourceDocumentStatus): SettlementStatus {
  return MAPPING[status];
}
