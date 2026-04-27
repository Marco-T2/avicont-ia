import "server-only";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";
import type { OrgSettings } from "../domain/org-settings.entity";
import type { OrgSettingsRepository } from "../domain/ports/org-settings.repository";
import { toDomain, toPersistenceCreate, toPersistenceUpdate } from "./org-settings.mapper";

type DbClient = Pick<PrismaClient, "orgSettings">;

export class PrismaOrgSettingsRepository implements OrgSettingsRepository {
  constructor(private readonly db: DbClient = prisma) {}

  async findByOrgId(organizationId: string): Promise<OrgSettings | null> {
    const row = await this.db.orgSettings.findUnique({
      where: { organizationId },
    });
    return row ? toDomain(row) : null;
  }

  async save(settings: OrgSettings): Promise<void> {
    await this.db.orgSettings.create({ data: toPersistenceCreate(settings) });
  }

  async update(settings: OrgSettings): Promise<void> {
    await this.db.orgSettings.update({
      where: { organizationId: settings.organizationId },
      data: toPersistenceUpdate(settings),
    });
  }
}
