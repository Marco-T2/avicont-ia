import "server-only";
import {
  OrgSettingsService,
  makeOrgSettingsService,
} from "@/modules/org-settings/presentation/server";
import type { ControlAccountCodesReadPort } from "@/modules/accounting/domain/ports/contact-ledger-enrichment.ports";

/**
 * Adapter para `ControlAccountCodesReadPort`.
 *
 * Wraps `OrgSettingsService.getOrCreate(orgId)` y proyecta los dos códigos
 * de cuentas de control (CxC / CxP) que el contact-ledger usa para narrow
 * el query (BF1 — bug #2/#4/#6: filas duplicadas por contrapartida lines).
 *
 * Constructor DI default factory pattern — mirrors `LegacyOrgSettingsAdapter`
 * (modules/payment/infrastructure/adapters/legacy-org-settings.adapter.ts)
 * y `ContactsReadAdapter` precedent EXACT (cumulative cross-module pattern
 * hex canonical adapter).
 */
export class ControlAccountCodesReadAdapter
  implements ControlAccountCodesReadPort
{
  constructor(
    private readonly service: OrgSettingsService = makeOrgSettingsService(),
  ) {}

  async getControlAccountCodes(
    organizationId: string,
  ): Promise<{ cxcAccountCode: string; cxpAccountCode: string }> {
    const settings = (await this.service.getOrCreate(organizationId)).toSnapshot();
    return {
      cxcAccountCode: settings.cxcAccountCode,
      cxpAccountCode: settings.cxpAccountCode,
    };
  }
}
