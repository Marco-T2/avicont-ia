import "server-only";

/**
 * @deprecated Shim de retrocompatibilidad. Usá `makeOrgSettingsService()` desde
 * `@/modules/org-settings/presentation/server` para nuevo código. Este archivo
 * delega a la composition root del módulo hexagonal.
 *
 * El método legacy devolvía `Prisma.OrgSettings` row; ahora devuelve un POJO
 * con la misma forma (todos los campos planos, `roundingThreshold` ya como
 * `number`). Los consumers que hacían `Number(settings.roundingThreshold)`
 * siguen funcionando — `Number(number)` es identidad.
 */
import {
  makeOrgSettingsService,
  type OrgSettingsService as ModuleOrgSettingsService,
  type OrgSettingsSnapshot,
  type UpdateOrgSettingsInput,
} from "@/modules/org-settings/presentation/server";

export type { OrgSettingsSnapshot, UpdateOrgSettingsInput };

export class OrgSettingsService {
  private readonly delegate: ModuleOrgSettingsService;

  constructor() {
    this.delegate = makeOrgSettingsService();
  }

  async getOrCreate(organizationId: string): Promise<OrgSettingsSnapshot> {
    const entity = await this.delegate.getOrCreate(organizationId);
    return entity.toSnapshot();
  }

  async update(
    organizationId: string,
    input: UpdateOrgSettingsInput,
  ): Promise<OrgSettingsSnapshot> {
    const entity = await this.delegate.update(organizationId, input);
    return entity.toSnapshot();
  }
}
