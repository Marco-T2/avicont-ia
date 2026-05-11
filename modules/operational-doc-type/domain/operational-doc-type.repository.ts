import type { OperationalDocType } from "./operational-doc-type.entity";
import type { OperationalDocDirection } from "./value-objects/operational-doc-direction";

export interface OperationalDocTypesRepository {
  findAll(
    organizationId: string,
    filters?: { isActive?: boolean; direction?: OperationalDocDirection },
  ): Promise<OperationalDocType[]>;
  findById(
    organizationId: string,
    id: string,
  ): Promise<OperationalDocType | null>;
  findByCode(
    organizationId: string,
    code: string,
  ): Promise<OperationalDocType | null>;
  save(docType: OperationalDocType): Promise<void>;
  countActivePayments(
    organizationId: string,
    docTypeId: string,
  ): Promise<number>;
}
