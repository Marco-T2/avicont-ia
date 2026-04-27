import type { OrgSettings } from "../org-settings.entity";

export interface OrgSettingsRepository {
  findByOrgId(organizationId: string): Promise<OrgSettings | null>;
  save(settings: OrgSettings): Promise<void>;
  update(settings: OrgSettings): Promise<void>;
}
