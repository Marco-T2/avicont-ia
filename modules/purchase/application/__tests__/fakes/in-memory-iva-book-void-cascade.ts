import type { IvaBookVoidCascadePort } from "../../../domain/ports/iva-book-void-cascade.port";

/**
 * In-memory `IvaBookVoidCascadePort` fake purchase-hex. Espejo simétrico
 * del fake sale-hex. Records every invocation for test assertion.
 */
export class InMemoryIvaBookVoidCascade implements IvaBookVoidCascadePort {
  calls: { organizationId: string; purchaseId: string }[] = [];

  async markVoidedFromPurchase(
    organizationId: string,
    purchaseId: string,
  ): Promise<void> {
    this.calls.push({ organizationId, purchaseId });
  }
}
