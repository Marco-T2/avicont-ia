import { InvalidPayableStatus } from "../errors/payable-errors";

export const PAYABLE_STATUSES = [
  "PENDING",
  "PARTIAL",
  "PAID",
  "VOIDED",
  "OVERDUE",
  "CANCELLED",
] as const;

export type PayableStatus = typeof PAYABLE_STATUSES[number];

const ALLOWED: Record<PayableStatus, readonly PayableStatus[]> = {
  PENDING: ["PARTIAL", "PAID", "VOIDED"],
  PARTIAL: ["PAID", "VOIDED"],
  // Unreachable since DEC-A (write surface rejects OVERDUE); no exits, mirrors
  // CANCELLED. Key stays while OVERDUE remains in the pg enum union.
  OVERDUE: [],
  PAID: [],
  VOIDED: [],
  CANCELLED: [],
};

export function parsePayableStatus(value: string): PayableStatus {
  if ((PAYABLE_STATUSES as readonly string[]).includes(value)) {
    return value as PayableStatus;
  }
  throw new InvalidPayableStatus(value);
}

export function canTransition(from: PayableStatus, to: PayableStatus): boolean {
  return ALLOWED[from].includes(to);
}
