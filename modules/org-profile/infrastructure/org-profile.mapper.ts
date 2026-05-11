import type { OrgProfile as PrismaOrgProfile } from "@/generated/prisma/client";
import { OrgProfile } from "../domain/org-profile.entity";

export function toDomain(row: PrismaOrgProfile): OrgProfile {
  return OrgProfile.fromPersistence({
    id: row.id,
    organizationId: row.organizationId,
    razonSocial: row.razonSocial,
    nit: row.nit,
    direccion: row.direccion,
    ciudad: row.ciudad,
    telefono: row.telefono,
    representanteLegal: row.representanteLegal,
    nroPatronal: row.nroPatronal,
    logoUrl: row.logoUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function toPersistence(entity: OrgProfile) {
  const s = entity.toSnapshot();
  return {
    id: s.id,
    organizationId: s.organizationId,
    razonSocial: s.razonSocial,
    nit: s.nit,
    direccion: s.direccion,
    ciudad: s.ciudad,
    telefono: s.telefono,
    representanteLegal: s.representanteLegal,
    nroPatronal: s.nroPatronal,
    logoUrl: s.logoUrl,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}
