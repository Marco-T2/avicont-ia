import type { Farm as PrismaFarm } from "@/generated/prisma/client";
import { Farm } from "../domain/farm.entity";

export function toDomain(row: PrismaFarm): Farm {
  return Farm.fromPersistence({
    id: row.id,
    name: row.name,
    location: row.location,
    memberId: row.memberId,
    organizationId: row.organizationId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function toPersistence(entity: Farm) {
  const s = entity.toSnapshot();
  return {
    id: s.id,
    name: s.name,
    location: s.location,
    memberId: s.memberId,
    organizationId: s.organizationId,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}
