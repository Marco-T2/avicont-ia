import type { IvaBookForEntry } from "../../../domain/build-sale-entry-lines";
import type { IvaBookRegenNotifierPort } from "../../../domain/ports/iva-book-regen-notifier.port";

/**
 * In-memory `IvaBookRegenNotifierPort` fake. Tests configure the response per
 * sale via `respondWith(saleId, ivaBook | null)`. Default: returns `null`
 * (no IVA cascade — non-IVA sale path).
 */
export class InMemoryIvaBookRegenNotifier
  implements IvaBookRegenNotifierPort
{
  private readonly responses = new Map<string, IvaBookForEntry | null>();
  calls: { organizationId: string; saleId: string; newTotal: number }[] = [];

  respondWith(saleId: string, ivaBook: IvaBookForEntry | null): void {
    this.responses.set(saleId, ivaBook);
  }

  async recomputeFromSale(
    organizationId: string,
    saleId: string,
    newTotal: number,
  ): Promise<IvaBookForEntry | null> {
    this.calls.push({ organizationId, saleId, newTotal });
    return this.responses.get(saleId) ?? null;
  }
}
