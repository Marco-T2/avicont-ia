import { InvalidLotStatus } from "../errors/lot-errors";

export const LOT_STATUSES = ["ACTIVE", "CLOSED"] as const;

export type LotStatus = typeof LOT_STATUSES[number];

export function parseLotStatus(value: string): LotStatus {
  if (value === "ACTIVE" || value === "CLOSED") return value;
  throw new InvalidLotStatus(value);
}

export function canTransitionLot(from: LotStatus, to: LotStatus): boolean {
  return from === "ACTIVE" && to === "CLOSED";
}
