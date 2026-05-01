import type { SaleService } from "@/modules/sale/application/sale.service";

import type { SaleJournalRegenNotifierPort } from "../domain/ports/sale-journal-regen-notifier.port";

/**
 * Wraps `SaleService.regenerateJournalForIvaChange` and narrows
 * `UpdateSaleResult` → `{ correlationId }` per §12 cross-module concrete
 * leak avoidance. D-A1#3 — sale-hex maneja su propia tx via `SaleUoW.run()`;
 * bridge call es side-effect cross-module fuera del `IvaBookScope`.
 */
export class SaleJournalRegenNotifierAdapter
  implements SaleJournalRegenNotifierPort
{
  constructor(private readonly saleService: SaleService) {}

  async regenerateJournalForIvaChange(
    organizationId: string,
    saleId: string,
    userId: string,
  ): Promise<{ correlationId: string }> {
    const result = await this.saleService.regenerateJournalForIvaChange(
      organizationId,
      saleId,
      userId,
    );
    return { correlationId: result.correlationId };
  }
}
