import { InvalidPaymentDirection } from "../errors/payment-errors";

/**
 * Payment direction is a derived classification:
 * - COBRO: incoming cash from a customer (allocations target receivables)
 * - PAGO: outgoing cash to a supplier (allocations target payables)
 *
 * It is NOT persisted as a column on the Payment aggregate — at write time the
 * application layer derives it from allocations or contact type, then uses it
 * to pick the voucher type / journal entry shape. The VO exists for typing
 * cross-layer parameters and for parsing untrusted input.
 */
export const PAYMENT_DIRECTIONS = ["COBRO", "PAGO"] as const;

export type PaymentDirection = (typeof PAYMENT_DIRECTIONS)[number];

export function parsePaymentDirection(value: string): PaymentDirection {
  if ((PAYMENT_DIRECTIONS as readonly string[]).includes(value)) {
    return value as PaymentDirection;
  }
  throw new InvalidPaymentDirection(value);
}
