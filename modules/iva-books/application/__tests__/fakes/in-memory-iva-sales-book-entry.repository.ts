import type { IvaSalesBookEntry } from "../../../domain/iva-sales-book-entry.entity";
import type {
  IvaSalesBookEntryRepository,
  ListSalesQuery,
} from "../../../domain/ports/iva-sales-book-entry-repository.port";

/**
 * In-memory fake of `IvaSalesBookEntryRepository` for application-layer tests.
 * Stores entries by `id`; resolves `findBySaleIdTx` via linear scan (fine for
 * tests). Records all calls per method for spy assertions.
 */
export class InMemoryIvaSalesBookEntryRepository
  implements IvaSalesBookEntryRepository
{
  private readonly store = new Map<string, IvaSalesBookEntry>();
  saveCalls: IvaSalesBookEntry[] = [];
  updateCalls: IvaSalesBookEntry[] = [];

  preload(entry: IvaSalesBookEntry): void {
    this.store.set(entry.id, entry);
  }

  all(): IvaSalesBookEntry[] {
    return Array.from(this.store.values());
  }

  async findByIdTx(
    organizationId: string,
    id: string,
  ): Promise<IvaSalesBookEntry | null> {
    const entry = this.store.get(id);
    if (!entry || entry.organizationId !== organizationId) return null;
    return entry;
  }

  async findBySaleIdTx(
    organizationId: string,
    saleId: string,
  ): Promise<IvaSalesBookEntry | null> {
    for (const entry of this.store.values()) {
      if (entry.organizationId === organizationId && entry.saleId === saleId) {
        return entry;
      }
    }
    return null;
  }

  async saveTx(entry: IvaSalesBookEntry): Promise<IvaSalesBookEntry> {
    this.saveCalls.push(entry);
    this.store.set(entry.id, entry);
    return entry;
  }

  async updateTx(entry: IvaSalesBookEntry): Promise<IvaSalesBookEntry> {
    this.updateCalls.push(entry);
    this.store.set(entry.id, entry);
    return entry;
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<IvaSalesBookEntry | null> {
    const entry = this.store.get(id);
    if (!entry || entry.organizationId !== organizationId) return null;
    return entry;
  }

  async findByPeriod(
    organizationId: string,
    query: ListSalesQuery,
  ): Promise<IvaSalesBookEntry[]> {
    const out: IvaSalesBookEntry[] = [];
    for (const entry of this.store.values()) {
      if (entry.organizationId !== organizationId) continue;
      if (query.fiscalPeriodId && entry.fiscalPeriodId !== query.fiscalPeriodId) continue;
      if (query.status && entry.status !== query.status) continue;
      out.push(entry);
    }
    return out;
  }
}
