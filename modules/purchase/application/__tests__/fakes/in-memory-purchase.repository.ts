import type { Purchase } from "../../../domain/purchase.entity";
import type {
  PurchaseFilters,
  PurchaseRepository,
} from "../../../domain/ports/purchase.repository";

/**
 * In-memory `PurchaseRepository` fake. Espejo simétrico a
 * `InMemorySaleRepository` (sale-hex). Read methods (`findById`, `findAll`)
 * implementados desde C1; tx-aware writes (`saveTx`, `updateTx`, `deleteTx`,
 * `getNextSequenceNumberTx`) también implementados desde C1 con `*Calls`
 * recorders para que tests downstream (C4/C5/C6) puedan hacer assertions
 * sobre invocaciones.
 */
export class InMemoryPurchaseRepository implements PurchaseRepository {
  private readonly store = new Map<string, Purchase>();

  reset(): void {
    this.store.clear();
  }

  preload(...purchases: Purchase[]): void {
    for (const p of purchases) this.store.set(p.id, p);
  }

  async findById(organizationId: string, id: string): Promise<Purchase | null> {
    const purchase = this.store.get(id);
    if (!purchase) return null;
    return purchase.organizationId === organizationId ? purchase : null;
  }

  async findAll(
    organizationId: string,
    filters?: PurchaseFilters,
  ): Promise<Purchase[]> {
    return [...this.store.values()].filter((purchase) => {
      if (purchase.organizationId !== organizationId) return false;
      if (filters?.contactId && purchase.contactId !== filters.contactId) return false;
      if (filters?.status && purchase.status !== filters.status) return false;
      if (filters?.dateFrom && purchase.date < filters.dateFrom) return false;
      if (filters?.dateTo && purchase.date > filters.dateTo) return false;
      return true;
    });
  }

  saveTxCalls: Purchase[] = [];

  async findByIdTx(organizationId: string, id: string): Promise<Purchase | null> {
    return this.findById(organizationId, id);
  }

  async saveTx(purchase: Purchase): Promise<Purchase> {
    this.saveTxCalls.push(purchase);
    this.store.set(purchase.id, purchase);
    return purchase;
  }

  updateTxCalls: { purchase: Purchase; options: { replaceDetails: boolean } }[] = [];

  async updateTx(
    purchase: Purchase,
    options: { replaceDetails: boolean },
  ): Promise<Purchase> {
    this.updateTxCalls.push({ purchase, options });
    this.store.set(purchase.id, purchase);
    return purchase;
  }

  deleteTxCalls: { organizationId: string; id: string }[] = [];

  async deleteTx(organizationId: string, id: string): Promise<void> {
    this.deleteTxCalls.push({ organizationId, id });
    this.store.delete(id);
  }

  private nextSequenceByOrg = new Map<string, number>();

  async getNextSequenceNumberTx(organizationId: string): Promise<number> {
    const next = (this.nextSequenceByOrg.get(organizationId) ?? 0) + 1;
    this.nextSequenceByOrg.set(organizationId, next);
    return next;
  }
}
