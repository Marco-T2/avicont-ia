import type { LotStatus } from "../value-objects/lot-status";

/**
 * Read-side projection of a Lot. Post-collapse (REQ-200, REQ-201)
 * the entity no longer carries `farmId` — it has `farmName` (free
 * text label of the farm/place) and `memberId` (FK to the owning
 * OrganizationMember). The legacy Prisma `farmId` column is still
 * present until the F5-final destructive migration but is NOT part
 * of the domain projection.
 */
export type LotSnapshot = {
  id: string;
  name: string;
  barnNumber: number;
  initialCount: number;
  startDate: Date;
  endDate: Date | null;
  status: LotStatus;
  farmName: string;
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
