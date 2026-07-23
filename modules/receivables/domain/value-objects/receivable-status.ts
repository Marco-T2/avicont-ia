import { InvalidReceivableStatus } from "../errors/receivable-errors";

export const RECEIVABLE_STATUSES = [
  "PENDING",
  "PARTIAL",
  "PAID",
  "VOIDED",
  "OVERDUE",
  "CANCELLED",
] as const;

export type ReceivableStatus = typeof RECEIVABLE_STATUSES[number];

const ALLOWED: Record<ReceivableStatus, readonly ReceivableStatus[]> = {
  PENDING: ["PARTIAL", "PAID", "VOIDED"],
  PARTIAL: ["PAID", "VOIDED"],
  // Entry closed, exit OPEN (DEC-A, Batch 3-FIX): OVERDUE is not reachable as
  // a transition TARGET — no row can newly enter it — but the exits are
  // deliberately retained so a pre-existing legacy row can drain to
  // PARTIAL/PAID/VOIDED; `[]` would wall it in (unvoidable, unpayable) and
  // roll back any sale void that touches it. Key stays while OVERDUE remains
  // in the pg enum union.
  OVERDUE: ["PARTIAL", "PAID", "VOIDED"],
  PAID: [],
  VOIDED: [],
  CANCELLED: [],
};

export function parseReceivableStatus(value: string): ReceivableStatus {
  if ((RECEIVABLE_STATUSES as readonly string[]).includes(value)) {
    return value as ReceivableStatus;
  }
  throw new InvalidReceivableStatus(value);
}

export function canTransition(from: ReceivableStatus, to: ReceivableStatus): boolean {
  return ALLOWED[from].includes(to);
}
