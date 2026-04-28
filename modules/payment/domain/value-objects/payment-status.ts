import { InvalidPaymentStatus } from "../errors/payment-errors";

export const PAYMENT_STATUSES = [
  "DRAFT",
  "POSTED",
  "LOCKED",
  "VOIDED",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const ALLOWED: Record<PaymentStatus, readonly PaymentStatus[]> = {
  DRAFT: ["POSTED"],
  POSTED: ["LOCKED", "VOIDED"],
  LOCKED: ["VOIDED"],
  VOIDED: [],
};

export function parsePaymentStatus(value: string): PaymentStatus {
  if ((PAYMENT_STATUSES as readonly string[]).includes(value)) {
    return value as PaymentStatus;
  }
  throw new InvalidPaymentStatus(value);
}

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return ALLOWED[from].includes(to);
}
