import { InvalidSaleStatus } from "../errors/sale-errors";

export const SALE_STATUSES = ["DRAFT", "POSTED", "LOCKED", "VOIDED"] as const;

export type SaleStatus = (typeof SALE_STATUSES)[number];

const VALID_SET = new Set<string>(SALE_STATUSES);

export function parseSaleStatus(value: unknown): SaleStatus {
  if (typeof value !== "string" || !VALID_SET.has(value)) {
    throw new InvalidSaleStatus(String(value));
  }
  return value as SaleStatus;
}
