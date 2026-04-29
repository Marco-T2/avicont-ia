import type {
  IvaBookReaderPort,
  IvaBookSnapshot,
} from "../../../domain/ports/iva-book-reader.port";

export class InMemoryIvaBookReader implements IvaBookReaderPort {
  private readonly bySaleId = new Map<string, IvaBookSnapshot | null>();
  calls: { organizationId: string; saleId: string }[] = [];

  preload(saleId: string, snapshot: IvaBookSnapshot | null): void {
    this.bySaleId.set(saleId, snapshot);
  }

  async getActiveBookForSale(
    organizationId: string,
    saleId: string,
  ): Promise<IvaBookSnapshot | null> {
    this.calls.push({ organizationId, saleId });
    return this.bySaleId.get(saleId) ?? null;
  }
}
