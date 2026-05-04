import "server-only";
import { OrgSettingsService, makeOrgSettingsService } from "@/modules/org-settings/presentation/server";
import type {
  OrgSettingsReadPort,
  PaymentOrgSettings,
} from "../../domain/ports/org-settings-read.port";

/**
 * Adapter wrapping the legacy `OrgSettingsService` (which itself shims to
 * `modules/org-settings/`). Returns the narrow 4-account-code DTO payment
 * needs — drops every other field of the snapshot.
 */
export class LegacyOrgSettingsAdapter implements OrgSettingsReadPort {
  constructor(private readonly service: OrgSettingsService = makeOrgSettingsService()) {}

  async getOrCreate(organizationId: string): Promise<PaymentOrgSettings> {
    const settings = (await this.service.getOrCreate(organizationId)).toSnapshot();
    return {
      cajaGeneralAccountCode: settings.cajaGeneralAccountCode,
      bancoAccountCode: settings.bancoAccountCode,
      cxcAccountCode: settings.cxcAccountCode,
      cxpAccountCode: settings.cxpAccountCode,
    };
  }
}
