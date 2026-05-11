import type { OrgProfile } from "./org-profile.entity";

export interface OrgProfileRepository {
  findByOrgId(organizationId: string): Promise<OrgProfile | null>;
  save(entity: OrgProfile): Promise<void>;
}
