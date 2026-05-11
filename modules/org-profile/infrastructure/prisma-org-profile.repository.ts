import "server-only";
import { prisma } from "@/lib/prisma";
import { type PrismaClient } from "@/generated/prisma/client";
import type { OrgProfileRepository } from "../domain/org-profile.repository";
import { type OrgProfile } from "../domain/org-profile.entity";
import { toDomain, toPersistence } from "./org-profile.mapper";

type DbClient = Pick<PrismaClient, "orgProfile">;

export class PrismaOrgProfileRepository implements OrgProfileRepository {
  constructor(private readonly db: DbClient = prisma) {}

  async findByOrgId(organizationId: string): Promise<OrgProfile | null> {
    const row = await this.db.orgProfile.findUnique({
      where: { organizationId },
    });
    return row ? toDomain(row) : null;
  }

  async save(entity: OrgProfile): Promise<void> {
    const data = toPersistence(entity);
    await this.db.orgProfile.upsert({
      where: { organizationId: data.organizationId },
      create: data,
      update: {
        razonSocial: data.razonSocial,
        nit: data.nit,
        direccion: data.direccion,
        ciudad: data.ciudad,
        telefono: data.telefono,
        representanteLegal: data.representanteLegal,
        nroPatronal: data.nroPatronal,
        logoUrl: data.logoUrl,
        updatedAt: data.updatedAt,
      },
    });
  }
}
