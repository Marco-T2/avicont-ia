import type {
  IvaBookReaderPort,
  IvaBookSnapshot,
} from "../../../domain/ports/iva-book-reader.port";

/**
 * In-memory `IvaBookReaderPort` fake purchase-hex. Espejo simétrico del
 * fake sale-hex pero con `getActiveBookForPurchase` (paridad legacy
 * `ivaPurchaseBook` table).
 */
export class InMemoryIvaBookReader implements IvaBookReaderPort {
  private readonly byPurchaseId = new Map<string, IvaBookSnapshot | null>();
  calls: { organizationId: string; purchaseId: string }[] = [];

  preload(purchaseId: string, snapshot: IvaBookSnapshot | null): void {
    this.byPurchaseId.set(purchaseId, snapshot);
  }

  async getActiveBookForPurchase(
    organizationId: string,
    purchaseId: string,
  ): Promise<IvaBookSnapshot | null> {
    this.calls.push({ organizationId, purchaseId });
    return this.byPurchaseId.get(purchaseId) ?? null;
  }
}
