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
  OVERDUE: "PENDING", // read-derived (dueDate < now), never persisted — defensive totality
};

/**
 * Collapses a receivable/payable document status onto the persisted
 * settlement subset. Total over both source unions.
 */
export function toSettlementStatus(status: SourceDocumentStatus): SettlementStatus {
  return MAPPING[status];
}
