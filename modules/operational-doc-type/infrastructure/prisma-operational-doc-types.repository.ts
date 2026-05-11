import "server-only";
import { prisma } from "@/lib/prisma";
import { type PrismaClient } from "@/generated/prisma/client";
import type { OperationalDocTypesRepository } from "../domain/operational-doc-type.repository";
import { OperationalDocType } from "../domain/operational-doc-type.entity";
import type { OperationalDocDirection } from "../domain/value-objects/operational-doc-direction";
import { OperationalDocTypeDuplicateCodeError } from "../domain/errors/operational-doc-type-errors";
import { toDomain, toPersistence } from "./operational-doc-type.mapper";

type DbClient = Pick<PrismaClient, "operationalDocType" | "payment">;

export class PrismaOperationalDocTypesRepository
  implements OperationalDocTypesRepository
{
  constructor(private readonly db: DbClient = prisma) {}

  async findAll(
    organizationId: string,
    filters?: { isActive?: boolean; direction?: OperationalDocDirection },
  ): Promise<OperationalDocType[]> {
    const rows = await this.db.operationalDocType.findMany({
      where: {
        organizationId,
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
        ...(filters?.direction !== undefined && {
          direction: filters.direction,
        }),
      },
      orderBy: [{ code: "asc" }],
    });
    return rows.map(toDomain);
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<OperationalDocType | null> {
    const row = await this.db.operationalDocType.findFirst({
      where: { id, organizationId },
    });
    return row ? toDomain(row) : null;
  }

  async findByCode(
    organizationId: string,
    code: string,
  ): Promise<OperationalDocType | null> {
    const row = await this.db.operationalDocType.findFirst({
      where: { organizationId, code },
    });
    return row ? toDomain(row) : null;
  }

  async save(entity: OperationalDocType): Promise<void> {
    const data = toPersistence(entity);
    try {
      await this.db.operationalDocType.upsert({
        where: { id: data.id },
        create: data,
        update: {
          name: data.name,
          direction: data.direction,
          isActive: data.isActive,
          updatedAt: data.updatedAt,
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        throw new OperationalDocTypeDuplicateCodeError(entity.code);
      }
      throw error;
    }
  }

  async countActivePayments(
    organizationId: string,
    docTypeId: string,
  ): Promise<number> {
    return this.db.payment.count({
      where: {
        organizationId,
        operationalDocTypeId: docTypeId,
        status: { not: "VOIDED" },
      },
    });
  }
}
