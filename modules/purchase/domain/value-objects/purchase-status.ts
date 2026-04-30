import { InvalidPurchaseStatus } from "../errors/purchase-errors";

export const PURCHASE_STATUSES = ["DRAFT", "POSTED", "LOCKED", "VOIDED"] as const;

export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

const VALID_SET = new Set<string>(PURCHASE_STATUSES);

export function parsePurchaseStatus(value: unknown): PurchaseStatus {
  if (typeof value !== "string" || !VALID_SET.has(value)) {
    throw new InvalidPurchaseStatus(String(value));
  }
  return value as PurchaseStatus;
}
