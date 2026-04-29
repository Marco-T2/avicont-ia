import type { Journal } from "@/modules/accounting/domain/journal.entity";
import type {
  JournalEntryFactoryPort,
  SaleJournalTemplate,
} from "../../../domain/ports/journal-entry-factory.port";

/**
 * In-memory `JournalEntryFactoryPort` fake. Tests configure `nextResult` —
 * the next call to `generateForSale` returns it (and consumes it). Records
 * every template received for assertion. If `nextResult` is unset, throws.
 */
export class InMemoryJournalEntryFactory implements JournalEntryFactoryPort {
  calls: SaleJournalTemplate[] = [];
  private queue: Journal[] = [];

  enqueue(...journals: Journal[]): void {
    this.queue.push(...journals);
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
}
