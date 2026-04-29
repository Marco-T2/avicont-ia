import type { Journal } from "@/modules/accounting/domain/journal.entity";
import type { JournalEntriesReadPort } from "@/modules/accounting/domain/ports/journal-entries-read.port";

/**
 * In-memory `JournalEntriesReadPort` fake. Tests preload `Journal` aggregates
 * by id; `findById` returns the matching entity or `null`.
 */
export class InMemoryJournalEntriesRead implements JournalEntriesReadPort {
  private readonly store = new Map<string, Journal>();
  calls: { organizationId: string; entryId: string }[] = [];

  preload(...journals: Journal[]): void {
    for (const j of journals) this.store.set(j.id, j);
  }

  async findById(
    organizationId: string,
    entryId: string,
  ): Promise<Journal | null> {
    this.calls.push({ organizationId, entryId });
    const j = this.store.get(entryId);
    return j && j.organizationId === organizationId ? j : null;
  }
}
