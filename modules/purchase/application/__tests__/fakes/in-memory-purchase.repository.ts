import type { Purchase, PurchaseType } from "../../../domain/purchase.entity";
import type {
  PurchaseFilters,
  PurchaseRepository,
} from "../../../domain/ports/purchase.repository";

/**
 * In-memory `PurchaseRepository` fake. Read methods (`findById`, `findAll`)
 * implementados desde C1; tx-aware writes (`saveTx`, `updateTx`, `deleteTx`,
 * `getNextSequenceNumberTx`) implementados con `*Calls` recorders.
 *
 * Asimetría vs `InMemorySaleRepository` (audit-4 D-A3-1):
 * `getNextSequenceNumberTx` scoped por (`organizationId`, `purchaseType`) —
 * schema `@@unique([organizationId, purchaseType, sequenceNumber])` + paridad
 * legacy regla #1 (`features/purchase/purchase.repository.ts:163-172`) +
 * Convention §12 sub-prefix determinístico (FL-001 + CG-001 conviven).
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

  private nextSequenceByOrgType = new Map<string, number>();

  async getNextSequenceNumberTx(
    organizationId: string,
    purchaseType: PurchaseType,
  ): Promise<number> {
    const key = `${organizationId}:${purchaseType}`;
    const next = (this.nextSequenceByOrgType.get(key) ?? 0) + 1;
    this.nextSequenceByOrgType.set(key, next);
    return next;
  }
}
