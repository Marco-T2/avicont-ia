import { InvalidIvaBookStatus } from "../errors/iva-book-errors";

export const IVA_BOOK_STATUSES = ["ACTIVE", "VOIDED"] as const;

export type IvaBookStatus = (typeof IVA_BOOK_STATUSES)[number];

const VALID_SET = new Set<string>(IVA_BOOK_STATUSES);

export function parseIvaBookStatus(value: unknown): IvaBookStatus {
  if (typeof value !== "string" || !VALID_SET.has(value)) {
    throw new InvalidIvaBookStatus(String(value));
  }
  return value as IvaBookStatus;
}
