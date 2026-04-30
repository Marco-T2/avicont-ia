import type { SaleJournalRegenNotifierPort } from "../../../domain/ports/sale-journal-regen-notifier.port";

/**
 * In-memory fake of `SaleJournalRegenNotifierPort`. Records every invocation
 * so tests can assert when sale-hex is notified to regenerate the journal.
 * `nextCorrelationId` overrides the auto-generated default per call.
 */
export class InMemorySaleJournalRegenNotifier
  implements SaleJournalRegenNotifierPort
{
  calls: { organizationId: string; saleId: string; userId: string }[] = [];
  nextCorrelationId: string | null = null;
  private counter = 0;

  async regenerateJournalForIvaChange(
    organizationId: string,
    saleId: string,
    userId: string,
  ): Promise<{ correlationId: string }> {
    this.calls.push({ organizationId, saleId, userId });
    const correlationId =
      this.nextCorrelationId ?? `corr-sale-bridge-${++this.counter}`;
    this.nextCorrelationId = null;
    return { correlationId };
  }
}
