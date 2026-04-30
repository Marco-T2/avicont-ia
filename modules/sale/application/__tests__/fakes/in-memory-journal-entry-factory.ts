import type { Journal } from "@/modules/accounting/domain/journal.entity";
import type {
  JournalEntryFactoryPort,
  PurchaseJournalTemplate,
  RegenerateJournalResult,
  SaleJournalTemplate,
} from "../../../domain/ports/journal-entry-factory.port";

/**
 * In-memory `JournalEntryFactoryPort` fake (sale-side). Records every
 * template received for assertion. Sale-hex tests no consumen los métodos
 * purchase-side — quedan stubbed throwing (port shared sale+purchase desde
 * POC #11.0b A2 Ciclo 4a; el fake purchase-hex vive en
 * `modules/purchase/application/__tests__/fakes/`).
 *
 * - `enqueue(...journals)` queues responses for `generateForSale` (FIFO).
 * - `enqueueRegen(...results)` queues `{old, new}` pairs for
 *   `regenerateForSaleEdit` (FIFO). If no result queued, throws.
 */
export class InMemoryJournalEntryFactory implements JournalEntryFactoryPort {
  calls: SaleJournalTemplate[] = [];
  regenCalls: { oldJournalId: string; template: SaleJournalTemplate }[] = [];
  private queue: Journal[] = [];
  private regenQueue: RegenerateJournalResult[] = [];

  enqueue(...journals: Journal[]): void {
    this.queue.push(...journals);
  }

  enqueueRegen(...results: RegenerateJournalResult[]): void {
    this.regenQueue.push(...results);
  }

  async generateForSale(template: SaleJournalTemplate): Promise<Journal> {
    this.calls.push(template);
    const next = this.queue.shift();
    if (!next) {
      throw new Error(
        "InMemoryJournalEntryFactory: no Journal queued — call .enqueue(journal) before invoking generateForSale",
      );
    }
    return next;
  }

  async regenerateForSaleEdit(
    oldJournalId: string,
    template: SaleJournalTemplate,
  ): Promise<RegenerateJournalResult> {
    this.regenCalls.push({ oldJournalId, template });
    const next = this.regenQueue.shift();
    if (!next) {
      throw new Error(
        "InMemoryJournalEntryFactory: no regen result queued — call .enqueueRegen({old, new}) before invoking regenerateForSaleEdit",
      );
    }
    return next;
  }

  async generateForPurchase(_template: PurchaseJournalTemplate): Promise<Journal> {
    throw new Error(
      "InMemoryJournalEntryFactory (sale-hex): generateForPurchase no es usado en tests sale-hex. Port shared desde POC #11.0b A2 — usar el fake purchase-hex en modules/purchase/application/__tests__/fakes/.",
    );
  }

  async regenerateForPurchaseEdit(
    _oldJournalId: string,
    _template: PurchaseJournalTemplate,
  ): Promise<RegenerateJournalResult> {
    throw new Error(
      "InMemoryJournalEntryFactory (sale-hex): regenerateForPurchaseEdit no es usado en tests sale-hex.",
    );
  }
}
