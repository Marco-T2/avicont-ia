import type { ReceivableStatus, PayableStatus } from "@/generated/prisma/client";

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
