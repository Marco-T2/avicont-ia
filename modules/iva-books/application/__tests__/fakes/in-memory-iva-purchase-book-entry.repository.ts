import type { IvaPurchaseBookEntry } from "../../../domain/iva-purchase-book-entry.entity";
import type { IvaPurchaseBookEntryRepository } from "../../../domain/ports/iva-purchase-book-entry-repository.port";

/**
 * In-memory fake of `IvaPurchaseBookEntryRepository` for application-layer
 * tests. Mirror simétrico de `InMemoryIvaSalesBookEntryRepository`.
 */
export class InMemoryIvaPurchaseBookEntryRepository
  implements IvaPurchaseBookEntryRepository
{
  private readonly store = new Map<string, IvaPurchaseBookEntry>();
  saveCalls: IvaPurchaseBookEntry[] = [];
  updateCalls: IvaPurchaseBookEntry[] = [];

  preload(entry: IvaPurchaseBookEntry): void {
    this.store.set(entry.id, entry);
  }

  all(): IvaPurchaseBookEntry[] {
    return Array.from(this.store.values());
  }

  async findByIdTx(
    organizationId: string,
    id: string,
  ): Promise<IvaPurchaseBookEntry | null> {
    const entry = this.store.get(id);
    if (!entry || entry.organizationId !== organizationId) return null;
    return entry;
  }

  async findByPurchaseIdTx(
    organizationId: string,
    purchaseId: string,
  ): Promise<IvaPurchaseBookEntry | null> {
    for (const entry of this.store.values()) {
      if (
        entry.organizationId === organizationId &&
        entry.purchaseId === purchaseId
      ) {
        return entry;
      }
    }
    return null;
  }

  async saveTx(entry: IvaPurchaseBookEntry): Promise<IvaPurchaseBookEntry> {
    this.saveCalls.push(entry);
    this.store.set(entry.id, entry);
    return entry;
  }

  async updateTx(entry: IvaPurchaseBookEntry): Promise<IvaPurchaseBookEntry> {
    this.updateCalls.push(entry);
    this.store.set(entry.id, entry);
    return entry;
  }
}
