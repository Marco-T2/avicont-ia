import "server-only";
import { OrgSettingsService } from "../application/org-settings.service";
import { PrismaOrgSettingsRepository } from "../infrastructure/prisma-org-settings.repository";
import { LegacyAccountLookupAdapter } from "../infrastructure/legacy-account-lookup.adapter";

export function makeOrgSettingsService(): OrgSettingsService {
  return new OrgSettingsService(
    new PrismaOrgSettingsRepository(),
    new LegacyAccountLookupAdapter(),
  );
}
