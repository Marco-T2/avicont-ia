export type FarmSnapshot = {
  id: string;
  name: string;
  location: string | null;
  memberId: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export interface FarmInquiryPort {
  list(
    organizationId: string,
    filters?: { memberId?: string },
  ): Promise<FarmSnapshot[]>;
  findById(
    organizationId: string,
    farmId: string,
  ): Promise<FarmSnapshot | null>;
}
