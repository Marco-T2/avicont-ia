import type { OrgSettingsService } from "@/modules/org-settings/application/org-settings.service";
import type { OrgSettings } from "@/modules/org-settings/domain/org-settings.entity";
import type { OrgSettingsReaderPort } from "@/modules/sale/domain/ports/org-settings-reader.port";

/**
 * Delegate-thin wrap sobre `OrgSettingsService.getOrCreate` — Opción C §13
 * lockeada Step 0 A2 (#1322). Lazy-create + composición Prisma viven en el
 * service wrapeado.
 */
export class PrismaOrgSettingsReaderAdapter implements OrgSettingsReaderPort {
  constructor(private readonly service: OrgSettingsService) {}

  async getOrCreate(organizationId: string): Promise<OrgSettings> {
    return this.service.getOrCreate(organizationId);
  }
}
