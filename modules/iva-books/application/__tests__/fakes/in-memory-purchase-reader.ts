import type {
  PurchaseReaderPort,
  PurchaseSnapshot,
} from "../../../domain/ports/purchase-reader.port";

/**
 * In-memory fake of `PurchaseReaderPort`. Mirror simétrico de
 * `InMemorySaleReader`.
 */
export class InMemoryPurchaseReader implements PurchaseReaderPort {
  private readonly store = new Map<string, PurchaseSnapshot>();
  calls: { organizationId: string; purchaseId: string }[] = [];

  preload(snapshot: PurchaseSnapshot): void {
    this.store.set(snapshot.id, snapshot);
  }

  async getById(
    organizationId: string,
    purchaseId: string,
  ): Promise<PurchaseSnapshot | null> {
    this.calls.push({ organizationId, purchaseId });
    const found = this.store.get(purchaseId);
    if (!found || found.organizationId !== organizationId) return null;
    return found;
  }
}
