import type { OperationalDocType as PrismaOperationalDocType } from "@/generated/prisma/client";
import { OperationalDocType } from "../domain/operational-doc-type.entity";
import type { OperationalDocDirection } from "../domain/value-objects/operational-doc-direction";

export function toDomain(row: PrismaOperationalDocType): OperationalDocType {
  return OperationalDocType.fromPersistence({
    id: row.id,
    organizationId: row.organizationId,
    code: row.code,
    name: row.name,
    direction: row.direction as OperationalDocDirection,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function toPersistence(entity: OperationalDocType) {
  const s = entity.toSnapshot();
  return {
    id: s.id,
    organizationId: s.organizationId,
    code: s.code,
    name: s.name,
    direction: s.direction,
    isActive: s.isActive,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}
