/**
 * Read port for the sale's contact summary as consumed by the sale detail
 * page (sale-pure-read pilot). Sale-hex declares this port instead of the
 * page querying Prisma directly so the presentation layer stays decoupled
 * from persistence (R2 §3 ports-only) and the read is tenant-scoped.
 *
 * The view is a clean DTO — plain values only, NO Prisma types. The Prisma
 * projection→view conversion lives in the infrastructure adapter
 * (`PrismaSaleContactReaderAdapter`).
 */

export interface SaleContactView {
  id: string;
  name: string;
  type: string;
  nit: string | null;
  paymentTermsDays: number | null;
}

export interface SaleContactReaderPort {
  /**
   * Returns the contact summary for a sale, or null when no contact matches
   * the id within the organization (cross-tenant reads resolve to null).
   */
  findById(
    organizationId: string,
    contactId: string,
  ): Promise<SaleContactView | null>;
}
