/**
 * Read port for the purchase's payable-with-allocations as consumed by the
 * purchase detail page (purchase-pure-read — mirror sale-pure-read pilot).
 * Purchase-hex declares this port instead of the page querying Prisma
 * directly so the presentation layer stays decoupled from persistence
 * (R2 §3 ports-only) and the read is tenant-scoped.
 *
 * The view is a clean DTO — monetary fields are plain `number`, NO
 * `Prisma.Decimal` leaks into the domain. The Decimal→number conversion is
 * an infrastructure boundary concern (`PrismaPurchasePayableReaderAdapter`).
 * Allocations arrive ordered by payment date ascending (adapter contract —
 * mirrors the legacy page query `orderBy: { payment: { date: "asc" } }`).
 */

export interface PurchasePaymentAllocationView {
  id: string;
  paymentId: string;
  amount: number;
  payment: {
    id: string;
    date: Date;
    description: string;
  };
}

export interface PurchasePayableView {
  id: string;
  amount: number;
  paid: number;
  balance: number;
  status: string;
  dueDate: Date;
  allocations: PurchasePaymentAllocationView[];
}

export interface PurchasePayableReaderPort {
  /**
   * Returns the payable with its payment allocations (ordered by payment
   * date asc), or null when no payable matches the id within the
   * organization (cross-tenant reads resolve to null).
   */
  findWithAllocations(
    organizationId: string,
    payableId: string,
  ): Promise<PurchasePayableView | null>;
}
