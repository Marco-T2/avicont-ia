import type { OrgSettings } from "@/modules/org-settings/domain/org-settings.entity";
import type { OrgSettingsReaderPort } from "@/modules/sale/domain/ports/org-settings-reader.port";

/**
 * In-memory `OrgSettingsReaderPort` fake para purchase-hex application
 * tests. Espejo simétrico del fake sale-hex.
 *
 * Importa el port desde `modules/sale/domain/ports/org-settings-reader.port`
 * (decisión step 0 A2 lockeada: "reuso del existente"). §13 emergente E-2
 * candidate (mover a `modules/org-settings/domain/ports/`) deferido a
 * auditoría retroactiva A2.
 */
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
