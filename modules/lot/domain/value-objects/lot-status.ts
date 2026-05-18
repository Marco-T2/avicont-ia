import { InvalidLotStatus } from "../errors/lot-errors";

/**
 * Binary lifecycle: ACTIVE (running) | INACTIVE (terminal).
 * Spec REQ-202, design D-1 (D-1 bridge: Prisma enum still has
 * ACTIVE/CLOSED/SOLD until F5 destructive migration; the mapper
 * translates CLOSED|SOLD → INACTIVE on read and INACTIVE → CLOSED
 * on write so the domain stays narrow without breaking the schema).
 */
export const LOT_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export type LotStatus = typeof LOT_STATUSES[number];

export function parseLotStatus(value: string): LotStatus {
  if (value === "ACTIVE" || value === "INACTIVE") return value;
  throw new InvalidLotStatus(value);
}

export function canTransitionLot(from: LotStatus, to: LotStatus): boolean {
  return from === "ACTIVE" && to === "INACTIVE";
}
