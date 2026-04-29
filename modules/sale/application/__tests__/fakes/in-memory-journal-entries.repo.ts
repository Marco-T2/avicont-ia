import type { Journal } from "@/modules/accounting/domain/journal.entity";
import type { JournalEntriesRepository } from "@/modules/accounting/domain/ports/journal-entries.repo";

/**
 * In-memory `JournalEntriesRepository` fake for sale-hex application tests.
 * Records every persisted aggregate so tests can assert against the calls.
 * `create` is unused in sale-hex (the factory port encapsulates creation in
 * Ciclos 5b/6b/7); `update` is unused (factory.regenerateForSaleEdit
 * encapsulates edits); `updateStatus` is consumed by `void` (Ciclo 7).
 */
export class InMemoryJournalEntries implements JournalEntriesRepository {
  updateStatusCalls: { journal: Journal; userId: string }[] = [];

  async create(): Promise<Journal> {
    throw new Error(
      "InMemoryJournalEntries.create not used by sale-hex (factory port encapsulates creation)",
    );
  }

  async update(): Promise<Journal> {
    throw new Error(
      "InMemoryJournalEntries.update not used by sale-hex (factory.regenerateForSaleEdit encapsulates edits)",
    );
  }

  async updateStatus(journal: Journal, userId: string): Promise<Journal> {
    this.updateStatusCalls.push({ journal, userId });
    return journal;
  }
}
