import type { IvaBookVoidCascadePort } from "../../../domain/ports/iva-book-void-cascade.port";

/**
 * In-memory `IvaBookVoidCascadePort` fake. Records every invocation for test
 * assertion. No state needed — the port is fire-and-forget (write-only).
 */
export class InMemoryIvaBookVoidCascade implements IvaBookVoidCascadePort {
  calls: { organizationId: string; saleId: string }[] = [];

  async markVoidedFromSale(
    organizationId: string,
    saleId: string,
  ): Promise<void> {
    this.calls.push({ organizationId, saleId });
  }
}
