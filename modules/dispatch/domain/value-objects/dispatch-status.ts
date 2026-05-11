import { InvalidDispatchStatus } from "../errors/dispatch-errors";

export const DISPATCH_STATUSES = ["DRAFT", "POSTED", "LOCKED", "VOIDED"] as const;

export type DispatchStatus = (typeof DISPATCH_STATUSES)[number];

const VALID_SET = new Set<string>(DISPATCH_STATUSES);

export function parseDispatchStatus(value: unknown): DispatchStatus {
  if (typeof value !== "string" || !VALID_SET.has(value)) {
    throw new InvalidDispatchStatus(String(value));
  }
  return value as DispatchStatus;
}
