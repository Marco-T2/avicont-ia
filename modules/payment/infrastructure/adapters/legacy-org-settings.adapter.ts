import "server-only";
import { OrgSettingsService } from "@/features/org-settings/server";
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
  constructor(private readonly service: OrgSettingsService = new OrgSettingsService()) {}

  async getOrCreate(organizationId: string): Promise<PaymentOrgSettings> {
    const settings = await this.service.getOrCreate(organizationId);
    return {
      cajaGeneralAccountCode: settings.cajaGeneralAccountCode,
      bancoAccountCode: settings.bancoAccountCode,
      cxcAccountCode: settings.cxcAccountCode,
      cxpAccountCode: settings.cxpAccountCode,
    };
  }
}
