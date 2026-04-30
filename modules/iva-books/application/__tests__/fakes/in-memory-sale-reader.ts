import type {
  SaleReaderPort,
  SaleSnapshot,
} from "../../../domain/ports/sale-reader.port";

/**
 * In-memory fake of `SaleReaderPort`. Returns `null` cuando saleId no fue
 * preloaded (legacy parity: getById retorna null si no existe sale).
 */
export class InMemorySaleReader implements SaleReaderPort {
  private readonly store = new Map<string, SaleSnapshot>();
  calls: { organizationId: string; saleId: string }[] = [];

  preload(snapshot: SaleSnapshot): void {
    this.store.set(snapshot.id, snapshot);
  }

  async getById(
    organizationId: string,
    saleId: string,
  ): Promise<SaleSnapshot | null> {
    this.calls.push({ organizationId, saleId });
    const found = this.store.get(saleId);
    if (!found || found.organizationId !== organizationId) return null;
    return found;
  }
}
