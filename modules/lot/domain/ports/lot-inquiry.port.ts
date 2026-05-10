import type { LotStatus } from "../value-objects/lot-status";

export type LotSnapshot = {
  id: string;
  name: string;
  barnNumber: number;
  initialCount: number;
  startDate: Date;
  endDate: Date | null;
  status: LotStatus;
  farmId: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export interface LotInquiryPort {
  list(
    organizationId: string,
    filters?: { farmId?: string },
  ): Promise<LotSnapshot[]>;
  findById(
    organizationId: string,
    lotId: string,
  ): Promise<LotSnapshot | null>;
}
