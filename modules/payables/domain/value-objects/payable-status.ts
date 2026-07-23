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
  // Entry closed, exit OPEN (DEC-A, Batch 3-FIX): OVERDUE is not reachable as
  // a transition TARGET — no row can newly enter it — but the exits are
  // deliberately retained so a pre-existing legacy row can drain to
  // PARTIAL/PAID/VOIDED; `[]` would wall it in (unvoidable, unpayable) and
  // roll back any purchase void that touches it. Key stays while OVERDUE
  // remains in the pg enum union.
  OVERDUE: ["PARTIAL", "PAID", "VOIDED"],
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
