/**
 * Read port for the sale's receivable-with-allocations as consumed by the
 * sale detail page (sale-pure-read pilot). Sale-hex declares this port
 * instead of the page querying Prisma directly so the presentation layer
 * stays decoupled from persistence (R2 §3 ports-only) and the read is
 * tenant-scoped.
 *
 * The view is a clean DTO — monetary fields are plain `number`, NO
 * `Prisma.Decimal` leaks into the domain. The Decimal→number conversion is
 * an infrastructure boundary concern (`PrismaSaleReceivableReaderAdapter`).
 * Allocations arrive ordered by payment date ascending (adapter contract —
 * mirrors the legacy page query `orderBy: { payment: { date: "asc" } }`).
 */

export interface SalePaymentAllocationView {
  id: string;
  paymentId: string;
  amount: number;
  payment: {
    id: string;
    date: Date;
    description: string;
  };
}

export interface SaleReceivableView {
  id: string;
  amount: number;
  paid: number;
  balance: number;
  status: string;
  dueDate: Date;
  allocations: SalePaymentAllocationView[];
}

export interface SaleReceivableReaderPort {
  /**
   * Returns the receivable with its payment allocations (ordered by payment
   * date asc), or null when no receivable matches the id within the
   * organization (cross-tenant reads resolve to null).
   */
  findWithAllocations(
    organizationId: string,
    receivableId: string,
  ): Promise<SaleReceivableView | null>;
}
