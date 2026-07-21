/**
 * Read port for the purchase's contact summary as consumed by the purchase
 * detail page (purchase-pure-read — mirror sale-pure-read pilot).
 * Purchase-hex declares this port instead of the page querying Prisma
 * directly so the presentation layer stays decoupled from persistence
 * (R2 §3 ports-only) and the read is tenant-scoped.
 *
 * The view is a clean DTO — plain values only, NO Prisma types. The Prisma
 * projection→view conversion lives in the infrastructure adapter
 * (`PrismaPurchaseContactReaderAdapter`).
 */

export interface PurchaseContactView {
  id: string;
  name: string;
  type: string;
  nit: string | null;
  paymentTermsDays: number | null;
}

export interface PurchaseContactReaderPort {
  /**
   * Returns the contact summary for a purchase, or null when no contact
   * matches the id within the organization (cross-tenant reads resolve to
   * null).
   */
  findById(
    organizationId: string,
    contactId: string,
  ): Promise<PurchaseContactView | null>;
}
