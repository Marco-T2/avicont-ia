import { OrgSettingsRepository } from "./org-settings.repository";
import type { OrgSettings, UpdateOrgSettingsInput } from "./org-settings.types";

export class OrgSettingsService {
  private readonly repo: OrgSettingsRepository;

  constructor(repo?: OrgSettingsRepository) {
    this.repo = repo ?? new OrgSettingsRepository();
  }

  // ── Get org settings, creating with defaults if not exists ──

  async getOrCreate(organizationId: string): Promise<OrgSettings> {
    const existing = await this.repo.findByOrgId(organizationId);
    if (existing) return existing;
    return this.repo.create(organizationId);
  }

  // ── Update org settings ──

  async update(organizationId: string, input: UpdateOrgSettingsInput): Promise<OrgSettings> {
    // Ensure settings row exists before updating
    await this.getOrCreate(organizationId);
    return this.repo.update(organizationId, input);
  }
}
