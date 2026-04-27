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
  PENDING: ["PARTIAL", "PAID", "VOIDED", "OVERDUE"],
  PARTIAL: ["PAID", "VOIDED", "OVERDUE"],
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
