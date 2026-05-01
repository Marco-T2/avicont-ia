import type { PurchaseService } from "@/modules/purchase/application/purchase.service";

import type { PurchaseJournalRegenNotifierPort } from "../domain/ports/purchase-journal-regen-notifier.port";

/**
 * Wraps `PurchaseService.regenerateJournalForIvaChange` and narrows
 * `UpdatePurchaseResult` → `{ correlationId }` per §12 cross-module concrete
 * leak avoidance. D-A1#3 — purchase-hex maneja su propia tx via
 * `PurchaseUoW.run()`; bridge call es side-effect cross-module fuera del
 * `IvaBookScope`. Period gate INSIDE use case (asimetría con sale-hex per
 * port JSDoc :11-14) — el adapter propaga `PurchasePeriodClosed` transparente.
 */
export class PurchaseJournalRegenNotifierAdapter
  implements PurchaseJournalRegenNotifierPort
{
  constructor(private readonly purchaseService: PurchaseService) {}

  async regenerateJournalForIvaChange(
    organizationId: string,
    purchaseId: string,
    userId: string,
  ): Promise<{ correlationId: string }> {
    const result = await this.purchaseService.regenerateJournalForIvaChange(
      organizationId,
      purchaseId,
      userId,
    );
    return { correlationId: result.correlationId };
  }
}
