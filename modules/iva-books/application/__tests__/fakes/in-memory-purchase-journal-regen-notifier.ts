import type { PurchaseJournalRegenNotifierPort } from "../../../domain/ports/purchase-journal-regen-notifier.port";

/**
 * In-memory fake of `PurchaseJournalRegenNotifierPort`. Mirror simétrico de
 * `InMemorySaleJournalRegenNotifier`.
 */
export class InMemoryPurchaseJournalRegenNotifier
  implements PurchaseJournalRegenNotifierPort
{
  calls: { organizationId: string; purchaseId: string; userId: string }[] = [];
  nextCorrelationId: string | null = null;
  private counter = 0;

  async regenerateJournalForIvaChange(
    organizationId: string,
    purchaseId: string,
    userId: string,
  ): Promise<{ correlationId: string }> {
    this.calls.push({ organizationId, purchaseId, userId });
    const correlationId =
      this.nextCorrelationId ?? `corr-purchase-bridge-${++this.counter}`;
    this.nextCorrelationId = null;
    return { correlationId };
  }
}
