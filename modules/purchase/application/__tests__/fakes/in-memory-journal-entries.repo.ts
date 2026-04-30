import type { Journal } from "@/modules/accounting/domain/journal.entity";
import type { JournalEntriesRepository } from "@/modules/accounting/domain/ports/journal-entries.repo";

/**
 * In-memory `JournalEntriesRepository` fake purchase-hex. Espejo simétrico
 * del fake sale-hex. `updateStatus` consumido por `void` (C6); `create` y
 * `update` no usados (factory port encapsula creación + edits).
 */
export class InMemoryJournalEntries implements JournalEntriesRepository {
  updateStatusCalls: { journal: Journal; userId: string }[] = [];

  async create(): Promise<Journal> {
    throw new Error(
      "InMemoryJournalEntries.create not used by purchase-hex (factory port encapsulates creation)",
    );
  }

  async update(): Promise<Journal> {
    throw new Error(
      "InMemoryJournalEntries.update not used by purchase-hex (factory.regenerateForPurchaseEdit encapsulates edits)",
    );
  }

  async updateStatus(journal: Journal, userId: string): Promise<Journal> {
    this.updateStatusCalls.push({ journal, userId });
    return journal;
  }
}
