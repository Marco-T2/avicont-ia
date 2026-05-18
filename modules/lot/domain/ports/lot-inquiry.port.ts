import type { LotStatus } from "../value-objects/lot-status";

/**
 * Read-side projection of a Lot. Post simplify-lot-identifier the
 * bare `name` + `barnNumber` columns are gone — consumers identify a
 * lot via `displayName = "{farmName} - DD/MM/YYYY"` derived from
 * `farmName + startDate`. `memberId` is the owning member FK
 * (REQ-201). Mirrors the canonical snapshot exposed by
 * `Lot.entity.ts#LotSnapshot` so the two interfaces stay in lockstep.
 */
export type LotSnapshot = {
  id: string;
  initialCount: number;
  startDate: Date;
  endDate: Date | null;
  status: LotStatus;
  farmName: string;
  /** Pre-computed identifier — see Lot.entity.ts#displayName. */
  displayName: string;
  memberId: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export interface LotInquiryPort {
  list(
    organizationId: string,
    filters?: { farmName?: string },
  ): Promise<LotSnapshot[]>;
  findById(
    organizationId: string,
    lotId: string,
  ): Promise<LotSnapshot | null>;
}
