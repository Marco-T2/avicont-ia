import { Prisma } from "@/generated/prisma/client";
import { BaseRepository } from "@/features/shared/base.repository";
import type { OrgSettings } from "@/generated/prisma/client";
import type { UpdateOrgSettingsInput } from "./org-settings.types";

export const DEFAULT_SETTINGS = {
  cajaGeneralAccountCode: "1.1.1.1",
  bancoAccountCode: "1.1.2.1",
  cxcAccountCode: "1.1.4.1",
  cxpAccountCode: "2.1.1.1",
  roundingThreshold: new Prisma.Decimal(0.7),
};

export class OrgSettingsRepository extends BaseRepository {
  async findByOrgId(organizationId: string): Promise<OrgSettings | null> {
    return this.db.orgSettings.findUnique({ where: { organizationId } });
  }

  async create(organizationId: string): Promise<OrgSettings> {
    return this.db.orgSettings.create({
      data: {
        organizationId,
        cajaGeneralAccountCode: DEFAULT_SETTINGS.cajaGeneralAccountCode,
        bancoAccountCode: DEFAULT_SETTINGS.bancoAccountCode,
        cxcAccountCode: DEFAULT_SETTINGS.cxcAccountCode,
        cxpAccountCode: DEFAULT_SETTINGS.cxpAccountCode,
        roundingThreshold: DEFAULT_SETTINGS.roundingThreshold,
      },
    });
  }

  async update(organizationId: string, data: UpdateOrgSettingsInput): Promise<OrgSettings> {
    return this.db.orgSettings.update({
      where: { organizationId },
      data: {
        ...(data.cajaGeneralAccountCode !== undefined && {
          cajaGeneralAccountCode: data.cajaGeneralAccountCode,
        }),
        ...(data.bancoAccountCode !== undefined && {
          bancoAccountCode: data.bancoAccountCode,
        }),
        ...(data.cxcAccountCode !== undefined && {
          cxcAccountCode: data.cxcAccountCode,
        }),
        ...(data.cxpAccountCode !== undefined && {
          cxpAccountCode: data.cxpAccountCode,
        }),
        ...(data.roundingThreshold !== undefined && {
          roundingThreshold: new Prisma.Decimal(data.roundingThreshold),
        }),
      },
    });
  }
}
