import type { OperationalDocDirection } from "../value-objects/operational-doc-direction";

export type OperationalDocTypeSnapshot = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  direction: OperationalDocDirection;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export interface OperationalDocTypesInquiryPort {
  list(
    organizationId: string,
    filters?: { isActive?: boolean; direction?: OperationalDocDirection },
  ): Promise<OperationalDocTypeSnapshot[]>;
  findById(
    organizationId: string,
    id: string,
  ): Promise<OperationalDocTypeSnapshot | null>;
}
