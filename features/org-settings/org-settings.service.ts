import { OrgSettingsRepository } from "./org-settings.repository";
import type { OrgSettings, UpdateOrgSettingsInput } from "./org-settings.types";

export class OrgSettingsService {
  private readonly repo: OrgSettingsRepository;

  constructor(repo?: OrgSettingsRepository) {
    this.repo = repo ?? new OrgSettingsRepository();
  }

  // ── Obtener configuración de la organización, creando con valores por defecto si no existe ──

  async getOrCreate(organizationId: string): Promise<OrgSettings> {
    const existing = await this.repo.findByOrgId(organizationId);
    if (existing) return existing;
    return this.repo.create(organizationId);
  }

  // ── Actualizar configuración de la organización ──

  async update(organizationId: string, input: UpdateOrgSettingsInput): Promise<OrgSettings> {
    // Asegurar que la fila de configuración existe antes de actualizar
    await this.getOrCreate(organizationId);
    return this.repo.update(organizationId, input);
  }
}
