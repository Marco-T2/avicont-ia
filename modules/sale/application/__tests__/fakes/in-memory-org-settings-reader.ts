import type { OrgSettings } from "@/modules/org-settings/domain/org-settings.entity";
import type { OrgSettingsReaderPort } from "../../../domain/ports/org-settings-reader.port";

export class InMemoryOrgSettingsReader implements OrgSettingsReaderPort {
  private readonly store = new Map<string, OrgSettings>();
  calls: string[] = [];

  preload(organizationId: string, settings: OrgSettings): void {
    this.store.set(organizationId, settings);
  }

  async getOrCreate(organizationId: string): Promise<OrgSettings> {
    this.calls.push(organizationId);
    const existing = this.store.get(organizationId);
    if (!existing) {
      throw new Error(
        `InMemoryOrgSettingsReader: no settings preloaded for ${organizationId}`,
      );
    }
    return existing;
  }
}
