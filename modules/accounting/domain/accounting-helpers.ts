// Domain-owned status mirrors — receivables/payables each own their status VO
// (canonical, with transition rules); accounting only needs the type vocabulary.
import type { ReceivableStatus } from "@/modules/receivables/domain/value-objects/receivable-status";
import type { PayableStatus } from "@/modules/payables/domain/value-objects/payable-status";

export function computeReceivableStatus(
  paid: number,
  balance: number,
): ReceivableStatus {
  if (balance <= 0 && paid > 0) return "PAID";
  if (balance > 0 && paid > 0) return "PARTIAL";
  return "PENDING";
}

export function computePayableStatus(
  paid: number,
  balance: number,
): PayableStatus {
  if (balance <= 0 && paid > 0) return "PAID";
  if (balance > 0 && paid > 0) return "PARTIAL";
  return "PENDING";
}
