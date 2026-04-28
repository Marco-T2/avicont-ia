import { InvalidPaymentMethod } from "../errors/payment-errors";

export const PAYMENT_METHODS = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "CHEQUE",
  "DEPOSITO",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function parsePaymentMethod(value: string): PaymentMethod {
  if ((PAYMENT_METHODS as readonly string[]).includes(value)) {
    return value as PaymentMethod;
  }
  throw new InvalidPaymentMethod(value);
}

/**
 * Treasury rule: bank-mediated payment methods require a 4-line journal entry
 * (cash + bank routing). Used by application layer when building entry lines.
 */
export function isBankTransfer(method: PaymentMethod): boolean {
  return method === "TRANSFERENCIA" || method === "DEPOSITO";
}
