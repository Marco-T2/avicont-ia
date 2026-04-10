import { BaseRepository } from "@/features/shared/base.repository";
import { PaymentStatus } from "@/generated/prisma/client";
import type { OperationalDocType } from "@/generated/prisma/client";
import type {
  CreateOperationalDocTypeInput,
  UpdateOperationalDocTypeInput,
  OperationalDocTypeFilters,
} from "./operational-doc-types.types";

export class OperationalDocTypesRepository extends BaseRepository {
  async findAll(
    organizationId: string,
    filters?: OperationalDocTypeFilters,
  ): Promise<OperationalDocType[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.operationalDocType.findMany({
      where: {
        ...scope,
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
        ...(filters?.direction !== undefined && {
          direction: filters.direction,
        }),
      },
      orderBy: [{ code: "asc" }],
    });
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<OperationalDocType | null> {
    const scope = this.requireOrg(organizationId);

    return this.db.operationalDocType.findFirst({
      where: { id, ...scope },
    });
  }

  async findByCode(
    organizationId: string,
    code: string,
  ): Promise<OperationalDocType | null> {
    const scope = this.requireOrg(organizationId);

    return this.db.operationalDocType.findFirst({
      where: { code, ...scope },
    });
  }

  async create(
    organizationId: string,
    data: CreateOperationalDocTypeInput,
  ): Promise<OperationalDocType> {
    const scope = this.requireOrg(organizationId);

    return this.db.operationalDocType.create({
      data: {
        organizationId: scope.organizationId,
        code: data.code,
        name: data.name,
        direction: data.direction,
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: UpdateOperationalDocTypeInput,
  ): Promise<OperationalDocType> {
    const scope = this.requireOrg(organizationId);

    return this.db.operationalDocType.update({
      where: { id, ...scope },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.direction !== undefined && { direction: data.direction }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async countActivePayments(
    organizationId: string,
    docTypeId: string,
  ): Promise<number> {
    const scope = this.requireOrg(organizationId);

    return this.db.payment.count({
      where: {
        ...scope,
        operationalDocTypeId: docTypeId,
        status: { not: PaymentStatus.VOIDED },
      },
    });
  }
}
