import "server-only";
import {
  makeOrgSettingsService,
  type OrgSettingsService,
} from "@/modules/org-settings/presentation/server";
import type {
  DispatchOrgSettingsReaderPort,
  OrgSettingsSnapshot,
} from "../domain/ports/dispatch-org-settings-reader.port";

/**
 * Legacy adapter: wraps OrgSettingsService for dispatch settings access.
 */
export class LegacyOrgSettingsReaderAdapter
  implements DispatchOrgSettingsReaderPort
{
  private readonly service: OrgSettingsService;

  constructor() {
    this.service = makeOrgSettingsService();
  }

  async getOrCreate(organizationId: string): Promise<OrgSettingsSnapshot> {
    const settings = await this.service.getOrCreate(organizationId);
    const snapshot = settings.toSnapshot();
    return {
      roundingThreshold: Number(snapshot.roundingThreshold),
      cxcAccountCode: snapshot.cxcAccountCode,
    };
  }
}
