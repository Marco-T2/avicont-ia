import type { IvaBookForEntry } from "../../../domain/build-purchase-entry-lines";
import type { IvaBookRegenNotifierPort } from "../../../domain/ports/iva-book-regen-notifier.port";

/**
 * In-memory `IvaBookRegenNotifierPort` fake purchase-hex. Espejo simétrico
 * del fake sale-hex. Tests configuran response per purchase via
 * `respondWith(purchaseId, ivaBook | null)`. Default: returns `null`
 * (no IVA cascade — non-IVA purchase path).
 */
export class InMemoryIvaBookRegenNotifier implements IvaBookRegenNotifierPort {
  private readonly responses = new Map<string, IvaBookForEntry | null>();
  calls: { organizationId: string; purchaseId: string; newTotal: number }[] = [];

  respondWith(purchaseId: string, ivaBook: IvaBookForEntry | null): void {
    this.responses.set(purchaseId, ivaBook);
  }

  async recomputeFromPurchase(
    organizationId: string,
    purchaseId: string,
    newTotal: number,
  ): Promise<IvaBookForEntry | null> {
    this.calls.push({ organizationId, purchaseId, newTotal });
    return this.responses.get(purchaseId) ?? null;
  }
}
